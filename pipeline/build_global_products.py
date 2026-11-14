"""
Turn the global shards (fetch_global.py) into browser-ready products:

  app/public/data/regions.json         index of areas the app can open (world, featured regions, countries)
  app/public/data/series/<id>.json.gz  calibrated daily series + uncertainty band for one area

Every area goes through the same calibration as before (calibration.aoi_series): seasonal Aqua->VIIRS
and Terra->Aqua ratios learned inside that area, applied to the MODIS era, with a calibration band.
Cells are assigned to the country where they had the most detections (border cells go to one side).

Usage:
    python3 pipeline/build_global_products.py
"""
import gzip
import json
import os
import sys
from pathlib import Path

import numpy as np
import pandas as pd
from h3.api import numpy_int as h3i

sys.path.insert(0, str(Path(__file__).parent))
from calibration import AXIS_START, aoi_series  # noqa: E402

REPO_ROOT = Path(__file__).resolve().parent.parent
SHARDS = REPO_ROOT / "data" / "global" / "shards"
OUT = Path(os.environ.get("BURNLOG_OUT", REPO_ROOT / "app" / "public" / "data"))
AXIS_END = pd.Timestamp("2025-12-31")
NDAYS = (AXIS_END - AXIS_START).days + 1
LOW_DATA_CELLDAYS = 500

# (id, name, bbox lon_min lat_min lon_max lat_max, optional country restriction)
FEATURED = [
    ("punjab-haryana", "Punjab & Haryana", [73.8, 27.6, 77.7, 32.6], ["IND"]),
    ("indo-gangetic", "Indo-Gangetic Plain", [74.0, 24.0, 88.5, 32.6], ["IND"]),
    ("central-india", "Central India forests", [76.0, 17.5, 84.5, 24.0], ["IND"]),
    ("northeast", "Northeast India", [89.5, 21.5, 97.5, 29.5], ["IND"]),
    ("peninsular", "Peninsular India", [73.0, 8.0, 80.8, 17.5], ["IND"]),
    ("amazon-arc", "Amazon arc of deforestation", [-65.0, -15.0, -44.0, -3.0], None),
    ("southern-africa-savanna", "Southern African savanna", [12.0, -18.0, 36.0, -4.0], None),
    ("sahel-savanna", "West African savanna", [-17.0, 6.0, 16.0, 14.0], None),
    ("northern-australia", "Northern Australia savanna", [122.0, -19.0, 142.0, -11.0], None),
    ("southeast-australia", "Southeast Australia", [146.0, -38.5, 153.5, -28.0], None),
    ("california", "California", [-124.5, 32.5, -114.0, 42.0], None),
    ("boreal-canada", "Boreal Canada", [-135.0, 50.0, -65.0, 62.0], None),
    ("siberia", "Siberian boreal forest", [60.0, 50.0, 140.0, 66.0], None),
    ("maritime-sea", "Sumatra & Kalimantan", [95.0, -6.0, 119.0, 5.0], None),
    ("mainland-sea", "Mainland Southeast Asia", [96.0, 12.0, 108.0, 24.0], None),
    ("mediterranean", "Mediterranean Europe", [-10.0, 35.0, 30.0, 45.0], None),
]


def write_json(path: Path, obj, gz: bool = False) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    text = json.dumps(obj, separators=(",", ":"))
    if gz:
        path.write_bytes(gzip.compress(text.encode(), compresslevel=9))
    else:
        path.write_text(text)


