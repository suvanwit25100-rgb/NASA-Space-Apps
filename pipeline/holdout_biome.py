"""
Does biome-specific calibration beat one ratio per area?  Same leave-one-year-out test as holdout_test.py, run two ways:

  area ratio   one seasonal ratio per area and calendar month (what the app uses today)
  biome ratio  one seasonal ratio per biome-within-the-area and calendar month; the prediction for the held-out year is
               the sum of each biome's own prediction

Biomes come from pipeline/cell_biome.py (RESOLVE Ecoregions 2017, 8 groups). Reads data/global/shards and the two .npz
lookups, writes docs/biome_holdout.json (not shipped to the app) and prints a verdict. The app is only switched to biome ratios if the
held-out error really falls.   Usage: python3 pipeline/holdout_biome.py
"""
import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd
from h3.api import numpy_int as h3i

sys.path.insert(0, str(Path(__file__).parent))
from build_global_products import FEATURED, SHARDS  # noqa: E402
from holdout_test import NM, month_index, ratio_table  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "docs" / "biome_holdout.json"
NB = 8


def predict(num, den, train_months, test_months):
    ratio, _, _ = ratio_table(num, den, train_months)
    return np.array([den[k] * ratio[k % 12] for k in test_months])


def main():
    z = np.load(Path(__file__).parent / "cell_country.npz")
    uniq, cell_country = z["h3"], z["cidx"].astype(np.int64)
    zb = np.load(Path(__file__).parent / "cell_biome.npz")
    assert np.array_equal(zb["h3"], uniq), "cell_biome.npz is out of step with cell_country.npz; rerun cell_biome.py"
    biome = zb["group"].astype(np.int64)
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
    monthly = {a: np.zeros((NB, 3, NM)) for a in masks}
    for p in sorted(p for p in SHARDS.glob("*.parquet") if not p.stem.endswith("_cc")):
        df = pd.read_parquet(p, columns=["h3", "day", "sensor"])
        h = df["h3"].to_numpy(np.uint64)
        pos = np.clip(np.searchsorted(uniq, h), 0, len(uniq) - 1)
        ok = uniq[pos] == h
        pos = pos[ok]
        sensor = df["sensor"].to_numpy(np.int64)[ok]
        mo = midx[df["day"].to_numpy(np.int64)[ok]]
        b = biome[pos]
        for a, m in masks.items():
            sel = m[pos]
            if sel.any():
                key = (b[sel] * 3 + sensor[sel]) * NM + mo[sel]
                monthly[a] += np.bincount(key, minlength=NB * 3 * NM).reshape(NB, 3, NM)
        print("  ", p.name, flush=True)

    ym = lambda y, m: (y - 2000) * 12 + m
    links = {
        "aquaToViirs": (2, 1, list(range(ym(2012, 1), NM)), range(2013, 2026)),
        "terraToAqua": (1, 0, list(range(ym(2002, 7), ym(2012, 0))), range(2003, 2012)),
    }
    res = {}
    for a in masks:
        res[a] = {}
        for link, (si, di, months, years) in links.items():
            rows = []
            for y in years:
                test = [ym(y, m) for m in range(12)]
                train = [k for k in months if k // 12 + 2000 != y]
                tot = monthly[a].sum(axis=0)
                actual = np.array([tot[si][k] for k in test], float)
                if actual.sum() <= 0:
                    continue
                pa = predict(tot[si], tot[di], train, test)
                pb = sum(predict(monthly[a][b][si], monthly[a][b][di], train, test) for b in range(NB) if monthly[a][b][si].sum() > 0)
                corr = lambda p: float(np.corrcoef(p, actual)[0, 1]) if p.std() > 0 and actual.std() > 0 else np.nan
                rows.append({"year": y, "areaErr": float(pa.sum() / actual.sum() - 1), "biomeErr": float(pb.sum() / actual.sum() - 1), "areaR": corr(pa), "biomeR": corr(pb)})
            if rows:
                f = lambda k: float(np.nanmean([r[k] for r in rows]))
                res[a][link] = {
                    "medAbsAreaErr": float(np.median([abs(r["areaErr"]) for r in rows])),
                    "medAbsBiomeErr": float(np.median([abs(r["biomeErr"]) for r in rows])),
                    "areaR": f("areaR"), "biomeR": f("biomeR"), "years": len(rows),
                    "nBiomes": int(sum(monthly[a][b][si].sum() > 0 for b in range(NB))),
                }
    OUT.write_text(json.dumps(res).replace("NaN", "null"))
    for link in links:
        rs = [v[link] for v in res.values() if link in v]
        wins = sum(r["medAbsBiomeErr"] < r["medAbsAreaErr"] for r in rs)
        print(f"{link}: biome ratio has the smaller annual error in {wins} of {len(rs)} areas; "
              f"median |err| area {np.median([r['medAbsAreaErr'] for r in rs]):.3f} vs biome {np.median([r['medAbsBiomeErr'] for r in rs]):.3f}; "
              f"mean monthly r area {np.mean([r['areaR'] for r in rs]):.3f} vs biome {np.mean([r['biomeR'] for r in rs]):.3f}")
        for a, v in res.items():
            if link in v:
                r = v[link]
                print(f"   {a:26s} area {r['medAbsAreaErr']:.3f}  biome {r['medAbsBiomeErr']:.3f}  ({r['nBiomes']} biomes)")


if __name__ == "__main__":
    main()
