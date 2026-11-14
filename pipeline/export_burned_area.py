"""
Export the independent burned-area references for the in-app overlay (Seasons page).

For each validated region, the monthly seasonal profile (share of the year's burned area per calendar month) from
GFED4.1s over 2000-11 to 2016-12 (the years GFED publishes a burned-area product), and for India also NASA MCD64A1
over 2001-2025. The app computes the matching profile from the harmonised series over the same months and draws both.

Reads data/gfed_regions_monthly.csv and data/mcd64a1_monthly_India_2000_2025.csv (see validate_regions_gfed.py and
validate_against_mcd64a1.py). Writes app/public/data/burned_area.json.
"""
import json
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parent.parent


def profile(s: pd.Series) -> list:
    clim = s.groupby(s.index.month).mean()
    clim = clim / clim.sum()
    return [round(float(clim.get(m, 0.0)), 4) for m in range(1, 13)]


def main():
    g = pd.read_csv(ROOT / "data" / "gfed_regions_monthly.csv", parse_dates=["date"])
    out = {}
    for rid, grp in g.groupby("region"):
        s = grp.set_index("date")["km2"].sort_index()
        s = s[(s.index >= "2000-11-01") & (s.index <= "2016-12-31")]
        out[rid] = {"gfed": profile(s), "gfedFrom": "2000-11", "gfedTo": "2016-12"}
    m = pd.read_csv(ROOT / "data" / "mcd64a1_monthly_India_2000_2025.csv", parse_dates=["date"]).set_index("date")["burned_area_km2"].dropna()
    m = m[(m.index >= "2001-01-01") & (m.index <= "2025-12-31")]
    out.setdefault("ind", {})["mcd"] = profile(m)
    out["ind"]["mcdFrom"], out["ind"]["mcdTo"] = "2001-01", "2025-12"
    (ROOT / "app" / "public" / "data" / "burned_area.json").write_text(json.dumps(out))
    print({k: list(v) for k, v in out.items()})


if __name__ == "__main__":
    main()
