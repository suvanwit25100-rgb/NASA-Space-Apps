"""
Global download-and-aggregate pipeline: the multi-country version of fetch_and_aggregate.py.

For every country in pipeline/countries.json (ISO alpha-3 -> the name FIRMS uses in its public
per-country annual archive) it downloads each sensor-year file, keeps vegetation-fire detections at
acceptable confidence, aggregates to H3 burning cell-days, and discards the raw points. Output is
one parquet shard per (archive, year) in data/global/shards/, with columns:
    h3 (uint64 H3 index), day (uint16, days since 2000-01-01), sensor (uint8: 0 Terra, 1 Aqua,
    2 VIIRS S-NPP), n (uint16 raw detections in that cell-day)
plus a sidecar {archive}_{year}_cc.parquet (h3, cidx, cd): how many cell-days each cell had inside each
country (cidx = position in countries.json), so cells can later be assigned to their dominant country.

Resumable: finished shards are skipped, and a shard is only written when every country for that
year downloaded cleanly, so re-running after a network failure simply redoes the incomplete years.
Be polite to the server: 4 parallel downloads is what it tolerates (16 gets throttled).

Usage:
    python3 pipeline/fetch_global.py                       # everything
    python3 pipeline/fetch_global.py --years 2020 --countries IND,PAK   # a quick test
"""
import argparse
import json
import sys
import tempfile
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import h3
import numpy as np
import pandas as pd
import requests

REPO_ROOT = Path(__file__).resolve().parent.parent
URL = "https://firms.modaps.eosdis.nasa.gov/data/country/{slug}/{year}/{slug}_{year}_{country}.csv"
AXIS0 = pd.Timestamp("2000-01-01")
RES = 5
WORKERS = 4

ARCHIVES = {
    "modis": {"first_year": 2000, "sensors": {"Terra": 0, "Aqua": 1}},
    "viirs-snpp": {"first_year": 2012, "sensors": {None: 2}},
}
USECOLS = ["latitude", "longitude", "acq_date", "satellite", "confidence", "type"]


def download(url: str, dest: Path, attempts: int = 6) -> bool:
    """Stream a file to disk. Returns False on 404 (no data), raises after repeated failures."""
    for attempt in range(attempts):
        try:
            with requests.get(url, stream=True, timeout=(30, 120)) as r:
                if r.status_code == 404:
                    return False
                r.raise_for_status()
                with open(dest, "wb") as f:
                    for chunk in r.iter_content(1 << 20):
                        f.write(chunk)
            return True
        except (requests.RequestException, OSError) as e:
            if attempt == attempts - 1:
                raise RuntimeError(f"{url}: {e}") from e
            time.sleep(3 * (attempt + 1))
    return False


def process_country(args):
    archive, year, alpha3, name, tmpdir = args
    cfg = ARCHIVES[archive]
    path = Path(tmpdir) / f"{archive}_{year}_{alpha3}.csv"
    try:
        if not download(URL.format(slug=archive, year=year, country=name), path):
            return alpha3, None, 0
        df = pd.read_csv(path, usecols=USECOLS, dtype={"confidence": "string", "satellite": "string"})
    finally:
        path.unlink(missing_ok=True)
    raw = len(df)
    df = df[df["type"] == 0]
    if archive == "modis":
        df = df[pd.to_numeric(df["confidence"], errors="coerce") >= 30]
    else:
        df = df[df["confidence"] != "l"]
    if df.empty:
        return alpha3, pd.DataFrame(columns=["h3", "day", "sensor", "n"]), raw
    if archive == "modis":
        sensor = df["satellite"].map(cfg["sensors"])
    else:
        sensor = pd.Series(cfg["sensors"][None], index=df.index)
    lat, lon = df["latitude"].to_numpy(), df["longitude"].to_numpy()
    cells = np.fromiter((h3.str_to_int(h3.latlng_to_cell(a, b, RES)) for a, b in zip(lat, lon)), dtype=np.uint64, count=len(df))
    day = (pd.to_datetime(df["acq_date"]) - AXIS0).dt.days.to_numpy()
    out = pd.DataFrame({"h3": cells, "day": day.astype(np.uint16), "sensor": sensor.to_numpy().astype(np.uint8)})
    out = out.groupby(["h3", "day", "sensor"], sort=False).size().reset_index(name="n")
    return alpha3, out, raw


