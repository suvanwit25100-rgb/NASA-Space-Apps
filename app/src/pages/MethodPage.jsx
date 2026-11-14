import { useEffect, useState } from "react";
import Holdout from "../components/Holdout";
import { ChapterNav, PageHead } from "../components/PageHead";
import { looksPerDay } from "../lib/overpass";

const base = import.meta.env.BASE_URL;
const STEPS = [
  ["Filter", "Keep vegetation fire only (dropping volcanoes, gas flares and offshore sources) and discard low-confidence pixels."],
  ["Grid", "Collapse the raw points onto an H3 hexagon grid. The unit is a burning cell-day: a cell with at least one detection on a day."],
  ["Calibrate", "Learn seasonal ratios on the years two sensors overlap: Aqua against VIIRS from 2012, and Terra against Aqua before VIIRS existed."],
  ["Extend", "Apply the ratios to the MODIS-only years so 2000 to 2011 reads on the VIIRS scale, with an uncertainty band that travels with every estimate."],
  ["Validate", "Compare the result's seasonality against two independent burned-area datasets, not against itself."],
];

export default function MethodPage() {
  const [validation, setValidation] = useState(null);
  useEffect(() => {
    fetch(`${base}data/validation.json`).then((r) => (r.ok ? r.json() : null)).then(setValidation).catch(() => {});
  }, []);
  const regions = validation?.gfedRegions || [];
  const strong = regions.filter((r) => r.climatologyR >= 0.9).length;

  return (
    <main className="page">
      <PageHead path="/method" />
      <section className="panel">
        <h2>One record, many sensors</h2>
        <p className="lead-text">
          Satellites don't see fire the same way. VIIRS resolves 375 m pixels and finds far more small fires than MODIS's 1 km pixels, so a naive count
          jumps about sixfold the day VIIRS comes online in 2012 (India's 2020 numbers: 76,000 MODIS detections against 490,000 from VIIRS). This is how
          that jump is removed.
        </p>
        <ol className="steps">
          {STEPS.map(([t, p], i) => (
            <li key={t} className="step-card">
              <span className="roman" aria-hidden="true">{String(i + 1).padStart(2, "0")}</span>
              <h3>{t}</h3>
              <p>{p}</p>
            </li>
          ))}
        </ol>
      </section>

      <div className="grid-2">
        <figure className="panel fig">
          <img src={`${base}img/before_after_India.png`} alt="Two stacked time-series charts for India, 2000 to 2025. Top: raw detections per sensor, with a large jump when VIIRS begins in 2012. Bottom: burning cell-days on the grid, with the jump damped." loading="lazy" />
          <figcaption><b>Before (India).</b> Raw detections jump about sixfold when VIIRS starts in January 2012. Gridding alone damps it but doesn't remove it.</figcaption>
        </figure>
        <figure className="panel fig">
          <img src={`${base}img/calibration_India.png`} alt="Three stacked charts: raw per-sensor burning cell-days, the uncalibrated sum with a visible jump in 2012, and the calibrated series with no jump." loading="lazy" />
          <figcaption><b>After (India).</b> Seasonal calibration brings 2000 to 2011 onto the VIIRS scale. The step at 2012 disappears and the seasonal shape is preserved.</figcaption>
        </figure>
      </div>

      {regions.length > 0 && (
        <section className="panel fig">
          <h2>Does it hold worldwide?</h2>
          <p className="hint">
            The same series, checked against GFED4.1s burned area in {regions.length} regions with very different fire regimes (2000 to 2016). In <b>{strong} of {regions.length}</b>{" "}
            the seasonal cycle correlates at r = 0.90 or better, including southern African savanna, Siberian boreal forest, peat fires in Sumatra and Kalimantan, and the Mediterranean.
          </p>
          <img src={`${base}img/validation_regions_gfed.png`} alt="Twelve small charts comparing the seasonal cycle of harmonised fire detections with GFED burned area in twelve regions around the world." loading="lazy" />
          <figcaption>
            <b>Where it is weaker.</b> California, Boreal Canada and Southeast Australia agree less. In those regions a handful of very large fires dominate burned area, while cell-days
            count where and when fire was detected, not how much land burned, so the two measures can legitimately disagree. Treat seasonal timing there as indicative rather than exact.
          </figcaption>
          <div className="scroll-x" style={{ marginTop: 14 }}>
            <table className="prov">
              <thead><tr><th>Region</th><th>Seasonal r</th><th>Monthly r</th></tr></thead>
              <tbody>
                {[...regions].sort((a, b) => b.climatologyR - a.climatologyR).map((r) => (
                  <tr key={r.id}>
                    <td>{r.name}</td>
                    <td className="num" style={{ color: r.climatologyR >= 0.9 ? "var(--ember-hot)" : r.climatologyR < 0.7 ? "var(--atmos)" : undefined }}>{r.climatologyR.toFixed(2)}</td>
                    <td className="num">{r.monthlyR.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <div className="grid-2">
        <Holdout />
        <section className="panel">
          <h2>How often the satellites look</h2>
          <p className="lead-text">
            A cell counts as burning if any pass sees fire in it that day, so a cell that is looked at more often has more chances to be counted. The orbits of all
            three satellites converge toward the poles, so the number of looks per day rises with latitude. Within one area this cancels out of the calendar,
            because the seasonal ratios are learned inside that area. It matters when you compare areas at different latitudes, so the Compare page and the map
            offer an adjustment.
          </p>
          <div className="scroll-x">
            <table className="prov">
              <thead><tr><th>Latitude</th><th>VIIRS looks per day</th><th>MODIS looks per day (one satellite)</th></tr></thead>
              <tbody>
                {[0, 20, 40, 60, 70].map((lat) => (
                  <tr key={lat}><td>{lat}°</td><td className="num">{looksPerDay(lat, "viirs").toFixed(1)}</td><td className="num">{looksPerDay(lat, "modis").toFixed(1)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="hint">An analytic orbit model (swath width against orbit spacing), not a measured count. It assumes detections scale with the number of looks, which overcorrects where nearly every look finds fire. It does not model orbit drift: Terra and Aqua have both drifted from their original overpass times in recent years.</p>
        </section>
        <section className="panel">
          <h2>Data provenance</h2>
          <p className="hint">Everything in the calendar comes from NASA satellites via NASA FIRMS.</p>
          <div className="scroll-x">
            <table className="prov">
              <thead><tr><th>Sensor</th><th>Resolution</th><th>Used from</th><th>Role</th></tr></thead>
              <tbody>
                <tr><td><span className="tag nasa">NASA</span> MODIS on Terra</td><td>1 km</td><td>Nov 2000</td><td>Earliest record; calibrated against Aqua</td></tr>
                <tr><td><span className="tag nasa">NASA</span> MODIS on Aqua</td><td>1 km</td><td>Jul 2002</td><td>Calibration pair (1:30 pm/am overpass)</td></tr>
                <tr><td><span className="tag nasa">NASA/NOAA</span> VIIRS on Suomi NPP</td><td>375 m</td><td>Jan 2012</td><td>Reference scale; matches Aqua's overpass time</td></tr>
              </tbody>
            </table>
          </div>
        </section>
        <section className="panel">
          <h2>Read this before you trust it</h2>
          <ul className="caveats">
            <li><b>Coverage.</b> Every country in the FIRMS archive, 2000 to 2025, plus featured regions and areas you draw. NOAA-20 and NOAA-21 are not yet included, and 2026 waits for reprocessed data.</li>
            <li><b>2000 to 2011 are estimates.</b> They carry a calibration band and are never shown as measured.</li>
            <li><b>Cell-days are not area burned.</b> They count where and when fire was detected, not how much land burned.</li>
            <li><b>One ratio per region and month.</b> Biome-specific calibration is future work.</li>
            <li><b>Seasons follow the calendar year,</b> so a season that spans New Year is split across two rows.</li>
            <li><b>Recent weeks lag.</b> Near-real-time data is later replaced by reprocessed data, so only reprocessed years are shown.</li>
          </ul>
        </section>
      </div>
      <ChapterNav path="/method" />
    </main>
  );
}
