"""
Download-and-aggregate pipeline (step 1-2 of the harmonisation method in
CLAUDE.md §4): fetch FIRMS active-fire archives, filter to vegetation fire
at reasonable confidence, aggregate to H3 "burning cell-days", and discard
the raw per-detection points so memory stays flat regardless of volume.

Data source: FIRMS country-level annual archive CSVs
(https://firms.modaps.eosdis.nasa.gov/data/country/<sensor>/<year>/<sensor>_<year>_<Country>.csv).
These are public, pre-packaged, one file per sensor per year, and need no
MAP_KEY or rate-limit budgeting — far cheaper than paging the area API
day-by-day across 26 years. Confirmed empirically:
  - MODIS country archives exist for complete years 2000-2025 (not 2026 yet).
  - VIIRS_SNPP country archives exist for complete years 2012-2025.
  - Both include a `type` column (0 = vegetation fire) even though the
    area API's VIIRS_SNPP_NRT response does not.
NOAA-20/NOAA-21 country-archive naming wasn't found under the patterns we
tried (viirs-noaa20, viirs_noaa20) — flagged as follow-up, not blocking.

This script is scoped to one country at a time (demo region), not a literal
global pull: a true global 26-year, multi-sensor pull via this same country
archive mechanism (iterating every FIRMS-listed country) is the natural next
step once this per-region path is validated, and is straightforward to wire
up by looping COUNTRY over the full country list instead of one name.

Usage:
    python3 pipeline/fetch_and_aggregate.py --country India --start-year 2000 --end-year 2025
"""
import argparse
from io import StringIO
from pathlib import Path

import h3
import pandas as pd
import requests

REPO_ROOT = Path(__file__).resolve().parent.parent
ARCHIVE_URL = "https://firms.modaps.eosdis.nasa.gov/data/country/{sensor}/{year}/{sensor}_{year}_{country}.csv"

# archive slug -> (first year available, confidence filter, satellite->sensor-label split)
# MODIS is split into MODIS_TERRA / MODIS_AQUA because calibration (CLAUDE.md §4 step 4)
# pairs Aqua (~1:30pm/am overpass) against VIIRS S-NPP (~1:30pm/am overpass) specifically —
# Terra (~10:30am/pm) is a different orbit and would bias the ratio. Aqua launched May 2002,
# so 2000-2001 is Terra-only.
ARCHIVES = {
    "modis": {
        "first_year": 2000,
        "drop_low_confidence": lambda df: df["confidence"].astype(int) >= 30,
        "satellite_to_sensor": {"Terra": "MODIS_TERRA", "Aqua": "MODIS_AQUA"},
    },
    "viirs-snpp": {
        "first_year": 2012,
        "drop_low_confidence": lambda df: df["confidence"] != "l",
        "satellite_to_sensor": None,  # single sensor, no split needed
        "sensor_name": "VIIRS_SNPP",
    },
}


def fetch_year(archive_slug: str, year: int, country: str) -> pd.DataFrame:
    url = ARCHIVE_URL.format(sensor=archive_slug, year=year, country=country)
    resp = requests.get(url, timeout=120)
    if resp.status_code == 404:
        return pd.DataFrame()
    resp.raise_for_status()
    text = resp.text.strip()
    if not text:
        return pd.DataFrame()
    return pd.read_csv(StringIO(text))


def filter_vegetation_fire(df: pd.DataFrame, archive_slug: str) -> pd.DataFrame:
    if df.empty:
        return df
    df = df[df["type"] == 0]  # vegetation fire only; drop volcano/static/offshore
    df = df[ARCHIVES[archive_slug]["drop_low_confidence"](df)]
    return df


def split_by_sensor(df: pd.DataFrame, archive_slug: str) -> dict:
    """Return {sensor_label: sub-dataframe}, splitting MODIS by satellite."""
    cfg = ARCHIVES[archive_slug]
    if cfg["satellite_to_sensor"] is None:
        return {cfg["sensor_name"]: df}
    return {
        label: df[df["satellite"] == sat]
        for sat, label in cfg["satellite_to_sensor"].items()
        if (df["satellite"] == sat).any()
    }


def aggregate_to_cell_days(df: pd.DataFrame, sensor: str, res: int) -> pd.DataFrame:
    """Reduce raw detections to one row per (h3_cell, date) that had >=1 detection."""
    if df.empty:
        return pd.DataFrame(columns=["h3_cell", "date", "sensor", "detection_count"])
    cells = [h3.latlng_to_cell(lat, lon, res) for lat, lon in zip(df["latitude"], df["longitude"])]
    df = df.assign(h3_cell=cells, date=df["acq_date"])
    grouped = (
        df.groupby(["h3_cell", "date"])
        .size()
        .reset_index(name="detection_count")
        .assign(sensor=sensor)
    )
    return grouped


def daily_raw_counts(df: pd.DataFrame, sensor: str) -> pd.Series:
    """Total filtered (but not gridded) detections per day — the 'before' signal."""
    if df.empty:
        return pd.Series(dtype=int)
    return df.groupby("acq_date").size().rename(sensor)


def run(country: str, start_year: int, end_year: int, res: int, out_dir: Path) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    cell_day_chunks = []
    raw_daily_by_sensor = {}

    for archive_slug, cfg in ARCHIVES.items():
        for year in range(max(start_year, cfg["first_year"]), end_year + 1):
            print(f"[{archive_slug}] fetching {country} {year} ...")
            raw = fetch_year(archive_slug, year, country)
            if raw.empty:
                print(f"  (no data / archive not yet published for {year})")
                continue
            filtered = filter_vegetation_fire(raw, archive_slug)
            print(f"  {len(raw)} raw -> {len(filtered)} after type+confidence filter")

            for sensor, sensor_df in split_by_sensor(filtered, archive_slug).items():
                if sensor_df.empty:
                    continue
                raw_daily_by_sensor.setdefault(sensor, []).append(daily_raw_counts(sensor_df, sensor))
                cell_day_chunks.append(aggregate_to_cell_days(sensor_df, sensor, res))

            # discard raw/filtered frames for this year now that they're summarised
            del raw, filtered

    raw_daily_series = {
        sensor: pd.concat(parts).sort_index() for sensor, parts in raw_daily_by_sensor.items()
    }

    cell_days = pd.concat(cell_day_chunks, ignore_index=True) if cell_day_chunks else pd.DataFrame()
    cell_days_path = out_dir / f"cell_days_{country}_{start_year}_{end_year}_res{res}.parquet"
    cell_days.to_parquet(cell_days_path, index=False)
    print(f"\nWrote {len(cell_days)} (cell, date, sensor) rows to {cell_days_path}")

    daily_raw = pd.DataFrame(raw_daily_series).fillna(0).astype(int).sort_index()
    daily_raw.index.name = "acq_date"
    raw_counts_path = out_dir / f"daily_raw_counts_{country}_{start_year}_{end_year}.csv"
    daily_raw.to_csv(raw_counts_path)
    print(f"Wrote daily raw detection counts to {raw_counts_path}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--country", default="India")
    parser.add_argument("--start-year", type=int, default=2000)
    parser.add_argument("--end-year", type=int, default=2025)
    parser.add_argument("--res", type=int, default=5, help="H3 resolution (4-5 global per CLAUDE.md)")
    parser.add_argument("--out-dir", default=str(REPO_ROOT / "data"))
    args = parser.parse_args()

    run(args.country, args.start_year, args.end_year, args.res, Path(args.out_dir))


if __name__ == "__main__":
    main()
