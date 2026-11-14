"""
Build the global map layers and the tiled cell-day files from the shards (fetch_global.py).

  map/cells4.bin.gz        sorted H3 res-4 indices (uint64) used by the yearly map files
  map/<year>.bin.gz        per year, columnar: uint32 cell index, uint8 month (0-11), uint8 burning days.
                           Each (res-4 cell, month) uses the best sensor flying that month (VIIRS from
                           Feb 2012, else Aqua from Aug 2002, else Terra); burning days = distinct days with
                           a detection in any child cell.
  map/sky.bin.gz           uint8 per res-4 cell (same order as cells4): VIIRS-era fire intensity for the hero art
  tiles/<id>.bin.gz        5x5 degree tiles of res-5 cell-days for in-browser calibration of custom areas:
                           uint32 nCells, nCells x (float32 lat, float32 lon), then for each of the 3
                           sensors: uint32 nRows, nRows x uint16 local cell, nRows x uint16 day.
  tiles/index.json         non-empty tile ids and their sizes

Tiles are large (hundreds of MB overall), so they are gitignored and meant for the static bucket / CDN.

Usage:
    python3 pipeline/build_global_maps.py
"""
import gzip
import json
import os
import sys
from pathlib import Path

import numpy as np
import pandas as pd
from h3.api import numpy_int as h3i

REPO_ROOT = Path(__file__).resolve().parent.parent
SHARDS = REPO_ROOT / "data" / "global" / "shards"
OUT = Path(os.environ.get("BURNLOG_OUT", REPO_ROOT / "app" / "public" / "data"))
VIIRS_MIN_DETECTIONS = int(os.environ.get("BURNLOG_VIIRS_MIN_DETECTIONS", "2"))  # keep in step with build_global_products.py
AXIS0 = pd.Timestamp("2000-01-01")
TILE_DEG = 5
TILES_X = 360 // TILE_DEG


def gz_write(path: Path, *chunks: bytes) -> int:
    path.parent.mkdir(parents=True, exist_ok=True)
    data = gzip.compress(b"".join(chunks), compresslevel=6)
    path.write_bytes(data)
    return len(data)


