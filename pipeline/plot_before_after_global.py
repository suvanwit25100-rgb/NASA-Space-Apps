"""
Before/after harmonisation figure for India from the global products (replaces the India-only worked example's figure).

Before: the naive record, MODIS (Aqua; Terra before Aqua existed) cell-days until VIIRS starts, then raw VIIRS cell-days (one
detection is enough), which jumps in 2012. After: the harmonised series the app shows (MODIS-equivalent VIIRS, calibrated).
Reads data/global/shards, pipeline/cell_country.npz and app/public/data/series/ind.json.gz.
Writes docs/submission/1_before_after_harmonisation.png and app/public/img/before_after_India.png.
"""
import gzip
import json
import sys
from pathlib import Path

import matplotlib
import numpy as np
import pandas as pd

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402

sys.path.insert(0, str(Path(__file__).parent))
from build_global_products import AXIS_START, NDAYS, SHARDS  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent


def main():
    z = np.load(Path(__file__).parent / "cell_country.npz")
    uniq, cc = z["h3"], z["cidx"].astype(np.int64)
    ind = list(json.loads((Path(__file__).parent / "countries.json").read_text())).index("IND")
    mask = cc == ind
    days = pd.date_range(AXIS_START, periods=NDAYS)
    month = ((days.year - 2000) * 12 + days.month - 1).to_numpy()
    NM = 26 * 12
    terra, aqua, viirs = np.zeros(NM), np.zeros(NM), np.zeros(NM)
    for p in sorted(p for p in SHARDS.glob("*.parquet") if not p.stem.endswith("_cc")):
        df = pd.read_parquet(p, columns=["h3", "day", "sensor"])
        h = df["h3"].to_numpy(np.uint64)
        pos = np.clip(np.searchsorted(uniq, h), 0, len(uniq) - 1)
        ok = (uniq[pos] == h) & mask[pos]
        m = month[df["day"].to_numpy(np.int64)[ok]]
        s = df["sensor"].to_numpy()[ok]
        for arr, sid in ((terra, 0), (aqua, 1), (viirs, 2)):
            arr += np.bincount(m[s == sid], minlength=NM)
    idx = pd.date_range("2000-01-01", periods=NM, freq="MS")
    naive = np.where(idx < "2002-08-01", terra, np.where(idx < "2012-02-01", aqua, viirs)).astype(float)
    naive[idx < "2000-12-01"] = np.nan
    d = json.loads(gzip.decompress((ROOT / "app/public/data/series/ind.json.gz").read_bytes()))
    s = pd.Series([np.nan if v is None else v for v in d["values"]], index=pd.date_range("2000-01-01", periods=len(d["values"]))).resample("MS").sum(min_count=28)
    lo = pd.Series([np.nan if v is None else v for v in d["lo"]], index=s.index if len(d["lo"]) == len(s.index) else None) if False else None

    bg, fg, mut, em, hot, bl = "#0b0c10", "#f5efe6", "#bdb1a6", "#ff7a2f", "#ffb869", "#6fb3ff"
    fig, ax = plt.subplots(1, 2, figsize=(15, 5.2), facecolor=bg, sharey=False)
    for a in ax:
        a.set_facecolor(bg)
        a.tick_params(colors=mut)
        [sp.set_color("#3a3135") for sp in a.spines.values()]
        a.grid(True, color="#2a2428")
        a.set_axisbelow(True)
    ax[0].plot(idx, naive, color=bl, lw=1.8)
    ax[0].axvline(pd.Timestamp("2012-01-20"), color=hot, ls="--", lw=1.2)
    ax[0].text(pd.Timestamp("2012-04-01"), np.nanmax(naive) * 0.92, "VIIRS starts", color=hot, fontsize=11)
    ax[0].set_title("Before: the raw record jumps when the sensor changes", color=fg, fontsize=14, loc="left")
    ax[1].plot(s.index, s.values, color=em, lw=1.8)
    ax[1].axvline(pd.Timestamp("2012-01-20"), color=hot, ls="--", lw=1.2)
    ax[1].set_title("After: harmonised (MODIS-equivalent VIIRS scale)", color=fg, fontsize=14, loc="left")
    for a in ax:
        a.set_ylabel("Burning cell-days per month, India", color=mut)
    fig.text(0.01, 0.01, "Global Burn Log · NASA FIRMS (MODIS Terra and Aqua, VIIRS Suomi NPP) · 2000 to 2011 are calibrated estimates", color=mut, fontsize=9)
    fig.tight_layout(rect=(0, 0.04, 1, 1))
    for out in (ROOT / "docs/submission/1_before_after_harmonisation.png", ROOT / "app/public/img/before_after_India.png"):
        fig.savefig(out, dpi=140, facecolor=bg)
        print("saved", out)
    print("ratio of mean 2012-2019 to mean 2004-2011: naive", round(np.nanmean(naive[(idx >= "2012-02-01") & (idx < "2020-01-01")]) / np.nanmean(naive[(idx >= "2004-01-01") & (idx < "2012-01-01")]), 2),
          "harmonised", round(np.nanmean(s[(s.index >= "2012-02-01") & (s.index < "2020-01-01")]) / np.nanmean(s[(s.index >= "2004-01-01") & (s.index < "2012-01-01")]), 2))


if __name__ == "__main__":
    main()
