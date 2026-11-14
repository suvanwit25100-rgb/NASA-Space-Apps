# Burning Activity Calendar

A global burning-activity calendar built from 20+ years of satellite active-fire hotspot data (MODIS + VIIRS via NASA FIRMS), harmonised across sensors into comparable "burning cell-days" on an H3 grid, so responders, scientists and land managers can see historical fire patterns, anomalies and critical periods for any area of interest.

Built for NASA Space Apps Challenge 2026.

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
