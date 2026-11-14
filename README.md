# Burning Activity Calendar

A global burning-activity calendar built from 20+ years of satellite active-fire hotspot data (MODIS + VIIRS via NASA FIRMS), harmonised across sensors into comparable "burning cell-days" on an H3 grid, so responders, scientists and land managers can see historical fire patterns, anomalies and critical periods for any area of interest.

Built for NASA Space Apps Challenge 2026.

## NASA data and resources used

- **NASA FIRMS** (Fire Information for Resource Management System, part of NASA's LANCE/EOSDIS) — the sole data source for the pipeline:
  - **MODIS** Collection 6.1 active-fire product from the **Terra** and **Aqua** satellites (NASA Earth Observing System)
  - **VIIRS** 375m active-fire product from **Suomi NPP** (joint NASA/NOAA mission) and **NOAA-20**
  - Accessed via FIRMS's live area API and per-country annual archive distribution; see [CLAUDE.md](CLAUDE.md) §3 and [pipeline/fetch_and_aggregate.py](pipeline/fetch_and_aggregate.py)/[pipeline/firms_test.py](pipeline/firms_test.py)

(Validation against GFED4.1s, which draws on NASA's MCD64A1 MODIS Burned Area product as an input, is a supplementary cross-check — see `docs/validation_vs_gfed_India.png` — not itself a NASA-operated resource.)

## Repo layout

- `pipeline/` — Python pipeline: fetch FIRMS data, filter, aggregate to H3 cell-day, cross-sensor calibration, export partitioned Parquet.
- `app/` — React + Vite frontend: MapLibre GL + deck.gl map, D3/Observable Plot calendar heatmap, DuckDB-WASM for in-browser queries.
- `docs/` — architecture notes, validation figures, submission assets.

## Setup

```bash
cp .env.example .env
# then fill in FIRMS_MAP_KEY in .env (get a free key at https://firms.modaps.eosdis.nasa.gov/api/map_key/)
```

See [CLAUDE.md](CLAUDE.md) for the full plan, data caveats and method, and [AI_USAGE.md](AI_USAGE.md) for the SI (AI) tool usage disclosure required by the NASA Space Apps Challenge rules.