countries_all: list = []


def run_shard(archive: str, year: int, countries: dict, out_dir: Path) -> bool:
    shard = out_dir / f"{archive}_{year}.parquet"
    cc_path = out_dir / f"{archive}_{year}_cc.parquet"
    if shard.exists() and cc_path.exists():
        return True
    cidx = {a: i for i, a in enumerate(countries_all)}
    t0 = time.time()
    parts, cc_parts, failures, raw_total = [], [], [], 0
    with tempfile.TemporaryDirectory(prefix="firms_") as tmp:
        jobs = [(archive, year, a, n, tmp) for a, n in countries.items()]
        with ThreadPoolExecutor(WORKERS) as pool:
            for item in pool.map(lambda j: _safe(j), jobs):
                alpha3, df, raw, err = item
                if err:
                    failures.append((alpha3, err))
                elif df is not None:
                    parts.append(df)
                    raw_total += raw
                    if len(df):
                        cc = df.groupby("h3").size().reset_index(name="cd")
                        cc["cidx"] = np.uint16(cidx[alpha3])
                        cc_parts.append(cc)
    if failures:
        print(f"  {archive} {year}: INCOMPLETE, {len(failures)} country failures (e.g. {failures[0]}); shard not written", flush=True)
        return False
    merged = pd.concat(parts, ignore_index=True) if parts else pd.DataFrame(columns=["h3", "day", "sensor", "n"])
    # cells straddling a border appear in two countries: merge them
    merged = merged.groupby(["h3", "day", "sensor"], sort=True)["n"].sum().reset_index()
    merged["n"] = merged["n"].clip(upper=65535).astype(np.uint16)
    cc_all = pd.concat(cc_parts, ignore_index=True) if cc_parts else pd.DataFrame({"h3": [], "cd": [], "cidx": []})
    cc_all.to_parquet(cc_path, index=False)
    merged.to_parquet(shard.with_suffix(".tmp"), index=False)
    shard.with_suffix(".tmp").rename(shard)
    print(f"  {archive} {year}: {raw_total:,} raw -> {len(merged):,} cell-days, {len(parts)} countries, {time.time() - t0:.0f}s", flush=True)
    return True


def _safe(job):
    try:
        alpha3, df, raw = process_country(job)
        return alpha3, df, raw, None
    except Exception as e:  # noqa: BLE001 - reported and retried on the next run
        return job[2], None, 0, str(e)[:200]


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--years", help="e.g. 2020 or 2015-2018 (default: all available)")
    p.add_argument("--countries", help="comma-separated ISO alpha-3 codes (default: all)")
    p.add_argument("--end-year", type=int, default=2025)
    p.add_argument("--out-dir", default=str(REPO_ROOT / "data" / "global" / "shards"))
    args = p.parse_args()

    countries = json.loads((Path(__file__).parent / "countries.json").read_text())
    countries_all.extend(countries)
    if args.countries:
        wanted = {c.strip().upper() for c in args.countries.split(",")}
        countries = {a: n for a, n in countries.items() if a in wanted}
    if args.years:
        lo, _, hi = args.years.partition("-")
        years = range(int(lo), int(hi or lo) + 1)
    else:
        years = range(2000, args.end_year + 1)

    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    print(f"{len(countries)} countries, years {years.start}-{years.stop - 1}", flush=True)
    incomplete = []
    for archive, cfg in ARCHIVES.items():
        for year in years:
            if year < cfg["first_year"]:
                continue
            if not run_shard(archive, year, countries, out_dir):
                incomplete.append((archive, year))
    if incomplete:
        print(f"\nIncomplete shards (re-run to retry): {incomplete}")
        sys.exit(1)
    print("\nAll shards complete.")


if __name__ == "__main__":
    main()
