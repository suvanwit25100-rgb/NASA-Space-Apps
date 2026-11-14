"""
Produce the "before/after harmonisation" chart for the submission package
(CLAUDE.md §6): raw per-sensor detection counts vs. harmonised burning
cell-day counts, 2000-present, showing the 2012 VIIRS jump and how grid
aggregation (the "after" side) damps it.

Reads the outputs of fetch_and_aggregate.py — run that first.

Usage:
    python3 pipeline/plot_before_after.py --country India --start-year 2000 --end-year 2025
"""
import argparse
from pathlib import Path

import matplotlib.pyplot as plt
import pandas as pd

REPO_ROOT = Path(__file__).resolve().parent.parent


def load_inputs(country: str, start_year: int, end_year: int, data_dir: Path, res: int):
    raw_path = data_dir / f"daily_raw_counts_{country}_{start_year}_{end_year}.csv"
    cell_days_path = data_dir / f"cell_days_{country}_{start_year}_{end_year}_res{res}.parquet"

    daily_raw = pd.read_csv(raw_path, parse_dates=["acq_date"]).set_index("acq_date")
    cell_days = pd.read_parquet(cell_days_path)
    cell_days["date"] = pd.to_datetime(cell_days["date"])
    return daily_raw, cell_days


def monthly(series_or_df, date_col=None):
    if date_col is not None:
        return series_or_df.groupby(pd.Grouper(key=date_col, freq="MS")).size()
    return series_or_df.resample("MS").sum()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--country", default="India")
    parser.add_argument("--start-year", type=int, default=2000)
    parser.add_argument("--end-year", type=int, default=2025)
    parser.add_argument("--res", type=int, default=5)
    parser.add_argument("--data-dir", default=str(REPO_ROOT / "data"))
    args = parser.parse_args()

    data_dir = Path(args.data_dir)
    daily_raw, cell_days = load_inputs(args.country, args.start_year, args.end_year, data_dir, args.res)

    monthly_raw = monthly(daily_raw)
    monthly_total_raw = monthly_raw.sum(axis=1)

    # "after": burning cell-days per month, summed across sensors — a cell with
    # detections from both sensors on the same day still counts once per sensor
    # here (pre-calibration); step 4 in CLAUDE.md §4 is what removes double-count
    # across sensors. This still shows the damping effect of grid aggregation
    # within each sensor's raw point cloud.
    monthly_cell_days = monthly(cell_days, date_col="date")

    fig, axes = plt.subplots(2, 1, figsize=(12, 8), sharex=True)

    ax = axes[0]
    monthly_raw.plot(ax=ax)
    ax.axvline(pd.Timestamp("2012-01-20"), color="red", linestyle="--", alpha=0.6,
               label="VIIRS S-NPP comes online (2012-01-20)")
    ax.set_title(f"BEFORE: raw per-sensor detection counts — {args.country}, "
                 f"{args.start_year}-{args.end_year}")
    ax.set_ylabel("Raw detections / month")
    ax.legend()
    ax.grid(alpha=0.3)

    ax = axes[1]
    monthly_cell_days.plot(ax=ax, color="darkgreen")
    ax.axvline(pd.Timestamp("2012-01-20"), color="red", linestyle="--", alpha=0.6)
    ax.set_title(f"AFTER: harmonised burning cell-days (H3 res {args.res}), "
                 "summed across sensors — still pre-calibration")
    ax.set_ylabel("Burning cell-days / month")
    ax.set_xlabel("Month")
    ax.grid(alpha=0.3)

    fig.tight_layout()
    out_path = REPO_ROOT / "docs" / f"before_after_{args.country}.png"
    fig.savefig(out_path, dpi=150)
    print(f"Saved {out_path}")


if __name__ == "__main__":
    main()
