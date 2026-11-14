"""
When in the day do the satellites catch fires?  Local-solar-hour histograms of vegetation-fire detections per area.

The main pipeline throws away each detection's acquisition time (it only keeps burning cell-days), so this re-reads a
sample of FIRMS's public per-country annual archives and keeps, per country and per featured region, the count of
detections by sensor x calendar month x local solar hour (UTC time + longitude/15). Same filters as fetch_global.py.

Sample years rather than all 26, because a typical-year profile is stable and the full re-download is 30 GB:
  VIIRS S-NPP 2014, 2018, 2022    MODIS (Terra and Aqua) 2004, 2010, 2018, 2022
Override with --years-viirs / --years-modis. Resumable: finished (archive, year) pairs are cached in data/global/hours/.
Writes app/public/data/hours.json.   Usage: python3 pipeline/fetch_hours.py
"""
import argparse
import gzip
import json
import sys
import tempfile
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).parent))
from build_global_products import FEATURED  # noqa: E402
from fetch_global import ARCHIVES, URL, download  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / "data" / "global" / "hours"
OUT = ROOT / "app" / "public" / "data" / "hours.json"
USE = ["latitude", "longitude", "acq_date", "acq_time", "satellite", "confidence", "type"]


def one_country(job):
    archive, year, alpha3, name, tmp = job
    cfg = ARCHIVES[archive]
    path = Path(tmp) / f"{archive}_{year}_{alpha3}.csv"
    try:
        if not download(URL.format(slug=archive, year=year, country=name), path):
            return alpha3, None
        df = pd.read_csv(path, usecols=USE, dtype={"confidence": "string", "satellite": "string", "acq_time": "int32"})
    finally:
        path.unlink(missing_ok=True)
    df = df[df["type"] == 0]
    df = df[pd.to_numeric(df["confidence"], errors="coerce") >= 30] if archive == "modis" else df[df["confidence"] != "l"]
    if df.empty:
        return alpha3, np.zeros((3, 12, 24), np.int64), {}
    sensor = df["satellite"].map(cfg["sensors"]).to_numpy() if archive == "modis" else np.full(len(df), 2)
    month = pd.to_datetime(df["acq_date"]).dt.month.to_numpy() - 1
    utc = (df["acq_time"] // 100 + (df["acq_time"] % 100) / 60).to_numpy()
    lon = df["longitude"].to_numpy()
    lat = df["latitude"].to_numpy()
    hour = (np.floor(utc + lon / 15.0) % 24).astype(int)
    ok = ~pd.isna(sensor)
    sensor = sensor[ok].astype(int)
    key = (sensor * 12 + month[ok]) * 24 + hour[ok]
    total = np.bincount(key, minlength=3 * 12 * 24).reshape(3, 12, 24)
    feats = {}
    for fid, _, bbox, restrict in FEATURED:
        if restrict and alpha3 not in restrict:
            continue
        m = (lon[ok] >= bbox[0]) & (lon[ok] <= bbox[2]) & (lat[ok] >= bbox[1]) & (lat[ok] <= bbox[3])
        if m.any():
            feats[fid] = np.bincount(key[m], minlength=3 * 12 * 24).reshape(3, 12, 24)
    return alpha3, total, feats


def run(archive, year, countries):
    f = CACHE / f"{archive}_{year}.npz"
    if f.exists():
        z = np.load(f, allow_pickle=True)
        return json.loads(str(z["names"])), z["data"]
    t0 = time.time()
    names, rows = [], []
    with tempfile.TemporaryDirectory(prefix="firmsh_") as tmp, ThreadPoolExecutor(4) as pool:
        for alpha3, total, *rest in pool.map(lambda j: _safe(j), [(archive, year, a, n, tmp) for a, n in countries.items()]):
            if total is None:
                continue
            names.append(alpha3.lower())
            rows.append(total)
            for fid, arr in (rest[0] if rest else {}).items():
                names.append(f"@{fid}")
                rows.append(arr)
    data = np.stack(rows)
    CACHE.mkdir(parents=True, exist_ok=True)
    np.savez_compressed(f, names=json.dumps(names), data=data)
    print(f"  {archive} {year}: {len(names)} entries, {time.time() - t0:.0f}s", flush=True)
    return names, data


def _safe(job):
    for attempt in range(3):
        try:
            return one_country(job)
        except Exception as e:  # noqa: BLE001
            err = e
            time.sleep(2)
    print(f"  FAILED {job[2]} {job[1]}: {err}", flush=True)
    raise err


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--years-viirs", default="2014,2018,2022")
    ap.add_argument("--years-modis", default="2004,2010,2018,2022")
    args = ap.parse_args()
    countries = json.loads((Path(__file__).parent / "countries.json").read_text())
    acc = {}
    for archive, years in (("viirs-snpp", args.years_viirs), ("modis", args.years_modis)):
        for y in [int(v) for v in years.split(",")]:
            names, data = run(archive, y, countries)
            for n, arr in zip(names, data):
                acc.setdefault(n, np.zeros((3, 12, 24), np.int64))
                acc[n] += arr
    world = sum(v for k, v in acc.items() if not k.startswith("@"))
    out = {"years": {"viirs": args.years_viirs, "modis": args.years_modis}, "areas": {}}
    out["areas"]["world"] = world.tolist()
    for k, v in acc.items():
        out["areas"][k[1:] if k.startswith("@") else k] = v.tolist()
    OUT.write_text(json.dumps(out, separators=(",", ":")))
    print(f"wrote {OUT} ({OUT.stat().st_size / 1e6:.1f} MB, {len(out['areas'])} areas)")


if __name__ == "__main__":
    main()
