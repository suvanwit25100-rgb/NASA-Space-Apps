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

- Done: plan written; FIRMS MAP_KEY obtained and stored in `.env`; domain globalburnlog.earth registered; repo scaffolded (`.env`, `.gitignore`, `README.md`, `pipeline/`, `app/`, `docs/`); first FIRMS API test call succeeded (`pipeline/firms_test.py`) — 3,915 VIIRS_SNPP_NRT detections over the Punjab/Haryana bbox for 2026-10-15 through 2026-11-02, confidence breakdown n=3667/l=180/h=68, clear ramp-up pattern in raw counts consistent with the stubble-burning narrative. Plot saved at `docs/firms_test_punjab_daily_counts.png`.
- Done: download-and-aggregate pipeline (`pipeline/fetch_and_aggregate.py`) using FIRMS's public per-country annual archive CSVs (no MAP_KEY needed, no rate-limit risk — far cheaper than paging the area API day-by-day). Ran for India, MODIS 2000-2025 + VIIRS_SNPP 2012-2025: 2.88M raw detections -> 2.88M (h3_cell, date, sensor) burning-cell-day rows at H3 res 5, written to `data/cell_days_India_2000_2025_res5.parquet` (gitignored, regenerate via the script). Before/after harmonisation chart generated at `docs/before_after_India.png` (`pipeline/plot_before_after.py`) — this is one of the 4 required submission page images.
- Not yet done: placeholder page on the domain, FortiGuard request, true global archive pull (same script, loop over FIRMS's full country list instead of one country — see note in fetch_and_aggregate.py), NOAA-20/21 country-archive naming (404'd on the patterns tried, needs more probing), cross-sensor calibration (method step 4 — the AFTER panel still sums sensors without removing double-counting), frontend on mock data.

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
