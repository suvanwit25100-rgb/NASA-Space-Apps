# Burning Activity Calendar — NASA Space Apps 2026

Full planning history lives in the claude.ai Project "NASA Space Apps" as `claude/fire-calendar-plan.md`. This file is the working summary every session should load.

## 1. Challenge (verbatim intent)

Understanding how burning activity is distributed across the planet over time (wildfires and agricultural burns detectable by satellite) helps anticipate critical periods, guide monitoring and improve fire response. Active-fire hotspots have been tracked for 20+ years, but the record is split across sensors whose data cannot be compared directly. Build a web application that harmonises these records into a burning activity calendar based on active-fire hotspots, so early-warning/emergency responders, scientists and land managers can examine historical fire patterns, unusual conditions and critical periods within a selected area of interest (AOI).

## 2. Decisions made

- Scope is GLOBAL (problem says "across our planet"). Any AOI on Earth must work. Curated regions (Punjab/Haryana, California, Amazonia, east Australia, Kalimantan) are demo/validation cases only.
- Unit of analysis: "burning cell-days" (an H3 cell with at least one vegetation-fire detection on a day), not raw point counts. Less sensitive to 375 m vs 1 km.
- Grid: H3 res 4 or 5 globally; res 6 loaded lazily for small AOIs.
- Architecture: Python pipeline to partitioned Parquet (cell x day); static files on a public bucket/CDN; browser queries with DuckDB-WASM. No backend (judges need no-login, always-up access). Fallback: small FastAPI + DuckDB on Cloud Run.
- Frontend: React + Vite, MapLibre GL (+ deck.gl H3 layer), D3 / Observable Plot.
- Fallback science plan: if MODIS-era calibration is not ready, ship a trusted VIIRS-era (2012+) calendar plus a clearly labelled MODIS-era (2000+) series.

## 3. Data facts and caveats

- Sensors: MODIS Terra (2000-) and Aqua (2002-), VIIRS S-NPP (2012-), NOAA-20 (2018-), NOAA-21 (2023-). MODIS 1 km, VIIRS 375 m. VIIRS detects many more small fires, so naive counts jump at the 2012 switch.
- Aqua MODIS and S-NPP VIIRS have similar ~1:30 overpass times and overlap 2012 onward, so use them as the calibration pair.
- Filter with the Type attribute (keep vegetation fire; drop volcano/static/offshore) and drop low confidence.
- Recent months are NRT and are later replaced by standard-processing (SP) data. Prefer SP for the historical record.
- FIRMS area API needs a free MAP_KEY; limit 5,000 transactions / 10 min. We already have a valid key, valid for FIRMS Global and US/Canada.
- To verify, not confirmed: the area API per-request day range (believed up to 10 days); whether the FIRMS Archive Download tool can deliver global whole-year files faster than the API; whether Microsoft Planetary Computer hosts usable MODIS thermal-anomaly / burned-area products (these would be gridded 1 km products, not FIRMS points).
- Global volume is large (VIIRS is tens of millions of detections/year). Aggregate to the grid while downloading and discard raw points.

## 4. Harmonisation method

1. Filter (Type, confidence). 2. Aggregate to H3 cell-day. 3. Snap VIIRS to ~1 km footprints and de-duplicate ("MODIS-equivalent VIIRS"). 4. Calibrate on the Aqua/S-NPP overlap with a ratio or quantile mapping per biome x season, then apply to the post-MODIS era. 5. Normalise by overpasses available per cell-day. 6. Carry an uncertainty band; flag weak cells. 7. Validate: hold out an overlap year; compare to Aqua-only; cross-check seasonality against MCD64A1/GFED; check known events (Australia 2019-20, Canada 2023, Punjab stubble burning Oct-Nov, Amazon/Indonesia dry seasons).

## 5. Product features

