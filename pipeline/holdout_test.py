"""
Hold-out test of the cross-sensor calibration (CLAUDE.md method step 7): leave one year out.

For each held-out year, learn the seasonal ratio (one per calendar month, exactly as calibration.monthly_ratio does)
from the OTHER overlap years only, apply it to the held-out year's lower-resolution counts, and compare the prediction
with what the higher-resolution sensor actually saw that year. Two links of the calibration chain are tested:

  Aqua -> VIIRS   overlap Feb 2012 - Dec 2025, held-out years 2013-2025   (the 2000-2011 estimates rest on this link)
  Terra -> Aqua   overlap Aug 2002 - Dec 2011, held-out years 2003-2011   (the 2000-2002 estimates also rest on this)

Per area and held-out year: error of the predicted annual total, monthly correlation, and how often the actual month
fell inside the one-standard-deviation calibration band the app draws. A "naive" baseline (one ratio for the whole year)
is scored the same way, to show what the seasonal ratio buys.

Areas: the world and the 16 featured regions. Reads data/global/shards (fetch_global.py) and pipeline/cell_country.npz.
Writes app/public/data/holdout.json.   Usage: python3 pipeline/holdout_test.py
"""
import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd
from h3.api import numpy_int as h3i

sys.path.insert(0, str(Path(__file__).parent))
from build_global_products import AXIS_START, FEATURED, NDAYS, SHARDS, VIIRS_MIN_DETECTIONS  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "app" / "public" / "data" / "holdout.json"
NM = 12 * 26  # months 2000-01 .. 2025-12


def month_index():
    days = pd.date_range(AXIS_START, periods=NDAYS)
    return ((days.year - 2000) * 12 + days.month - 1).to_numpy(np.int64)


def ratio_table(num, den, months):
    """Seasonal ratio and relative spread per calendar month over the given month indices (as calibration.monthly_ratio)."""
    by = {m: [] for m in range(12)}
    for k in months:
        if den[k] > 0:
            by[k % 12].append(num[k] / den[k])
    allr = [r for v in by.values() for r in v]
    pooled = float(np.mean(allr)) if allr else np.nan
    ratio, rel = np.full(12, pooled), np.full(12, np.nan)
    for m, v in by.items():
        if v:
            ratio[m] = np.mean(v)
            rel[m] = np.std(v) / np.mean(v) if np.mean(v) > 0 else np.nan
    pooled_rel = np.nanmean(rel) if np.isfinite(rel).any() else 0.5
    return ratio, np.where(np.isfinite(rel), rel, pooled_rel), pooled


def score(num, den, test_year, train_months, test_months):
    ratio, rel, pooled = ratio_table(num, den, train_months)
    pred = np.array([den[k] * ratio[k % 12] for k in test_months])
    naive = np.array([den[k] * pooled for k in test_months])
    actual = np.array([num[k] for k in test_months], dtype=float)
    lo = np.array([den[k] * ratio[k % 12] * (1 - rel[k % 12]) for k in test_months])
    hi = np.array([den[k] * ratio[k % 12] * (1 + rel[k % 12]) for k in test_months])
    tot = actual.sum()
    if tot <= 0:
        return None
    corr = lambda a, b: float(np.corrcoef(a, b)[0, 1]) if a.std() > 0 and b.std() > 0 else np.nan
    return {
        "year": test_year,
        "totalErr": float(pred.sum() / tot - 1),
        "naiveTotalErr": float(naive.sum() / tot - 1),
        "monthlyR": corr(pred, actual),
        "naiveMonthlyR": corr(naive, actual),
        "coverage": float(((actual >= lo) & (actual <= hi)).mean()),
    }


def summarise(rows):
    rows = [r for r in rows if r]
    if not rows:
        return None
    f = lambda k: [r[k] for r in rows if np.isfinite(r[k])]
    return {
        "years": len(rows),
        "medAbsTotalErr": float(np.median(np.abs(f("totalErr")))),
        "medAbsNaiveTotalErr": float(np.median(np.abs(f("naiveTotalErr")))),
        "meanMonthlyR": float(np.mean(f("monthlyR"))),
        "meanNaiveMonthlyR": float(np.mean(f("naiveMonthlyR"))),
        "bandCoverage": float(np.mean(f("coverage"))),
        "perYear": [{k: (round(v, 3) if isinstance(v, float) else v) for k, v in r.items()} for r in rows],
    }


def main():
    shard_files = sorted(p for p in SHARDS.glob("*.parquet") if not p.stem.endswith("_cc"))
    z = np.load(Path(__file__).parent / "cell_country.npz")
    uniq, cell_country = z["h3"], z["cidx"].astype(np.int64)
    names = json.loads((Path(__file__).parent / "countries.json").read_text())
    alpha3 = list(names)
    ll = np.array([h3i.cell_to_latlng(int(x)) for x in uniq])
    lat, lon = ll[:, 0], ll[:, 1]
    masks = {"world": np.ones(len(uniq), bool)}
    for fid, _, bbox, restrict in FEATURED:
        m = (lon >= bbox[0]) & (lon <= bbox[2]) & (lat >= bbox[1]) & (lat <= bbox[3])
        if restrict:
            m &= np.isin(cell_country, [alpha3.index(a) for a in restrict])
        masks[fid] = m
    midx = month_index()
    monthly = {a: np.zeros((3, NM)) for a in masks}
    for p in shard_files:
        df = pd.read_parquet(p, columns=["h3", "day", "sensor", "n"])
        df = df[(df["sensor"] != 2) | (df["n"] >= VIIRS_MIN_DETECTIONS)]  # MODIS-equivalent VIIRS, as in the products
        pos = np.searchsorted(uniq, df["h3"].to_numpy(np.uint64))
        pos = np.clip(pos, 0, len(uniq) - 1)
        ok = uniq[pos] == df["h3"].to_numpy(np.uint64)
        sensor = df["sensor"].to_numpy(np.int64)[ok]
        mo = midx[df["day"].to_numpy(np.int64)[ok]]
        pos = pos[ok]
        for a, m in masks.items():
            sel = m[pos]
            if sel.any():
                monthly[a] += np.bincount(sensor[sel] * NM + mo[sel], minlength=3 * NM).reshape(3, NM)
        print("  ", p.name, flush=True)

    ym = lambda y, mo: (y - 2000) * 12 + mo  # month index
    results = {}
    for a in masks:
        T, A, V = monthly[a]
        v_months = list(range(ym(2012, 1), NM))  # Feb 2012 on
        a_months = list(range(ym(2002, 7), ym(2012, 0)))  # Aug 2002 - Dec 2011
        av = [score(V, A, y, [k for k in v_months if k // 12 + 2000 != y], [ym(y, m) for m in range(12)]) for y in range(2013, 2026)]
        ta = [score(A, T, y, [k for k in a_months if k // 12 + 2000 != y], [ym(y, m) for m in range(12)]) for y in range(2003, 2012)]
        results[a] = {"aquaToViirs": summarise(av), "terraToAqua": summarise(ta), "monthlyCellDays": {"viirs": int(V.sum()), "aqua": int(A.sum())}}
    OUT.write_text(json.dumps(results))
    for a in ("world", "punjab-haryana", "amazon-arc", "california", "boreal-canada"):
        s = results[a]["aquaToViirs"]
        print(a, "Aqua->VIIRS", {k: round(v, 3) for k, v in s.items() if k not in ("perYear", "years")})


if __name__ == "__main__":
    main()
