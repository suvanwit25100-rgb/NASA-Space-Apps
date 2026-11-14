"""
Shared per-area calibration (CLAUDE.md section 4 steps 4 and 6): turn daily per-sensor burning
cell-day counts into a single VIIRS-equivalent daily series plus a calibration-uncertainty band.
The browser has a line-for-line JS port (app/src/lib/aoi.js); keep the two in step.
"""
import numpy as np
import pandas as pd

AXIS_START = pd.Timestamp("2000-01-01")


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