MVP: AOI selection (draw polygon, upload GeoJSON, pick region); calendar heatmap (year x day-of-year) with hover value/anomaly/confidence; climatology strip (median + 10-90% band, selected year overlaid); anomaly view (percentile/z-score vs same week in other years); auto-flagged critical periods (dates between 10% and 90% of cumulative annual activity, plus peak weeks); map linked to calendar; data-provenance panel.

Stretch: compare two AOIs/periods; CSV/PNG/GeoJSON export; shareable URL state; current-7-days early-warning banner (needs NRT); diurnal view; weather context layer (Meteomatics).

## 6. Submission requirements (organisers)

- Project page accepts images only (JPG/PNG/GIF, up to 10 MB). No video or document upload.
- Videos and documents go on a public, login-free link (YouTube, Google Drive, GitHub, etc.). Test every link in a private browser.
- New websites should get a FortiGuard Web Filter Classification (https://www.fortiguard.com/faq/wfratingsubmit; Company Name "N/A"; choose the closest category such as web-based application/reference yourself).
- Package: live app URL, demo video, slide deck (public link or PDF in repo), public GitHub repo with README (method, sources, caveats, reproducible pipeline), 4 page images (before/after harmonisation chart, UI screenshot, architecture diagram, validation figure), project-page text.
- Demo narrative: Punjab stubble-burning season: when it starts, when it peaks, how this year compares.

## 7. Secrets

The FIRMS MAP_KEY lives in `.env` as `FIRMS_MAP_KEY` (gitignored), read via environment variable. Never commit it, never call FIRMS from the browser. The key was shown in a screenshot in an earlier chat — rotate it if it ever leaks.

## 8. Status (updated as work proceeds)

See git log and this file's edits for current status.

- Done: plan written; FIRMS MAP_KEY obtained and stored in `.env`; domain globalburnlog.earth registered (DNS at Porkbun); repo scaffolded (`.env`, `.gitignore`, `README.md`, `pipeline/`, `app/`, `docs/`); first FIRMS API test call succeeded (`pipeline/firms_test.py`) — 3,915 VIIRS_SNPP_NRT detections over the Punjab/Haryana bbox for 2026-10-15 through 2026-11-02, confidence breakdown n=3667/l=180/h=68, clear ramp-up pattern in raw counts consistent with the stubble-burning narrative. Plot saved at `docs/firms_test_punjab_daily_counts.png`.
- Done: download-and-aggregate pipeline (`pipeline/fetch_and_aggregate.py`) using FIRMS's public per-country annual archive CSVs (no MAP_KEY needed, no rate-limit risk — far cheaper than paging the area API day-by-day). Ran for India, MODIS 2000-2025 + VIIRS_SNPP 2012-2025: 2.88M raw detections -> 2.88M (h3_cell, date, sensor) burning-cell-day rows at H3 res 5, written to `data/cell_days_India_2000_2025_res5.parquet` (gitignored, regenerate via the script). Before/after harmonisation chart generated at `docs/before_after_India.png` (`pipeline/plot_before_after.py`) — this is one of the 4 required submission page images.
- Done: cross-sensor calibration (`pipeline/calibrate.py`, method step 4). Learned a seasonal (by calendar month) ratio between MODIS_AQUA and VIIRS_SNPP on their 2012+ overlap, and a second Terra-to-Aqua seasonal ratio on the 2002-2011 overlap to chain back to 2000-2001 (Aqua launched May 2002, so no Aqua exists before then). Applied to produce a single continuous "VIIRS-equivalent" harmonised monthly series 2000-present for India — the 2012 jump is visibly gone: pre-2012 estimated amplitude now sits in the same range as actual post-2012 VIIRS data, with seasonal shape preserved. Chart at `docs/calibration_India.png`, series at `data/harmonised_monthly_India_2000_2025.csv`. This is still a seasonal-ratio calibration, not the plan's full "per biome x season" quantile mapping — flagged as a refinement, not blocking, since a single-country demo region is reasonably biome-homogeneous for this purpose.
- Done: validation against NASA MCD64A1 (`pipeline/validate_against_mcd64a1.py`, via Planetary Computer): seasonal climatology r = 0.887, monthly series r = 0.823 over 2000-2025 (same India bbox as the GFED check). GFED4.1s check: r = 0.931 over 2000-2016 (GFED has no burned-area product after 2016). The harmonised series runs a little high in winter and low at peaks versus burned area, since detections outlast burn scars.
- Done: frontend v1 in `app/` (React + Vite, MapLibre + deck.gl H3 layer, D3). Theme taken from the user's Pinterest reference: deep navy night-side Earth limb, ember orange accents, steel-blue chamfered HUD frames, wide-tracked caps, Montserrat, PAGE n footers. The hero sky is drawn in code from the real VIIRS fire density (no generative imagery). Data prepared by `pipeline/export_frontend_data.py` into `app/public/data/` (AOI daily series with calibration bands, H3 cells, packed cell-month map data). Run with `npm --prefix app run dev` (preview config in `.claude/launch.json`).
- Design decision (deviates from section 5): critical periods are detected as **fire seasons** (runs where 3-week-smoothed activity stays above 15% of the year's peak, merged within 14 days, dropped under 6% of the year) rather than a single 10%-90% cumulative window, because regions like Punjab have two separate seasons (spring wheat residue, autumn paddy stubble) and a single cumulative window spans Feb to Nov and says nothing. The 10%-90% window is still computed (`crit` in `app/src/lib/analytics.js`) but no longer displayed.
- Gotchas learned: MapLibre 6 has no default export (use a namespace import) and its worker must be imported as an asset (`maplibre-gl/dist/maplibre-gl-worker.mjs?url` + `setWorkerUrl`), otherwise the production build loses the basemap. `.gitignore` re-includes `app/public/data/` despite the global `data/` rule.
- Done: frontend v2 features. (1) Custom areas: draw a rectangle on the map or upload GeoJSON (Polygon/MultiPolygon, up to 50k vertices); the browser calibrates the area on the fly from `app/public/data/cell_days.bin` (3.8 MB gzipped, lazy-loaded) using a JS port of `aoi_series()` that matches the Python export exactly (verified: zero difference over 9,192 days for three regions, 5-27 ms). (2) Shareable URL state (`?aoi=&y=&m=&mode=&cmp=&bbox=`; uploaded outlines are shared as their bounding box). (3) Compare two areas (normalised seasonal curves plus a season table). (4) Exports: daily-series CSV with a provenance header and a calendar PNG.
- Bug found and fixed while building this: the per-region Aqua/Terra ratio counted months before Aqua existed (Nov 2000 to Jun 2002) as zero ratios, understating the 2000-2002 estimates by 15-20% in the app (calibrate.py was unaffected). Both scripts now use only full months where both sensors operate (Aqua from Aug 2002, VIIRS from Feb 2012). Validation numbers barely moved.
- Testing gotchas: the embedded browser pane does not paint (so canvases stay unsized) until a screenshot forces a frame; take a screenshot before inspecting canvases. Background tabs also throttle ResizeObserver.
- Done: GLOBAL data (this is the main status change). `pipeline/fetch_global.py` pulled all 209 countries in the FIRMS annual archive (country names in `pipeline/countries.json`; FIRMS publishes no list, so it was found by probing ISO names; the archive is public, ~30 GB total, ~4.5 MB/s per stream, 4 parallel downloads is safe and 16 gets throttled) for MODIS 2000-2025 and VIIRS S-NPP 2012-2025: 100M cell-day rows at H3 res 5, 394k cells, stored as 40 parquet shards in `data/global/shards/` (gitignored) with a cell-to-country sidecar per shard. NOAA-20/21 are not included (archive naming not found). 2026 is excluded until reprocessed.
- Global products: `build_global_products.py` -> `app/public/data/regions.json` + `series/<id>.json.gz` for the world, 16 featured regions and 209 countries (36 flagged low-data); `build_global_maps.py` -> `map/<year>.bin.gz` (res-4 cell-months, 6.9 MB total), `map/cells4.bin.gz`, `map/sky.bin.gz` (hero art) and `tiles/` (5-degree res-5 cell-day tiles for in-browser custom areas, 1,193 tiles, 109 MB, GITIGNORED: host on the static bucket). The old India-only `aois.json`/`cells.json`/`cell_*.bin` and `export_frontend_data.py` were removed.
- Verification: global India series vs the original India-only pipeline: correlation >= 0.9995, totals within ~1% (differences are border cells only; the two border-free regions match exactly). In-browser tile calibration vs precomputed series for six regions on four continents: zero difference, identical cell counts. Multi-region GFED validation (`validate_regions_gfed.py`, 2000-2016, seasonal r): southern Africa 0.99, Siberia 0.96, Mediterranean 0.95, India 0.93, West Africa 0.92, Amazon arc 0.91, mainland SE Asia 0.91, Sumatra/Kalimantan 0.90, northern Australia 0.82, boreal Canada 0.67, California 0.55, southeast Australia -0.05. The weak ones are regimes where a few very large fires dominate burned area while cell-days count presence, not size; this is a limit of the metric, stated on the Method page.
- Bug found and fixed: the map/tile builder concatenated an int64 shard with a uint64 shard (2024), which pandas turns into float64 and silently scrambles 64-bit H3 ids (rows land on a neighbouring cell). Cause: empty frames and mixed integer types in `fetch_global.py`. Fixed (explicit uint64/uint16/uint8 dtypes, empties dropped, builders cast) and all shards normalised. Lesson: never let H3 ids touch float64; assert exact id membership after any concat.
- App is now global: lazy region/country series, country search, yearly global map, world hero from real VIIRS fire density, tile-based custom areas anywhere (areas over 16 tiles are rejected with a message), year-round wording when there is no single season.
- Not yet done: placeholder page on the domain, FortiGuard request, NOAA-20/21 country-archive naming (404'd on the patterns tried, needs more probing), uncertainty bands / weak-cell flagging (method step 6), validation against MCD64A1/GFED and known fire events (method step 7), still open: NRT early-warning banner, diurnal view, weather layer, touch-screen drawing, hosting, global coverage.

### API facts learned from the test call (update the plan's "to verify" list accordingly)

- The area API's date parameter is the **start** of the window; `day_range` extends **forward** from it (not backward from an end date as initially assumed).
- `day_range` for `*_NRT` sources (VIIRS_SNPP_NRT, MODIS_NRT) is capped at **5** days, not 10 — the API returns `400 Invalid day range. Expects [1..5].` above that. Re-check whether SP/archive sources allow up to 10; chunk calls accordingly either way.
- The VIIRS CSV response has no `type` column (type filtering only applies to MODIS in this endpoint) — confirm how to filter VIIRS non-vegetation detections (there's a separate country/static-source list, or rely on confidence + known static-source masks).
- NRT data lagged ~12 days behind "today" for this bbox at test time (request on 2026-11-14 returned nothing past 2026-11-02) — budget for this lag in any "current conditions" / early-warning feature.

## 9. Offers available (Space Apps Global Offers, terms unverified)

GoDaddy (domain used), Google Cloud (Storage/Cloud Run/Firebase Hosting), Microsoft Planetary Computer/Azure/GitHub Copilot, Meteomatics (weather, stretch), Miro (planning).

## 10. Open questions

Team size; submission deadline (turn the 8-day plan into dated tasks); whether NRT early-warning is in the MVP; which parts of the work the user does personally vs delegates.

## Repo layout

- `pipeline/` — Python: FIRMS fetch, grid aggregation, calibration, exports to Parquet.
- `app/` — React + Vite frontend (MapLibre GL, deck.gl, D3/Observable Plot, DuckDB-WASM).
- `docs/` — architecture notes, validation figures, submission assets.
- `.env` — `FIRMS_MAP_KEY=...` (gitignored, never commit).
