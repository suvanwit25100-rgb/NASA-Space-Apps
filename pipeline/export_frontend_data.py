"""
Export compact, browser-ready data for the web app from the cell-day parquet.

Per AOI (bbox over H3 cell centroids) it recomputes the CLAUDE.md §4 step-4
calibration (seasonal Aqua->VIIRS and Terra->Aqua ratios, learned inside that
AOI) and writes a daily VIIRS-equivalent series plus a calibration-uncertainty
band (step 6): for estimated (pre-2012) days the band is value x relative
spread of the per-year monthly ratio, chained in quadrature for the Terra-only
years; measured VIIRS days carry no calibration band.

Also writes map data: H3 ids, plus sparse (cell, year-month) burning-day counts
from the best sensor available that month (VIIRS 2012+, else Aqua, else Terra),
as a little-endian binary: uint16 cell, uint16 year-month index, uint8 days.

Usage:
    python3 pipeline/export_frontend_data.py --country India
"""
import argparse
import json
from pathlib import Path

import h3
import numpy as np
import pandas as pd

REPO_ROOT = Path(__file__).resolve().parent.parent
AXIS_START = pd.Timestamp("2000-01-01")

AOIS = [
    {"id": "india", "name": "India (all)", "bbox": [68.0, 6.0, 98.0, 36.0]},
    {"id": "punjab-haryana", "name": "Punjab & Haryana", "bbox": [73.8, 27.6, 77.7, 32.6]},
    {"id": "indo-gangetic", "name": "Indo-Gangetic Plain", "bbox": [74.0, 24.0, 88.5, 32.6]},
    {"id": "central-india", "name": "Central India forests", "bbox": [76.0, 17.5, 84.5, 24.0]},
    {"id": "northeast", "name": "Northeast India", "bbox": [89.5, 21.5, 97.5, 29.5]},
    {"id": "peninsular", "name": "Peninsular India", "bbox": [73.0, 8.0, 80.8, 17.5]},
]


def in_bbox(lat, lon, bbox):
    return (lon >= bbox[0]) & (lon <= bbox[2]) & (lat >= bbox[1]) & (lat <= bbox[3])


def monthly_ratio(num: pd.Series, den: pd.Series):
    both = pd.DataFrame({"n": num, "d": den}).dropna()
    both = both[both["d"] > 0]
    r = both["n"] / both["d"]
    g = r.groupby(r.index.month)
    mean = g.mean().reindex(range(1, 13))
    rel = (g.std(ddof=0) / g.mean()).reindex(range(1, 13))
    # months with no overlap data: fall back to the pooled value
    return mean.fillna(r.mean()), rel.fillna(rel.mean() if rel.notna().any() else 0.5).fillna(0.5)


