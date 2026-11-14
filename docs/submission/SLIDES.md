# Slide deck outline (10 slides, about 3 to 4 minutes)

Build it in Google Slides, Canva or PowerPoint with the dark navy and ember-orange look of the site (colours: background #03070f, panel #0a1730, accent #ff8a1f, text #f4f8ff; font: Montserrat). Export a PDF named `slides.pdf` and put it in `docs/submission/`, or share a public Google Slides link. Use the images in this folder.

Do not use NASA logos or mission identifiers anywhere. If a slide uses an AI-generated image, it needs a visible watermark; every image listed here is made from real data or hand-coded, so none is needed.

1. **Title.** "Global Burn Log: a harmonised burning-activity calendar for the whole planet". Image: `hero.png`. Footer: globalburnlog.earth.
2. **The problem.** Fire records are 25 years long but split across sensors. VIIRS sees about six times more detections than MODIS (India, 2020), so counts jump in 2012. Users who need this: early-warning teams, land managers, scientists.
3. **Our idea.** One consistent record, built on "burning cell-days" (an H3 cell with at least one detection that day) and calibrated across sensors. Show the unit with a tiny diagram: points to hexagons to cell-days.
4. **Data from NASA.** FIRMS (MODIS Terra and Aqua, VIIRS Suomi NPP), 209 countries, 2000 to 2025, 100 million cell-days. MCD64A1 for validation. Mark NASA sources clearly.
5. **How we harmonise.** Image: `1_before_after_harmonisation.png`. One sentence: Aqua and VIIRS overpass at the same local time, so their ratio isolates the sensor effect; apply it back to 2000 to 2011 with an uncertainty band.
6. **The product.** Image: `2_ui_explorer.png`. Callouts: calendar heatmap, anomaly view, fire seasons, map, draw any area, compare, export, shareable links.
7. **Demo moment: Punjab and Haryana.** Autumn 2025 began around 13 October (about 13 days later than usual) and was the lowest of 25 years (-63% against a typical autumn). Image: `ui_seasons.png`.
8. **Validation.** Image: `4_validation_global.png`. 7 of 12 regions at seasonal r of 0.90 or better and a 0.84 average; MCD64A1 r = 0.93 for India. Be upfront about the three weak regions and why (a few huge fires dominate burned area).
9. **How it is built.** Image: `3_architecture.png`. Static files on a CDN, no server, no login, always up; reproducible pipeline; calibration verified identical in the browser and in Python.
10. **Impact, limits and next steps.** Limits: cell-days are not area burned; 2000 to 2011 are estimates; NOAA-20/21 and 2026 not yet included. Next: add NOAA-20/21, near-real-time early-warning banner, biome-specific calibration. Closing: link, QR code to globalburnlog.earth, team names, AI disclosure line ("Built with AI assistance (Claude) for planning and code; goals and design decisions by the team").
