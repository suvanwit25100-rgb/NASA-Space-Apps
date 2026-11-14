"""
Cross-sensor calibration (CLAUDE.md §4 step 4): remove the 2012 sensor-switch
jump by learning a seasonal ratio between MODIS_AQUA and VIIRS_SNPP on their
overlap period, then applying it to the pre-VIIRS MODIS era to produce a
single continuous "VIIRS-equivalent" burning-cell-day series back to 2000.

Why Aqua, not Terra+Aqua combined: Aqua's ~1:30pm/am overpass matches VIIRS
S-NPP's ~1:30pm/am overpass, so a detection-rate ratio between them isolates
the sensor/resolution effect rather than mixing in a different overpass time.
Terra (~10:30am/pm) is calibrated separately against Aqua so the same chain
can reach back to 2000-2001, when Aqua (launched May 2002) doesn't exist yet.

Calibration is a seasonal ratio (by calendar month, averaged over overlap
years), not the full "per biome x season" quantile mapping in the plan —
biome stratification is flagged as follow-up (CLAUDE.md §8), reasonable to
skip for a single-country demo region.

Reads cell_days_<country>_<start>_<end>_res<res>.parquet from
fetch_and_aggregate.py (must have been run with the MODIS_TERRA/MODIS_AQUA
split). Writes a calibrated monthly series and a 3-panel comparison plot.

Usage:
    python3 pipeline/calibrate.py --country India --start-year 2000 --end-year 2025
"""
import argparse
from pathlib import Path

import matplotlib.pyplot as plt
import pandas as pd

REPO_ROOT = Path(__file__).resolve().parent.parent


def monthly_cell_days(cell_days: pd.DataFrame, sensor: str) -> pd.Series:
    sub = cell_days[cell_days["sensor"] == sensor]
    if sub.empty:
        return pd.Series(dtype=int)
    return sub.groupby(pd.Grouper(key="date", freq="MS")).size()


def seasonal_ratio(numerator: pd.Series, denominator: pd.Series) -> pd.Series:
    """Mean(numerator/denominator) per calendar month, over months where both exist."""
    both = pd.DataFrame({"num": numerator, "den": denominator}).dropna()
    both = both[both["den"] > 0]
    ratio_by_month = (both["num"] / both["den"]).groupby(both.index.month).mean()
    ratio_by_month.index.name = "month_of_year"
    return ratio_by_month


def apply_seasonal_ratio(series: pd.Series, ratio_by_month: pd.Series) -> pd.Series:
    return series * series.index.month.map(ratio_by_month)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--country", default="India")
    parser.add_argument("--start-year", type=int, default=2000)
    parser.add_argument("--end-year", type=int, default=2025)
    parser.add_argument("--res", type=int, default=5)
    parser.add_argument("--data-dir", default=str(REPO_ROOT / "data"))
    args = parser.parse_args()

    data_dir = Path(args.data_dir)
    cell_days_path = data_dir / f"cell_days_{args.country}_{args.start_year}_{args.end_year}_res{args.res}.parquet"
    cell_days = pd.read_parquet(cell_days_path)
    cell_days["date"] = pd.to_datetime(cell_days["date"])

    terra = monthly_cell_days(cell_days, "MODIS_TERRA")
    aqua = monthly_cell_days(cell_days, "MODIS_AQUA")
    viirs = monthly_cell_days(cell_days, "VIIRS_SNPP")

    # Step A: Aqua -> VIIRS ratio, learned on their overlap (2012+)
    viirs_over_aqua = seasonal_ratio(viirs, aqua)
    print("VIIRS/Aqua seasonal ratio by month:")
    print(viirs_over_aqua)

    # Step B: Terra -> Aqua ratio, learned on their overlap (2002-2011, pre-VIIRS)
    pre_viirs_cutoff = pd.Timestamp("2012-01-01")
    aqua_over_terra = seasonal_ratio(
        aqua[aqua.index < pre_viirs_cutoff], terra[terra.index < pre_viirs_cutoff]
    )
    print("\nAqua/Terra seasonal ratio by month (pre-2012 overlap):")
    print(aqua_over_terra)

    # Build the harmonised, VIIRS-equivalent series across the whole timeline:
    #   2012+           -> actual VIIRS_SNPP counts (ground truth, no estimation)
    #   2002-2011       -> Aqua counts * (VIIRS/Aqua ratio)        [one calibration hop]
    #   2000-2001       -> Terra counts * (Aqua/Terra) * (VIIRS/Aqua)  [two hops, more uncertain]
    harmonised = pd.Series(dtype=float)

    viirs_equiv_from_aqua = apply_seasonal_ratio(aqua, viirs_over_aqua)
    harmonised = pd.concat([harmonised, viirs_equiv_from_aqua[viirs_equiv_from_aqua.index < pre_viirs_cutoff]])

    aqua_equiv_from_terra = apply_seasonal_ratio(
        terra[terra.index < aqua.index.min()], aqua_over_terra
    )
    viirs_equiv_from_terra = apply_seasonal_ratio(aqua_equiv_from_terra, viirs_over_aqua)
    harmonised = pd.concat([harmonised, viirs_equiv_from_terra])

    harmonised = pd.concat([harmonised, viirs[viirs.index >= pre_viirs_cutoff]]).sort_index()
    harmonised = harmonised[~harmonised.index.duplicated(keep="last")]

    out_csv = data_dir / f"harmonised_monthly_{args.country}_{args.start_year}_{args.end_year}.csv"
    harmonised.rename("harmonised_burning_cell_days").to_csv(out_csv)
    print(f"\nWrote harmonised monthly series to {out_csv}")

    uncalibrated_total = pd.concat([terra, aqua, viirs], axis=1).fillna(0).sum(axis=1)
    uncalibrated_total.index.name = "date"

    fig, axes = plt.subplots(3, 1, figsize=(12, 11), sharex=True)
    jump_date = pd.Timestamp("2012-01-20")

    ax = axes[0]
    for series, label in [(terra, "MODIS Terra"), (aqua, "MODIS Aqua"), (viirs, "VIIRS S-NPP")]:
        series.plot(ax=ax, label=label)
    ax.axvline(jump_date, color="red", linestyle="--", alpha=0.6)
    ax.set_title(f"RAW: per-sensor burning cell-days/month — {args.country}")
    ax.legend()
    ax.grid(alpha=0.3)

    ax = axes[1]
    uncalibrated_total.plot(ax=ax, color="darkorange")
    ax.axvline(jump_date, color="red", linestyle="--", alpha=0.6)
    ax.set_title("UNCALIBRATED: sensors summed — jump still visible at 2012")
    ax.grid(alpha=0.3)

    ax = axes[2]
    harmonised.plot(ax=ax, color="darkgreen")
    ax.axvline(jump_date, color="red", linestyle="--", alpha=0.6,
               label="2012 sensor switch (now calibrated out)")
    ax.set_title("CALIBRATED: VIIRS-equivalent harmonised series")
    ax.set_xlabel("Month")
    ax.legend()
    ax.grid(alpha=0.3)

    fig.tight_layout()
    out_png = REPO_ROOT / "docs" / f"calibration_{args.country}.png"
    fig.savefig(out_png, dpi=150)
    print(f"Saved {out_png}")


if __name__ == "__main__":
    main()