def aoi_series(daily: pd.DataFrame) -> dict:
    """daily: index=date, columns MODIS_TERRA/MODIS_AQUA/VIIRS_SNPP (cell-days/day)."""
    monthly = daily.resample("MS").sum()
    # full months only: VIIRS starts 20 Jan 2012 and Aqua 4 Jul 2002, so their first months are partial
    v_over_a, v_over_a_rel = monthly_ratio(monthly["VIIRS_SNPP"][monthly.index >= "2012-02-01"],
                                           monthly["MODIS_AQUA"])
    pre = (monthly.index >= "2002-08-01") & (monthly.index < "2012-01-01")
    a_over_t, a_over_t_rel = monthly_ratio(monthly["MODIS_AQUA"][pre], monthly["MODIS_TERRA"][pre])

    days = pd.date_range(AXIS_START, daily.index.max(), freq="D")
    d = daily.reindex(days).fillna(0)
    month = days.month
    val = np.full(len(days), np.nan)
    rel = np.zeros(len(days))

    viirs = days >= "2012-01-20"
    aqua_era = (days < "2012-01-20") & (days >= "2002-07-01")
    terra_era = (days < "2002-07-01") & (days >= "2000-11-01")

    val[viirs] = d["VIIRS_SNPP"].to_numpy()[viirs]
    vr = v_over_a.reindex(month).to_numpy()
    ar = a_over_t.reindex(month).to_numpy()
    vrel = v_over_a_rel.reindex(month).to_numpy()
    arel = a_over_t_rel.reindex(month).to_numpy()

    val[aqua_era] = d["MODIS_AQUA"].to_numpy()[aqua_era] * vr[aqua_era]
    rel[aqua_era] = vrel[aqua_era]
    val[terra_era] = d["MODIS_TERRA"].to_numpy()[terra_era] * ar[terra_era] * vr[terra_era]
    rel[terra_era] = np.sqrt(vrel[terra_era] ** 2 + arel[terra_era] ** 2)

    lo = np.maximum(val * (1 - rel), 0)
    hi = val * (1 + rel)
    r1 = lambda a: [None if np.isnan(x) else round(float(x), 1) for x in a]
    return {
        "values": r1(val), "lo": r1(lo), "hi": r1(hi),
        "ratios": {"viirs_over_aqua": [round(float(x), 2) for x in v_over_a],
                   "aqua_over_terra": [round(float(x), 2) for x in a_over_t]},
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--country", default="India")
    parser.add_argument("--start-year", type=int, default=2000)
    parser.add_argument("--end-year", type=int, default=2025)
    parser.add_argument("--res", type=int, default=5)
    args = parser.parse_args()

    src = REPO_ROOT / "data" / f"cell_days_{args.country}_{args.start_year}_{args.end_year}_res{args.res}.parquet"
    df = pd.read_parquet(src)
    df["date"] = pd.to_datetime(df["date"])

    cells = sorted(df["h3_cell"].unique())
    cell_idx = {c: i for i, c in enumerate(cells)}
    latlon = np.array([h3.cell_to_latlng(c) for c in cells])
    lat_of = dict(zip(cells, latlon[:, 0]))
    lon_of = dict(zip(cells, latlon[:, 1]))
    df["lat"] = df["h3_cell"].map(lat_of)
    df["lon"] = df["h3_cell"].map(lon_of)

    out = REPO_ROOT / "app" / "public" / "data"
    out.mkdir(parents=True, exist_ok=True)

    aois_out = []
    for aoi in AOIS:
        sub = df[in_bbox(df["lat"], df["lon"], aoi["bbox"])]
        daily = (sub.groupby(["date", "sensor"]).size().unstack(fill_value=0)
                 .reindex(columns=["MODIS_TERRA", "MODIS_AQUA", "VIIRS_SNPP"], fill_value=0))
        series = aoi_series(daily)
        aois_out.append({**aoi, "cells": int(sub["h3_cell"].nunique()), **series})
        print(f"{aoi['id']}: {aoi_cells} cells" if (aoi_cells := sub["h3_cell"].nunique()) else f"{aoi['id']}: empty")

    meta = {
        "axisStart": AXIS_START.strftime("%Y-%m-%d"),
        "axisEnd": df["date"].max().strftime("%Y-%m-%d"),
        "firstMeasured": "2000-11-01", "viirsStart": "2012-01-20", "aquaStart": "2002-07-01",
        "res": args.res, "country": args.country,
    }
    (out / "aois.json").write_text(json.dumps({"meta": meta, "aois": aois_out}, separators=(",", ":")))
    (out / "cells.json").write_text(json.dumps(cells, separators=(",", ":")))

    # map: best sensor per (cell, year-month)
    df["ym"] = (df["date"].dt.year - 2000) * 12 + df["date"].dt.month - 1
    rank = {"VIIRS_SNPP": 0, "MODIS_AQUA": 1, "MODIS_TERRA": 2}
    df["rank"] = df["sensor"].map(rank)
    month_rank = df.groupby(["ym"])["rank"].transform("min")
    best = df[df["rank"] == month_rank]
    agg = best.groupby(["h3_cell", "ym"]).size().reset_index(name="days")
    arr = np.zeros(len(agg), dtype=[("c", "<u2"), ("m", "<u2"), ("d", "u1")])
    arr["c"] = agg["h3_cell"].map(cell_idx).to_numpy()
    arr["m"] = agg["ym"].to_numpy()
    arr["d"] = agg["days"].clip(upper=31).to_numpy()
    (out / "cell_months.bin").write_bytes(arr.tobytes())
    print(f"cells={len(cells)} cell-month rows={len(arr)} bin={arr.nbytes/1e6:.1f}MB")

    # cell-days per sensor for in-browser calibration of custom areas: for each sensor,
    # uint16 cell indices then uint16 day indices (days since 2000-01-01), sorted by day
    parts, counts = [], {}
    for sensor in ["MODIS_TERRA", "MODIS_AQUA", "VIIRS_SNPP"]:
        sub = df[df["sensor"] == sensor].copy()
        sub["day"] = (sub["date"] - AXIS_START).dt.days
        sub = sub.sort_values(["day", "h3_cell"])
        parts.append(sub["h3_cell"].map(cell_idx).to_numpy().astype("<u2").tobytes())
        parts.append(sub["day"].to_numpy().astype("<u2").tobytes())
        counts[sensor] = len(sub)
    (out / "cell_days.bin").write_bytes(b"".join(parts))
    meta["cellDays"] = counts
    (out / "aois.json").write_text(json.dumps({"meta": meta, "aois": aois_out}, separators=(",", ":")))
    print("cell_days.bin", counts)


if __name__ == "__main__":
    main()