def main() -> None:
    names = json.loads((Path(__file__).parent / "countries.json").read_text())
    alpha3 = list(names)
    shard_files = sorted(p for p in SHARDS.glob("*.parquet") if not p.stem.endswith("_cc"))
    if not shard_files:
        sys.exit("No shards found; run fetch_global.py first.")
    print(f"{len(shard_files)} shards", flush=True)

    # 1) cell universe and dominant country per cell
    cc = pd.concat([pd.read_parquet(p) for p in SHARDS.glob("*_cc.parquet")], ignore_index=True)
    dom = cc.groupby(["h3", "cidx"], sort=False)["cd"].sum().reset_index().sort_values("cd").drop_duplicates("h3", keep="last")
    dom = dom.sort_values("h3").reset_index(drop=True)
    uniq = dom["h3"].to_numpy(np.uint64)
    cell_country = dom["cidx"].to_numpy(np.int64)
    ll = np.array([h3i.cell_to_latlng(int(x)) for x in uniq])
    lat, lon = ll[:, 0], ll[:, 1]
    print(f"{len(uniq):,} cells with detections", flush=True)

    # 2) area masks over cells
    n_countries = len(alpha3)
    masks = {}
    for fid, _, bbox, restrict in FEATURED:
        m = (lon >= bbox[0]) & (lon <= bbox[2]) & (lat >= bbox[1]) & (lat <= bbox[3])
        if restrict:
            m &= np.isin(cell_country, [alpha3.index(a) for a in restrict])
        masks[fid] = m

    size_c = (n_countries + 1) * 3 * NDAYS  # last slot = world
    counts_c = np.zeros(size_c, dtype=np.int64)
    counts_f = {fid: np.zeros(3 * NDAYS, dtype=np.int64) for fid in masks}

    # 3) accumulate cell-days per area, sensor and day, one shard at a time
    for p in shard_files:
        df = pd.read_parquet(p, columns=["h3", "day", "sensor"])
        idx = np.searchsorted(uniq, df["h3"].to_numpy(np.uint64))
        day = df["day"].to_numpy(np.int64)
        sensor = df["sensor"].to_numpy(np.int64)
        local = sensor * NDAYS + day
        counts_c += np.bincount((cell_country[idx] * 3 + sensor) * NDAYS + day, minlength=size_c)
        counts_c[n_countries * 3 * NDAYS:] += np.bincount(local, minlength=3 * NDAYS)
        for fid, m in masks.items():
            sel = m[idx]
            if sel.any():
                counts_f[fid] += np.bincount(local[sel], minlength=3 * NDAYS)
        print(f"  accumulated {p.name}", flush=True)

    def series_for(counts: np.ndarray) -> dict:
        c = counts.reshape(3, NDAYS)
        daily = pd.DataFrame(
            {"MODIS_TERRA": c[0], "MODIS_AQUA": c[1], "VIIRS_SNPP": c[2]},
            index=pd.date_range(AXIS_START, periods=NDAYS),
        )
        return aoi_series(daily)

    def robust_bbox(m: np.ndarray) -> list:
        if not m.any():
            return [-180, -90, 180, 90]
        la, lo = lat[m], lon[m]
        q = lambda a, p: float(np.percentile(a, p))
        return [round(q(lo, 1), 2), round(q(la, 1), 2), round(q(lo, 99), 2), round(q(la, 99), 2)]

    index = []

    def emit(aid, name, kind, counts, cell_mask, bbox=None):
        viirs_total = int(counts.reshape(3, NDAYS)[2].sum())
        if counts.sum() == 0:
            return
        s = series_for(counts)
        cells = int(cell_mask.sum())
        entry = {"id": aid, "name": name, "kind": kind, "cells": cells, "lowData": viirs_total < LOW_DATA_CELLDAYS,
                 "viirsCellDays": viirs_total, "bbox": bbox or robust_bbox(cell_mask)}
        write_json(OUT / "series" / f"{aid}.json.gz", {"values": s["values"], "lo": s["lo"], "hi": s["hi"], "ratios": s["ratios"]}, gz=True)
        index.append(entry)

    emit("world", "World", "world", counts_c[n_countries * 3 * NDAYS:], np.ones(len(uniq), bool), [-180, -60, 180, 75])
    for fid, name, bbox, _ in FEATURED:
        emit(fid, name, "featured", counts_f[fid], masks[fid], bbox)
    cc_counts = counts_c[: n_countries * 3 * NDAYS].reshape(n_countries, 3 * NDAYS)
    for i, a in enumerate(alpha3):
        emit(a.lower(), names[a].replace("_", " "), "country", cc_counts[i], cell_country == i)
    print(f"{len(index)} areas written", flush=True)

    meta = {"axisStart": AXIS_START.strftime("%Y-%m-%d"), "axisEnd": AXIS_END.strftime("%Y-%m-%d"),
            "firstMeasured": "2000-11-01", "viirsStart": "2012-01-20", "aquaStart": "2002-07-01", "res": 5}
    write_json(OUT / "regions.json", {"meta": meta, "regions": index})


if __name__ == "__main__":
    main()
