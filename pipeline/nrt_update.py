"""
Near-real-time early-warning numbers: the latest seven days of VIIRS (Suomi NPP) active fire against the same
calendar week in 2013-2025, for the world, the featured regions and the countries.

Uses the FIRMS area API (needs FIRMS_MAP_KEY in .env or the environment; never ship the key to the browser).
NRT data lags real time by about 12 days, so "latest" is whatever the API reports as its newest date.
Same filters as the archive (vegetation-fire rows, confidence not low) and the same unit (H3 res-5 burning cell-days).
Cells that never had a detection in 2000-2025 cannot be assigned to a country, so they only count toward the world.

Writes app/public/data/nrt.json.   Usage:  python3 pipeline/nrt_update.py
"""
import gzip
import io
import json
import os
import sys
from datetime import date, timedelta
from pathlib import Path

import h3
import numpy as np
import pandas as pd
import requests
from h3.api import numpy_int as h3i

sys.path.insert(0, str(Path(__file__).parent))
from build_global_products import FEATURED, SHARDS  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "app" / "public" / "data"
KEY = os.environ.get("FIRMS_MAP_KEY")
if not KEY and (ROOT / ".env").exists():
    for line in (ROOT / ".env").read_text().splitlines():
        if line.startswith("FIRMS_MAP_KEY="):
            KEY = line.split("=", 1)[1].strip()
BASE = "https://firms.modaps.eosdis.nasa.gov/api"
AXIS0 = pd.Timestamp("2000-01-01")


def api(path: str) -> str:
    r = requests.get(f"{BASE}/{path}", timeout=300)
    r.raise_for_status()
    return r.text


def main():
    if not KEY:
        sys.exit("Set FIRMS_MAP_KEY.")
    avail = pd.read_csv(io.StringIO(api(f"data_availability/csv/{KEY}/VIIRS_SNPP_NRT")))
    end = date.fromisoformat(avail["max_date"].iloc[0])
    start = end - timedelta(days=6)
    frames = []
    d = start
    while d <= end:
        n = min(5, (end - d).days + 1)
        txt = api(f"area/csv/{KEY}/VIIRS_SNPP_NRT/world/{n}/{d.isoformat()}")
        frames.append(pd.read_csv(io.StringIO(txt), usecols=["latitude", "longitude", "acq_date", "confidence"], dtype={"confidence": "string"}))
        d += timedelta(days=n)
    df = pd.concat(frames, ignore_index=True)
    df = df[df["confidence"] != "l"]
    print(f"{len(df):,} detections {start} to {end}", flush=True)
    cell = np.fromiter((h3.str_to_int(h3.latlng_to_cell(a, b, 5)) for a, b in zip(df["latitude"], df["longitude"])), dtype=np.uint64, count=len(df))
    cd = pd.DataFrame({"h3": cell, "day": pd.to_datetime(df["acq_date"]).dt.strftime("%Y-%m-%d")}).drop_duplicates()

    names = json.loads((Path(__file__).parent / "countries.json").read_text())
    alpha3 = list(names)
    cc = pd.concat([pd.read_parquet(p) for p in SHARDS.glob("*_cc.parquet")], ignore_index=True)
    dom = cc.groupby(["h3", "cidx"], sort=False)["cd"].sum().reset_index().sort_values("cd").drop_duplicates("h3", keep="last").sort_values("h3").reset_index(drop=True)
    uniq = dom["h3"].to_numpy(np.uint64)
    cell_country = dom["cidx"].to_numpy(np.int64)
    ll = np.array([h3i.cell_to_latlng(int(x)) for x in uniq])

    h = cd["h3"].to_numpy(np.uint64)
    pos = np.clip(np.searchsorted(uniq, h), 0, len(uniq) - 1)
    known = uniq[pos] == h
    counts = {"world": len(cd)}
    for i, a in enumerate(alpha3):
        counts[a.lower()] = int((known & (cell_country[pos] == i)).sum())
    for fid, _, bbox, restrict in FEATURED:
        la, lo = ll[pos, 0], ll[pos, 1]
        m = known & (lo >= bbox[0]) & (lo <= bbox[2]) & (la >= bbox[1]) & (la <= bbox[3])
        if restrict:
            m &= np.isin(cell_country[pos], [alpha3.index(x) for x in restrict])
        counts[fid] = int(m.sum())

    areas = {}
    for aid, n in counts.items():
        f = OUT / "series" / f"{aid}.json.gz"
        if not f.exists():
            continue
        vals = json.loads(gzip.open(f).read())["values"]
        tot = []
        for y in range(2013, 2026):
            s = (pd.Timestamp(date(y, start.month, start.day)) - AXIS0).days
            w = vals[s : s + 7]
            if len(w) == 7 and all(v is not None for v in w):
                tot.append(float(sum(w)))
        if len(tot) < 8:
            continue
        mean, sd = float(np.mean(tot)), float(np.std(tot))
        areas[aid] = {"n": int(n), "typical": round(mean, 1), "z": round((n - mean) / sd, 2) if sd > 0 else 0.0,
                      "pct": round(100 * float(np.mean(np.array(tot) < n)), 0), "years": len(tot)}
    (OUT / "nrt.json").write_text(json.dumps({"start": start.isoformat(), "end": end.isoformat(), "areas": areas}))
    print(f"wrote nrt.json: {len(areas)} areas; punjab {areas.get('punjab-haryana')}")


if __name__ == "__main__":
    main()