def main() -> None:
    shard_files = sorted(p for p in SHARDS.glob("*.parquet") if not p.stem.endswith("_cc"))
    if not shard_files:
        sys.exit("No shards found; run fetch_global.py first.")
    cc = pd.concat([pd.read_parquet(p, columns=["h3"]) for p in SHARDS.glob("*_cc.parquet")], ignore_index=True)
    uniq = np.sort(cc["h3"].unique()).astype(np.uint64)
    print(f"{len(uniq):,} res-5 cells", flush=True)

    ll = np.array([h3i.cell_to_latlng(int(x)) for x in uniq])
    lat, lon = ll[:, 0].astype(np.float32), ll[:, 1].astype(np.float32)
    parents = np.array([h3i.cell_to_parent(int(x), 4) for x in uniq], dtype=np.uint64)
    cells4 = np.unique(parents)
    parent_idx = np.searchsorted(cells4, parents)
    gz_write(OUT / "map" / "cells4.bin.gz", cells4.astype("<u8").tobytes())
    print(f"{len(cells4):,} res-4 cells", flush=True)

    tx = np.clip(((lon + 180) // TILE_DEG).astype(np.int64), 0, TILES_X - 1)
    ty = np.clip(((lat + 90) // TILE_DEG).astype(np.int64), 0, 180 // TILE_DEG - 1)
    cell_tile = ty * TILES_X + tx
    order = np.argsort(cell_tile, kind="stable")
    starts = np.r_[0, np.flatnonzero(np.diff(cell_tile[order])) + 1]
    local = np.empty(len(uniq), dtype=np.int64)
    for a, b in zip(starts, np.r_[starts[1:], len(uniq)]):
        local[order[a:b]] = np.arange(b - a)
    assert local.max() < 65536

    # month rule per (year, month): best sensor flying that month
    def best_sensor(year, month):
        if (year, month) >= (2012, 2):
            return 2
        if (year, month) >= (2002, 8):
            return 1
        return 0

    best_by_ym = np.array([best_sensor(2000 + i // 12, i % 12 + 1) for i in range(26 * 12 + 24)])
    tile_rows = {}  # tile -> list of (local u16, day u16, sensor u8) arrays
    by_year = {}
    for p in shard_files:
        year = int(p.stem.split("_")[1])
        by_year.setdefault(year, []).append(p)

    map_bytes = 0
    sky_acc = np.zeros(len(cells4), dtype=np.float64)
    for year in sorted(by_year):
        frames = [pd.read_parquet(p, columns=["h3", "day", "sensor", "n"]).astype({"h3": np.uint64}) for p in by_year[year]]
        df = pd.concat(frames, ignore_index=True)
        df = df[(df["sensor"] != 2) | (df["n"] >= VIIRS_MIN_DETECTIONS)]  # MODIS-equivalent VIIRS, see build_global_products.py
        idx = np.searchsorted(uniq, df["h3"].to_numpy(np.uint64))
        day = df["day"].to_numpy(np.int64)
        sensor = df["sensor"].to_numpy(np.int64)

        viirs_rows = sensor == 2
        if viirs_rows.any():
            sky_acc += np.bincount(parent_idx[idx[viirs_rows]], minlength=len(cells4))

        t = cell_tile[idx]
        for tile in np.unique(t):
            m = t == tile
            tile_rows.setdefault(int(tile), []).append(
                (local[idx[m]].astype(np.uint16), day[m].astype(np.uint16), sensor[m].astype(np.uint8))
            )

        dates = AXIS0 + pd.to_timedelta(day, unit="D")
        month = dates.month.to_numpy() - 1
        yr = dates.year.to_numpy()
        want = best_by_ym[(yr - 2000) * 12 + month]
        keep = (sensor == want) & (yr == year)
        key = (month[keep].astype(np.int64) * 10_000 + day[keep]) * len(cells4) + parent_idx[idx[keep]]
        key = np.unique(key)  # distinct (month, day, parent)
        parent = key % len(cells4)
        md = key // len(cells4)
        mon = md // 10_000
        agg = pd.DataFrame({"p": parent, "m": mon}).groupby(["p", "m"], sort=True).size().reset_index(name="d")
        map_bytes += gz_write(
            OUT / "map" / f"{year}.bin.gz",
            agg["p"].to_numpy().astype("<u4").tobytes(),
            agg["m"].to_numpy().astype("u1").tobytes(),
            agg["d"].to_numpy().clip(max=31).astype("u1").tobytes(),
        )
        print(f"  map {year}: {len(agg):,} cell-months", flush=True)
    print(f"map files total {map_bytes / 1e6:.1f} MB gz", flush=True)
    ref = np.percentile(sky_acc[sky_acc > 0], 99.5) if (sky_acc > 0).any() else 1.0
    sky = np.clip(np.sqrt(sky_acc / ref), 0, 1) * 255
    gz_write(OUT / "map" / "sky.bin.gz", sky.astype("u1").tobytes())

    index = {}
    total = 0
    for tile, parts in sorted(tile_rows.items()):
        cells_here = order[(cell_tile[order] == tile)]
        cells_here = cells_here[np.argsort(local[cells_here])]
        coords = np.column_stack([lat[cells_here], lon[cells_here]]).astype("<f4").tobytes()
        loc = np.concatenate([a for a, _, _ in parts])
        dy = np.concatenate([b for _, b, _ in parts])
        sn = np.concatenate([c for _, _, c in parts])
        chunks = [np.uint32(len(cells_here)).tobytes(), coords]
        for s in range(3):
            m = sn == s
            o = np.argsort(dy[m], kind="stable")
            chunks += [np.uint32(m.sum()).tobytes(), loc[m][o].astype("<u2").tobytes(), dy[m][o].astype("<u2").tobytes()]
        size = gz_write(OUT / "tiles" / f"{tile}.bin.gz", *chunks)
        index[tile] = size
        total += size
    (OUT / "tiles").mkdir(parents=True, exist_ok=True)
    (OUT / "tiles" / "index.json").write_text(json.dumps({"tileDeg": TILE_DEG, "tiles": index}, separators=(",", ":")))
    print(f"{len(index)} tiles, {total / 1e6:.1f} MB gz total", flush=True)


if __name__ == "__main__":
    main()
