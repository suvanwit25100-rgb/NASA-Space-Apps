"""
Validation (CLAUDE.md §4 step 7): cross-check our harmonised burning-cell-day
seasonality against GFED4.1s monthly burned area, an independent dataset
built from MCD64A1 (MODIS Burned Area) plus a statistical small-fire model —
not the same pipeline as our FIRMS active-fire detections, so agreement in
seasonal shape is a genuine external check, not a tautology.

Source: GFED4.1s per-year HDF5 files (0.25 deg global grid, burned_fraction
per month + grid_cell_area), fetched over SFTP from the GFED team's own
public distribution server (credentials are published openly on
https://www.globalfiredata.org/data.html for exactly this purpose — this is
the project's standard anonymous bulk-download mechanism, not a personal
account). Each year file (~70-100MB) is downloaded, summed over the India
bbox, and deleted immediately — nothing raw is kept on disk.

Usage:
    python3 pipeline/validate_against_gfed.py --start-year 2000 --end-year 2025
"""
import argparse
from pathlib import Path

import h5py
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import paramiko

REPO_ROOT = Path(__file__).resolve().parent.parent

SFTP_HOST = "ftp.prd.dip.wur.nl"
SFTP_PORT = 1022
SFTP_USER = "sftp0041-1-r"
SFTP_PASS = "akU8%S2Fewr!PspDVBqd&s4Y9L&@C9wCd*B"

# Approximate India bounding box (lon_min, lat_min, lon_max, lat_max) —
# matches the "India" country scope used by the FIRMS country archives.
INDIA_BBOX = (68.0, 6.0, 98.0, 36.0)


def gfed_filename(year: int) -> str:
    # 2017 onward are published as "_beta"
    suffix = "_beta" if year >= 2017 else ""
    return f"GFED4.1s_{year}{suffix}.hdf5"


def fetch_year_file(sftp: paramiko.SFTPClient, year: int, local_dir: Path) -> Path:
    local_path = local_dir / gfed_filename(year)
    sftp.get(f"GFED4s/{gfed_filename(year)}", str(local_path))
    return local_path


def monthly_burned_area_for_bbox(path: Path, bbox) -> dict | None:
    """Returns None if this year's file has no burned_area group at all —
    true for GFED4.1s "_beta" years (2017+), which dropped the MCD64A1-based
    burned-area product and derive emissions from active-fire detections
    instead (documented on globalfiredata.org, not a bug on our end)."""
    lon_min, lat_min, lon_max, lat_max = bbox
    with h5py.File(path, "r") as f:
        if "burned_area" not in f:
            return None
        lat = f["lat"][:]
        lon = f["lon"][:]
        mask = (lat >= lat_min) & (lat <= lat_max) & (lon >= lon_min) & (lon <= lon_max)
        area_m2 = f["ancill/grid_cell_area"][:]

        monthly = {}
        for month in range(1, 13):
            key = f"{month:02d}"
            burned_fraction = f[f"burned_area/{key}/burned_fraction"][:]
            burned_km2 = (burned_fraction * area_m2 / 1e6)[mask].sum()
            monthly[month] = burned_km2
    return monthly


def run(start_year: int, end_year: int, out_dir: Path) -> pd.Series:
    out_dir.mkdir(parents=True, exist_ok=True)
    cache_dir = out_dir / "gfed_cache"
    cache_dir.mkdir(exist_ok=True)

    transport = paramiko.Transport((SFTP_HOST, SFTP_PORT))
    transport.connect(username=SFTP_USER, password=SFTP_PASS)
    sftp = paramiko.SFTPClient.from_transport(transport)

    rows = []
    try:
        for year in range(start_year, end_year + 1):
            print(f"[GFED] fetching {gfed_filename(year)} ...")
            try:
                local_path = fetch_year_file(sftp, year, cache_dir)
            except FileNotFoundError:
                print(f"  not published for {year}, skipping")
                continue
            monthly = monthly_burned_area_for_bbox(local_path, INDIA_BBOX)
            local_path.unlink()  # discard the raw grid file once summarised
            if monthly is None:
                print(f"  no burned_area product in this file (beta-era methodology change), skipping")
                continue
            for month, burned_km2 in monthly.items():
                rows.append({"date": pd.Timestamp(year=year, month=month, day=1), "burned_area_km2": burned_km2})
            print(f"  India annual total: {sum(monthly.values()):,.0f} km^2")
    finally:
        sftp.close()
        transport.close()

    series = pd.DataFrame(rows).set_index("date")["burned_area_km2"].sort_index()
    out_csv = out_dir / f"gfed_monthly_India_{start_year}_{end_year}.csv"
    series.to_csv(out_csv)
    print(f"\nWrote {out_csv}")
    return series


def climatology(series: pd.Series) -> pd.Series:
    """Mean by calendar month, normalised to sum to 1 (shape only, not magnitude)."""
    by_month = series.groupby(series.index.month).mean()
    return by_month / by_month.sum()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--start-year", type=int, default=2000)
    parser.add_argument("--end-year", type=int, default=2025)
    parser.add_argument("--data-dir", default=str(REPO_ROOT / "data"))
    parser.add_argument("--reuse", action="store_true", help="reuse the saved GFED monthly CSV instead of re-downloading")
    args = parser.parse_args()

    data_dir = Path(args.data_dir)
    saved = data_dir / f"gfed_monthly_India_{args.start_year}_{args.end_year}.csv"
    if args.reuse and saved.exists():
        gfed_monthly = pd.read_csv(saved, index_col=0, parse_dates=True)["burned_area_km2"]
    else:
        gfed_monthly = run(args.start_year, args.end_year, data_dir)

    harmonised_path = data_dir / f"harmonised_monthly_India_{args.start_year}_{args.end_year}.csv"
    harmonised = pd.read_csv(harmonised_path, index_col=0, parse_dates=True)["harmonised_burning_cell_days"]

    gfed_clim = climatology(gfed_monthly)
    harmonised_clim = climatology(harmonised)

    corr = np.corrcoef(gfed_clim.reindex(range(1, 13)), harmonised_clim.reindex(range(1, 13)))[0, 1]
    print(f"\nSeasonal climatology correlation (GFED burned area vs. harmonised cell-days): {corr:.3f}")

    fig, axes = plt.subplots(2, 1, figsize=(10, 8))

    ax = axes[0]
    months = range(1, 13)
    ax.plot(months, gfed_clim.reindex(months), marker="o", label="GFED4.1s burned area (independent)")
    ax.plot(months, harmonised_clim.reindex(months), marker="s", label="Our harmonised cell-days")
    ax.set_xticks(list(months))
    ax.set_xlabel("Month of year")
    ax.set_ylabel("Share of annual total")
    ax.set_title(f"Seasonal climatology comparison — India\ncorrelation = {corr:.3f}")
    ax.legend()
    ax.grid(alpha=0.3)

    ax = axes[1]
    gfed_norm = gfed_monthly / gfed_monthly.max()
    harmonised_norm = harmonised / harmonised.max()
    gfed_norm.plot(ax=ax, label="GFED4.1s burned area (normalised)")
    harmonised_norm.plot(ax=ax, label="Our harmonised cell-days (normalised)")
    ax.set_title("Full time series, each normalised to its own peak")
    ax.set_xlabel("Month")
    ax.legend()
    ax.grid(alpha=0.3)

    fig.tight_layout()
    out_png = REPO_ROOT / "docs" / "validation_vs_gfed_India.png"
    fig.savefig(out_png, dpi=150)
    print(f"Saved {out_png}")


if __name__ == "__main__":
    main()
