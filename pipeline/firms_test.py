"""
One-off smoke test for the FIRMS area API: pull VIIRS detections over
Punjab/Haryana for a date window and report what came back (row count,
columns, confidence/type breakdown), then plot raw daily detection counts.
Not part of the production pipeline.

API note (confirmed empirically, not documented clearly by NASA): the date
parameter is the START of the window, and day_range (max 10) extends
FORWARD from it — not backward from an end date.

Usage:
    python3 pipeline/firms_test.py
"""
import os
import sys
from io import StringIO
from pathlib import Path

import matplotlib.pyplot as plt
import pandas as pd
import requests
from dotenv import load_dotenv

REPO_ROOT = Path(__file__).resolve().parent.parent
load_dotenv(REPO_ROOT / ".env")

MAP_KEY = os.environ.get("FIRMS_MAP_KEY")
if not MAP_KEY:
    sys.exit("FIRMS_MAP_KEY not set. Copy .env.example to .env and fill it in.")

# Punjab/Haryana bounding box (west, south, east, north), per CLAUDE.md
BBOX = "73.5,29.5,77.5,32.5"

SOURCE = "VIIRS_SNPP_NRT"       # recent data; SP (standard processing) lags by ~2 months
WINDOW_START = "2026-10-15"     # start of the window to sample
WINDOW_DAYS = 30                # total days to cover (chunked into <=5-day API calls)
MAX_CHUNK = 5                    # empirically confirmed day_range limit for *_NRT sources
                                 # (the docs say up to 10; NRT sources 400 above 5 — recheck
                                 # for SP/archive sources, which may allow the full 10)

BASE_URL = "https://firms.modaps.eosdis.nasa.gov/api/area/csv"


def fetch_chunk(source: str, start_date: str, day_range: int) -> pd.DataFrame:
    url = f"{BASE_URL}/{MAP_KEY}/{source}/{BBOX}/{day_range}/{start_date}"
    resp = requests.get(url, timeout=30)
    resp.raise_for_status()
    text = resp.text.strip()
    if not text or text.startswith("Invalid") or "<html" in text.lower():
        raise RuntimeError(f"Unexpected response from FIRMS API: {text[:300]!r}")
    return pd.read_csv(StringIO(text))


def fetch_window(source: str, start_date: str, total_days: int) -> pd.DataFrame:
    """Chunk a window longer than 10 days into multiple <=10-day API calls."""
    chunks = []
    cursor = pd.Timestamp(start_date)
    remaining = total_days
    while remaining > 0:
        chunk_days = min(MAX_CHUNK, remaining)
        df = fetch_chunk(source, cursor.strftime("%Y-%m-%d"), chunk_days)
        if len(df):
            chunks.append(df)
        cursor += pd.Timedelta(days=chunk_days)
        remaining -= chunk_days
    return pd.concat(chunks, ignore_index=True) if chunks else pd.DataFrame()


def main() -> None:
    print(f"Requesting {SOURCE} for Punjab/Haryana bbox={BBOX}, "
          f"{WINDOW_DAYS} day(s) starting {WINDOW_START} ...")
    df = fetch_window(SOURCE, WINDOW_START, WINDOW_DAYS)

    print(f"\nRows returned: {len(df)}")
    if len(df) == 0:
        print("No detections in this window/bbox. Try a different WINDOW_START "
              "(e.g. during Oct-Nov stubble-burning season) or widen WINDOW_DAYS.")
        return

    print(f"Columns: {list(df.columns)}")
    print(f"Date range in response: {df['acq_date'].min()} to {df['acq_date'].max()}")

    if "confidence" in df.columns:
        print("\nConfidence value counts:")
        print(df["confidence"].value_counts())

    if "type" in df.columns:
        print("\nType value counts (0=vegetation fire, 1=volcano, 2=static, 3=offshore):")
        print(df["type"].value_counts())

    print("\nSample rows:")
    print(df.head())

    daily_counts = df.groupby("acq_date").size().sort_index()
    out_path = REPO_ROOT / "docs" / "firms_test_punjab_daily_counts.png"
    out_path.parent.mkdir(exist_ok=True)

    fig, ax = plt.subplots(figsize=(10, 4))
    daily_counts.plot(ax=ax, marker="o")
    ax.set_title(f"{SOURCE} raw detection counts — Punjab/Haryana bbox\n"
                 f"{WINDOW_START} + {WINDOW_DAYS} days")
    ax.set_xlabel("Date")
    ax.set_ylabel("Raw detection count")
    ax.grid(alpha=0.3)
    fig.tight_layout()
    fig.savefig(out_path, dpi=150)
    print(f"\nSaved plot to {out_path}")


if __name__ == "__main__":
    main()
