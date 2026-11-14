"""
Multi-region validation (CLAUDE.md section 4 step 7): compare our harmonised monthly series with GFED4.1s
monthly burned area in every featured region, across very different fire regimes (savanna, boreal, peat,
Mediterranean, agricultural). GFED has a burned-area product for 2000-2016, so that is the comparison window.

Step 1 (--fetch-only, no dependency on our data) extracts GFED regional monthly burned area over SFTP into
data/gfed_regions_monthly.csv; each year file is deleted after summarising. The SFTP credentials are the ones
GFED publishes openly for exactly this bulk download (see the constants below).
Step 2 compares with app/public/data/series/<id>.json.gz and writes docs/validation_regions_gfed.png and
app/public/data/validation.json.

Usage:
    python3 pipeline/validate_regions_gfed.py --fetch-only
    python3 pipeline/validate_regions_gfed.py
"""
import argparse
import gzip
import json
import os
import sys
from pathlib import Path

import h5py
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import paramiko

sys.path.insert(0, str(Path(__file__).parent))
from build_global_products import FEATURED  # noqa: E402

REPO_ROOT = Path(__file__).resolve().parent.parent
CACHE = REPO_ROOT / "data" / "gfed_regions_monthly.csv"
SERIES = REPO_ROOT / "app" / "public" / "data" / "series"
# GFED publishes this read-only bulk-download login at https://www.globalfiredata.org/ancill/GFED5_SFTP_info.txt;
# export it as GFED_SFTP_USER / GFED_SFTP_PASS.
HOST = os.environ.get("GFED_SFTP_HOST", "ftp.prd.dip.wur.nl")
PORT = int(os.environ.get("GFED_SFTP_PORT", "1022"))
USER = os.environ.get("GFED_SFTP_USER", "")
PASS = os.environ.get("GFED_SFTP_PASS", "")

# India as a whole (bbox, compared with the IND country series) plus every global featured region
REGIONS = [("ind", "India", [68.0, 6.0, 98.0, 36.0])] + [(fid, name, bbox) for fid, name, bbox, restrict in FEATURED if not restrict]


def fetch() -> pd.DataFrame:
    done = pd.read_csv(CACHE, parse_dates=["date"]) if CACHE.exists() else pd.DataFrame(columns=["region", "date", "km2"])
    have_years = set(done["date"].dt.year) if len(done) else set()
    if all(y in have_years for y in range(2000, 2017)):
        return done
    if not (USER and PASS):
        sys.exit("Set GFED_SFTP_USER and GFED_SFTP_PASS (published at https://www.globalfiredata.org/ancill/GFED5_SFTP_info.txt)")
    t = paramiko.Transport((HOST, PORT))
    t.connect(username=USER, password=PASS)
    sftp = paramiko.SFTPClient.from_transport(t)
    rows = done.to_dict("records")
    try:
        for year in range(2000, 2017):
            if year in have_years:
                continue
            local = CACHE.parent / f"_gfed_{year}.hdf5"
            print(f"[GFED] {year}", flush=True)
            sftp.get(f"GFED4s/GFED4.1s_{year}.hdf5", str(local))
            with h5py.File(local, "r") as f:
                lat, lon, area = f["lat"][:], f["lon"][:], f["ancill/grid_cell_area"][:]
                masks = {rid: (lon >= b[0]) & (lon <= b[2]) & (lat >= b[1]) & (lat <= b[3]) for rid, _, b in REGIONS}
                for month in range(1, 13):
                    km2 = f[f"burned_area/{month:02d}/burned_fraction"][:] * area / 1e6
                    for rid, m in masks.items():
                        rows.append({"region": rid, "date": pd.Timestamp(year=year, month=month, day=1), "km2": float(km2[m].sum())})
            local.unlink()
            pd.DataFrame(rows).to_csv(CACHE, index=False)
    finally:
        sftp.close()
        t.close()
    return pd.DataFrame(rows)


def load_series(rid: str) -> pd.Series:
    d = json.loads(gzip.decompress((SERIES / f"{rid}.json.gz").read_bytes()))
    s = pd.Series([np.nan if v is None else v for v in d["values"]], index=pd.date_range("2000-01-01", periods=len(d["values"])))
    return s.resample("MS").sum(min_count=28)


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--fetch-only", action="store_true")
    args = p.parse_args()
    gfed = fetch()
    if args.fetch_only:
        return

    results, fig_axes = [], []
    n = len(REGIONS)
    cols = 4
    fig, axes = plt.subplots((n + cols - 1) // cols, cols, figsize=(16, 3.2 * ((n + cols - 1) // cols)), squeeze=False)
    for ax in axes.ravel()[n:]:
        ax.axis("off")
    for (rid, name, _), ax in zip(REGIONS, axes.ravel()):
        g = gfed[gfed["region"] == rid].set_index("date")["km2"].sort_index()
        s = load_series(rid)
        j = pd.concat([g.rename("gfed"), s.rename("ours")], axis=1).dropna()
        j = j[(j.index >= "2000-11-01") & (j.index <= "2016-12-31")]
        monthly_r = j["gfed"].corr(j["ours"])
        clim = lambda x: x.groupby(x.index.month).mean() / x.groupby(x.index.month).mean().sum()
        cg, co = clim(j["gfed"]), clim(j["ours"])
        clim_r = float(np.corrcoef(cg, co)[0, 1])
        results.append({"id": rid, "name": name, "monthlyR": round(float(monthly_r), 3), "climatologyR": round(clim_r, 3), "months": int(len(j))})
        ax.plot(range(1, 13), cg, marker="o", label="GFED burned area")
        ax.plot(range(1, 13), co, marker="s", label="Our harmonised series")
        ax.set_title(f"{name}\nseasonal r = {clim_r:.2f}, monthly r = {monthly_r:.2f}", fontsize=10)
        ax.set_xticks(range(1, 13, 2))
        ax.grid(alpha=0.3)
    axes.ravel()[0].legend(fontsize=8)
    fig.suptitle("Seasonal cycle: harmonised fire detections vs GFED4.1s burned area, 2000-2016", y=1.0)
    fig.tight_layout()
    out = REPO_ROOT / "docs" / "validation_regions_gfed.png"
    fig.savefig(out, dpi=140)
    (REPO_ROOT / "app" / "public" / "data" / "validation.json").write_text(json.dumps({"gfedRegions": results}, indent=1))
    print(pd.DataFrame(results).to_string(index=False))
    print(f"Saved {out}")


if __name__ == "__main__":
    main()
