# Burning Activity Calendar

A global burning-activity calendar built from 20+ years of satellite active-fire hotspot data (MODIS + VIIRS via NASA FIRMS), harmonised across sensors into comparable "burning cell-days" on an H3 grid, so responders, scientists and land managers can see historical fire patterns, anomalies and critical periods for any area of interest.

Built for NASA Space Apps Challenge 2026.

## NASA data and resources used

- **NASA FIRMS** (Fire Information for Resource Management System, part of NASA's LANCE/EOSDIS) — the sole data source for the pipeline:
  - **MODIS** Collection 6.1 active-fire product from the **Terra** and **Aqua** satellites (NASA Earth Observing System)
  - **VIIRS** 375m active-fire product from **Suomi NPP** (joint NASA/NOAA mission) and **NOAA-20**
  - Accessed via FIRMS's live area API and per-country annual archive distribution; see [CLAUDE.md](CLAUDE.md) §3 and [pipeline/fetch_and_aggregate.py](pipeline/fetch_and_aggregate.py)/[pipeline/firms_test.py](pipeline/firms_test.py)

- **NASA MCD64A1** (MODIS Burned Area, Collection 6.1, 500 m) via the Microsoft Planetary Computer STAC, used as an independent validation of the harmonised series: seasonal climatology r = 0.888, monthly series r = 0.824 over 2000-2025. See [pipeline/validate_against_mcd64a1.py](pipeline/validate_against_mcd64a1.py) and `docs/validation_vs_mcd64a1_India.png`.

(A second cross-check against GFED4.1s, a third-party dataset built on MCD64A1, gives r = 0.931 for the seasonal cycle over 2000-2016; see `docs/validation_vs_gfed_India.png`. GFED is not itself a NASA-operated resource.)

## Repo layout

- `pipeline/` — Python pipeline: fetch FIRMS data, filter, aggregate to H3 cell-day, cross-sensor calibration, export partitioned Parquet.
- `app/` — React + Vite frontend: MapLibre GL + deck.gl H3 map, D3 and canvas calendar heatmap, climatology, anomaly and fire-season charts. Run it with `npm --prefix app install && npm --prefix app run dev` (data is pre-exported into `app/public/data/` by `pipeline/export_frontend_data.py`).
- `docs/` — architecture notes, validation figures, submission assets.

## Setup

```bash
cp .env.example .env
# then fill in FIRMS_MAP_KEY in .env (get a free key at https://firms.modaps.eosdis.nasa.gov/api/map_key/)
```

See [CLAUDE.md](CLAUDE.md) for the full plan, data caveats and method, and [AI_USAGE.md](AI_USAGE.md) for the SI (AI) tool usage disclosure required by the NASA Space Apps Challenge rules.
