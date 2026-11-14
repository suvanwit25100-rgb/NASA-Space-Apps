"""
Footprint snapping (method step 3): would a "MODIS-equivalent VIIRS" be easier to calibrate?

VIIRS (375 m) records many cell-days that rest on a single small pixel, which MODIS (1 km) would usually miss. One way
to mimic MODIS is to keep a VIIRS cell-day only when it holds at least k detections, i.e. when the fire is big enough to
cover several VIIRS pixels. The shards keep the number of detections per cell-day (n), so this needs no new download.
This is a proxy for true footprint snapping, which would need each detection's coordinates, not a replacement for it.

For k = 1 (today), 2, 3 and 5 it reruns the leave-one-year-out Aqua -> VIIRS test (holdout_test.py) against the filtered
VIIRS series and reports the held-out annual-total error, monthly correlation and band coverage. The filter is worth
adopting only if held-out error falls.   Usage: python3 pipeline/holdout_snap.py
Writes docs/snap_holdout.json.
"""
import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd
from h3.api import numpy_int as h3i

sys.path.insert(0, str(Path(__file__).parent))
from build_global_products import FEATURED, SHARDS  # noqa: E402
from holdout_test import NM, month_index, score, summarise  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "docs" / "snap_holdout.json"
KS = [1, 2, 3, 5]


def main():
    z = np.load(Path(__file__).parent / "cell_country.npz")
    uniq, cell_country = z["h3"], z["cidx"].astype(np.int64)
    alpha3 = list(json.loads((Path(__file__).parent / "countries.json").read_text()))
    ll = np.array([h3i.cell_to_latlng(int(x)) for x in uniq])
    lat, lon = ll[:, 0], ll[:, 1]
    masks = {"world": np.ones(len(uniq), bool)}
    for fid, _, bbox, restrict in FEATURED:
        m = (lon >= bbox[0]) & (lon <= bbox[2]) & (lat >= bbox[1]) & (lat <= bbox[3])
        if restrict:
            m &= np.isin(cell_country, [alpha3.index(a) for a in restrict])
        masks[fid] = m
    midx = month_index()
    # per area: Aqua cell-days, and VIIRS cell-days with at least k detections for each k
    aqua = {a: np.zeros(NM) for a in masks}
    viirs = {a: {k: np.zeros(NM) for k in KS} for a in masks}
    for p in sorted(p for p in SHARDS.glob("*.parquet") if not p.stem.endswith("_cc")):
        is_v = p.name.startswith("viirs")
        df = pd.read_parquet(p, columns=["h3", "day", "sensor", "n"])
        if not is_v:
            df = df[df["sensor"] == 1]
        h = df["h3"].to_numpy(np.uint64)
        pos = np.clip(np.searchsorted(uniq, h), 0, len(uniq) - 1)
        ok = uniq[pos] == h
        pos = pos[ok]
        mo = midx[df["day"].to_numpy(np.int64)[ok]]
        n = df["n"].to_numpy()[ok]
        for a, m in masks.items():
            sel = m[pos]
            if not sel.any():
                continue
            if is_v:
                for k in KS:
                    viirs[a][k] += np.bincount(mo[sel & (n >= k)], minlength=NM)
            else:
                aqua[a] += np.bincount(mo[sel], minlength=NM)
        print("  ", p.name, flush=True)

    ym = lambda y, m: (y - 2000) * 12 + m
    v_months = list(range(ym(2012, 1), NM))
    res = {}
    for a in masks:
        res[a] = {}
        for k in KS:
            rows = [score(viirs[a][k], aqua[a], y, [i for i in v_months if i // 12 + 2000 != y], [ym(y, m) for m in range(12)]) for y in range(2013, 2026)]
            s = summarise(rows)
            if s:
                s.pop("perYear")
                s["viirsShare"] = float(viirs[a][k].sum() / max(viirs[a][1].sum(), 1))
                res[a][str(k)] = s
    OUT.write_text(json.dumps(res, indent=1).replace("NaN", "null"))
    print(f"{'area':26s} " + "  ".join(f"k={k}: err   r  cov  keep" for k in KS))
    for a, v in res.items():
        print(f"{a:26s} " + "  ".join(f"{v[str(k)]['medAbsTotalErr']:.3f} {v[str(k)]['meanMonthlyR']:.2f} {v[str(k)]['bandCoverage']:.2f} {v[str(k)]['viirsShare']:.2f}" for k in KS if str(k) in v))
    for k in KS:
        rs = [v[str(k)] for v in res.values() if str(k) in v]
        print(f"k={k}: median annual error {np.median([r['medAbsTotalErr'] for r in rs]):.3f}, mean monthly r {np.mean([r['meanMonthlyR'] for r in rs]):.3f}, band coverage {np.mean([r['bandCoverage'] for r in rs]):.2f}")


if __name__ == "__main__":
    main()
