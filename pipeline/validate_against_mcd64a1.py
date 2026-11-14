"""
Validation (CLAUDE.md §4 step 7) against NASA's MCD64A1 (MODIS Burned Area,
Collection 6.1, 500 m, monthly), read as cloud-optimised GeoTIFFs from the
Microsoft Planetary Computer STAC (collection modis-64A1-061). MCD64A1 is a
NASA product from a different algorithm (burn-date change detection on
surface reflectance) than FIRMS active-fire detections, so seasonal agreement
is an independent check.

Per month: for each MODIS sinusoidal tile intersecting the bbox, count pixels
with Burn_Date > 0 whose centre falls inside the bbox, multiplied by the
(constant) pixel area. Same bbox as validate_against_gfed.py so the two
validations are comparable; note it also includes parts of neighbouring
countries, unlike the FIRMS "India" country archive.

Resumable: months already in the output CSV are skipped.

Usage:
    python3 pipeline/validate_against_mcd64a1.py --start-year 2000 --end-year 2025
"""
import argparse
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import planetary_computer
import pystac_client
import rasterio

REPO_ROOT = Path(__file__).resolve().parent.parent
BBOX = (68.0, 6.0, 98.0, 36.0)  # lon_min, lat_min, lon_max, lat_max
STAC_URL = "https://planetarycomputer.microsoft.com/api/stac/v1"
EARTH_R = 6371007.181  # MODIS sinusoidal sphere radius (m)

_mask_cache: dict = {}


def tile_bbox_mask(src: rasterio.DatasetReader, key: str) -> np.ndarray:
    """Boolean mask of pixels whose centre lies inside BBOX (cached per tile)."""
    if key not in _mask_cache:
        rows, cols = np.mgrid[0:src.height, 0:src.width]
        xs, ys = rasterio.transform.xy(src.transform, rows.ravel(), cols.ravel(), offset="center")
        xs, ys = np.array(xs).reshape(rows.shape), np.array(ys).reshape(rows.shape)
        lat = np.degrees(ys / EARTH_R)
        lon = np.degrees(xs / (EARTH_R * np.cos(np.radians(lat))))
        lon_min, lat_min, lon_max, lat_max = BBOX
        _mask_cache[key] = (lat >= lat_min) & (lat <= lat_max) & (lon >= lon_min) & (lon <= lon_max)
    return _mask_cache[key]


def burned_pixels(item) -> tuple[int, float]:
    href = item.assets["Burn_Date"].href
    tile_key = item.id.split(".")[2]
    with rasterio.open(href) as src:
        arr = src.read(1)
        pixel_km2 = abs(src.res[0] * src.res[1]) / 1e6
        mask = tile_bbox_mask(src, tile_key)
    return int(((arr > 0) & mask).sum()), pixel_km2


def month_burned_km2(catalog, year: int, month: int) -> float:
    start = pd.Timestamp(year=year, month=month, day=1)
    end = start + pd.offsets.MonthEnd(0)
    items = list(catalog.search(
        collections=["modis-64A1-061"], bbox=BBOX,
        datetime=f"{start:%Y-%m-%d}/{end:%Y-%m-%d}",
    ).items())
    if not items:
        return float("nan")
    with ThreadPoolExecutor(max_workers=8) as pool:
        results = list(pool.map(burned_pixels, items))
    return sum(n * area for n, area in results)


def run(start_year: int, end_year: int, out_csv: Path) -> pd.Series:
    done = {}
    if out_csv.exists():
        done = pd.read_csv(out_csv, index_col=0, parse_dates=True)["burned_area_km2"].to_dict()

    catalog = pystac_client.Client.open(STAC_URL, modifier=planetary_computer.sign_inplace)
    for year in range(start_year, end_year + 1):
        for month in range(1, 13):
            date = pd.Timestamp(year=year, month=month, day=1)
            if date in done:
                continue
            km2 = month_burned_km2(catalog, year, month)
            done[date] = km2
            print(f"{date:%Y-%m}: {km2:,.0f} km^2", flush=True)
            pd.Series(done, name="burned_area_km2").sort_index().to_csv(out_csv, index_label="date")
    return pd.Series(done, name="burned_area_km2").sort_index().dropna()


def climatology(series: pd.Series) -> pd.Series:
    by_month = series.groupby(series.index.month).mean()
    return by_month / by_month.sum()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--start-year", type=int, default=2000)
    parser.add_argument("--end-year", type=int, default=2025)
    parser.add_argument("--data-dir", default=str(REPO_ROOT / "data"))
    args = parser.parse_args()

    data_dir = Path(args.data_dir)
    out_csv = data_dir / f"mcd64a1_monthly_India_{args.start_year}_{args.end_year}.csv"
    mcd = run(args.start_year, args.end_year, out_csv)

    harmonised = pd.read_csv(
        data_dir / f"harmonised_monthly_India_{args.start_year}_{args.end_year}.csv",
        index_col=0, parse_dates=True,
    )["harmonised_burning_cell_days"]

    months = range(1, 13)
    mcd_clim = climatology(mcd).reindex(months)
    har_clim = climatology(harmonised).reindex(months)
    clim_corr = np.corrcoef(mcd_clim, har_clim)[0, 1]

    joined = pd.concat([mcd.rename("mcd"), harmonised.rename("har")], axis=1).dropna()
    monthly_corr = joined["mcd"].corr(joined["har"])
    print(f"\nClimatology correlation: {clim_corr:.3f}")
    print(f"Monthly time-series correlation ({len(joined)} months): {monthly_corr:.3f}")

    fig, axes = plt.subplots(2, 1, figsize=(10, 8))
    ax = axes[0]
    ax.plot(months, mcd_clim, marker="o", label="NASA MCD64A1 burned area")
    ax.plot(months, har_clim, marker="s", label="Our harmonised cell-days")
    ax.set_xticks(list(months))
    ax.set_xlabel("Month of year")
    ax.set_ylabel("Share of annual total")
    ax.set_title(f"Seasonal climatology vs MCD64A1 — r = {clim_corr:.3f}")
    ax.legend()
    ax.grid(alpha=0.3)

    ax = axes[1]
    (mcd / mcd.max()).plot(ax=ax, label="MCD64A1 (normalised)")
    (harmonised / harmonised.max()).plot(ax=ax, label="Harmonised cell-days (normalised)")
    ax.set_title(f"Monthly series, each normalised to its peak — r = {monthly_corr:.3f}")
    ax.legend()
    ax.grid(alpha=0.3)

    fig.tight_layout()
    out_png = REPO_ROOT / "docs" / "validation_vs_mcd64a1_India.png"
    fig.savefig(out_png, dpi=150)
    print(f"Saved {out_png}")


if __name__ == "__main__":
    main()
