# Project page text (paste into the Space Apps project page)

Images to upload (JPG/PNG/GIF, up to 10 MB each), in this order, all in `docs/submission/`:
1. `1_before_after_harmonisation.png` (the 2012 sensor jump, before and after calibration)
2. `2_ui_explorer.png` (the app)
3. `3_architecture.png` (how it works)
4. `4_validation_global.png` (validation against independent burned-area data in 12 regions)

Links (all public, no login): see the end of this file. Test each one in a private window.

---

## Project name
Global Burn Log: a harmonised burning-activity calendar for the whole planet

## One-line summary
Twenty-five years of satellite fire detections from every country, stitched across sensors that never agreed with each other, so anyone can see when a region's fire season starts, when it peaks and how this year compares.

## What it does
Global Burn Log turns NASA's active-fire detections into a burning-activity calendar for any area on Earth. Pick a country, a featured region, or draw your own area, and it shows every day since 2000 as a calendar heatmap, the typical year with its normal range, the fire seasons of every year, anomalies against the same week in other years, and a map of where it burned. A one-minute guided tour walks through the Punjab and Haryana crop-residue burning season: when it starts, when it peaks and how the latest year compares (the 2025 autumn burn was the lowest of the 25 years).

## The problem it solves
Active-fire hotspots have been recorded for more than 20 years, but the record is split across sensors that cannot be compared directly. VIIRS (375 m) sees many more small fires than MODIS (1 km), so a naive count jumps several-fold (about sixfold for India) the day VIIRS comes online in 2012. That makes long-term patterns, unusual years and critical periods impossible to read. Early-warning teams, scientists and land managers need one consistent record.

## How it works
1. **NASA data.** NASA FIRMS annual archives for 209 countries: MODIS on Terra and Aqua (2000 to 2025) and VIIRS on Suomi NPP (2012 to 2025), about 100 million burning cell-days.
2. **Filter and grid.** Keep vegetation fires at acceptable confidence, aggregate to an H3 hexagon grid, and count "burning cell-days" (a cell with at least one detection on a day) instead of raw points, which is far less sensitive to sensor resolution.
3. **Harmonise.** For each area, learn seasonal ratios between Aqua and VIIRS (they overpass at the same local time) and between Terra and Aqua, then put 2000 to 2011 on the VIIRS scale. Every estimated day carries an uncertainty band, and the site always shows which years are measured and which are calibrated.
4. **Validate.** The seasonal cycle was checked against NASA's MCD64A1 burned-area product (r = 0.89 for India over 2000 to 2025) and against GFED burned area in 12 regions on six continents: 9 of 12 correlate at r of 0.90 or better, including southern African savanna (0.99), Siberia (0.96) and the Mediterranean (0.95).
5. **Serve.** Everything is precomputed into small static files on a CDN, so the app has no server to go down and needs no login. Areas you draw are calibrated live in the browser from tiled data.

## Honest limits (stated on the site)
- Cell-days measure where and when fire was detected, not how much land burned. Where a few huge fires dominate burned area (California, Boreal Canada, Southeast Australia) the seasonal match is weaker (r = 0.55, 0.67 and -0.05).
- 2000 to 2011 are calibrated estimates, never shown as measurements. NOAA-20 and NOAA-21 are not yet included, and 2026 waits for reprocessed data.

## Benefits
- Early-warning and emergency teams can see typical start dates and unusually early or late seasons for their area.
- Land managers can compare their region with others and with its own history.
- Scientists get a transparent, reproducible, cross-sensor record with its uncertainty, plus CSV export of the daily series.

## NASA data and resources used
- NASA FIRMS (LANCE/EOSDIS): MODIS Collection 6.1 active fire (Terra, Aqua) and VIIRS 375 m active fire (Suomi NPP).
- NASA MCD64A1 (MODIS Burned Area, Collection 6.1), read through the Microsoft Planetary Computer, for validation.
- Also compared with GFED4.1s burned area (a third-party product built on MCD64A1).

## Tools and technology
Python (pandas, H3, PyArrow, h5py, rasterio), React and Vite, MapLibre GL and deck.gl, D3, Firebase Hosting (Google Cloud free tier), a Porkbun domain. All code is open in the repository, with a README that reproduces the dataset end to end (the historical archive needs no API key).

## Use of AI (disclosure)
The team set the goal and made the design decisions. Claude (Anthropic) was used as a tool to help plan, and Claude Code to write the data pipeline, the web app and the documentation. A planning conversation with Claude was used to discuss options and draft the plan; the team chose the direction. No generative AI was used to create imagery: the hero art is drawn in code from the real fire detections, the charts are plots of real data, and the architecture diagram is hand-coded. The site uses no NASA logos or mission identifiers. See `AI_USAGE.md` in the repository.

## Links (fill in before submitting)
- Live app: https://globalburnlog.earth
- 60-second guided tour: https://globalburnlog.earth/?tour=1
- Source code (must be public): https://github.com/suvanwit25100-rgb/NASA-Space-Apps
- Demo video: <paste public YouTube or Drive link>
- Slide deck: <paste public link, or `docs/submission/slides.pdf` in the repo>

## Team
<names and roles, to be filled in by the team>
