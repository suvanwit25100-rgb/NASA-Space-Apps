import { ArrowDown } from "./Icons";

const base = import.meta.env.BASE_URL;

const STEPS = [
  ["Filter", "Keep vegetation-fire detections only (dropping volcanoes, gas flares and offshore sources) and discard low-confidence pixels."],
  ["Grid", "Collapse each sensor's raw points onto an H3 hexagon grid. The unit is a burning cell-day: a cell with at least one detection on a day."],
  ["Calibrate", "Learn seasonal ratios on the years two sensors overlap: Aqua against VIIRS from 2012, and Terra against Aqua before VIIRS existed."],
  ["Extend", "Apply the ratios to the MODIS-only years so 2000 to 2011 reads on the VIIRS scale, with an uncertainty band that travels with every estimate."],
  ["Validate", "Compare the result's seasonality against an independent burned-area dataset, not against itself."],
];

export default function Method() {
  return (
    <section id="method" className="section" aria-label="Method">
      <div className="section-head">
        <div className="eyebrow caps">03 · Method</div>
        <h2>One record, many sensors<span className="dot">.</span></h2>
        <p>
          Satellites don't see fire the same way. VIIRS resolves 375 m pixels and finds far more small fires than MODIS's 1 km pixels, so a
          naive count jumps the day VIIRS comes online. This is how that jump is removed.
        </p>
      </div>

      <div className="wrap">
        <div className="steps">
          {STEPS.map(([t, p]) => (
            <div key={t} className="panel step-card">
              <h3>{t}</h3>
              <p>{p}</p>
            </div>
          ))}
        </div>

        <div className="figs">
          <figure className="panel fig" style={{ margin: 0 }}>
            <img src={`${base}img/before_after_India.png`} alt="Two stacked time-series charts for India, 2000 to 2025. Top: raw detections per sensor, with a large jump when VIIRS begins in 2012. Bottom: burning cell-days on the grid, with the jump damped." loading="lazy" />
            <figcaption><b>Before.</b> Raw detections jump roughly tenfold when VIIRS starts in January 2012. Gridding alone damps it but doesn't remove it.</figcaption>
          </figure>
          <figure className="panel fig" style={{ margin: 0 }}>
            <img src={`${base}img/calibration_India.png`} alt="Three stacked charts: raw per-sensor burning cell-days, the uncalibrated sum with a visible jump in 2012, and the calibrated series with no jump." loading="lazy" />
            <figcaption><b>After.</b> Seasonal calibration brings 2000 to 2011 onto the VIIRS scale. The step at 2012 disappears and the seasonal shape is preserved.</figcaption>
          </figure>
          <figure className="panel fig" style={{ margin: 0 }}>
            <img src={`${base}img/validation_vs_mcd64a1_India.png`} alt="Top: seasonal climatology of NASA MCD64A1 burned area against the harmonised series, correlation 0.89. Bottom: both monthly series from 2000 to 2025, normalised to their peaks, correlation 0.82." loading="lazy" />
            <figcaption><b>Validation, NASA MCD64A1.</b> Against NASA's MODIS burned-area product, an independent algorithm, the seasonal cycle correlates at r = 0.89 and the full 2000 to 2025 monthly series at r = 0.82. The harmonised series stays a little high in winter and low at the peaks, because detections last longer than the burn scar they leave.</figcaption>
          </figure>
          <figure className="panel fig" style={{ margin: 0 }}>
            <img src={`${base}img/validation_vs_gfed_India.png`} alt="Top: seasonal climatology of GFED burned area against the harmonised series, correlation 0.93. Bottom: both full time series normalised to their peaks." loading="lazy" />
            <figcaption><b>Validation, GFED4.1s.</b> A second independent check, which adds small-fire burned area. The seasonal cycle correlates at r = 0.93 over 2000 to 2016, the years GFED publishes a burned-area product. Both show the March peak and the autumn stubble-burning bump.</figcaption>
          </figure>
        </div>

        <div className="grid-2">
          <div className="panel">
            <h3>Data provenance</h3>
            <p className="hint">Everything in the calendar comes from NASA satellites via NASA FIRMS.</p>
            <div className="scroll-x">
              <table className="prov">
                <thead>
                  <tr><th>Sensor</th><th>Resolution</th><th>Used from</th><th>Role</th></tr>
                </thead>
                <tbody>
                  <tr><td><span className="tag nasa">NASA</span> MODIS on Terra</td><td>1 km</td><td>Nov 2000</td><td>Earliest record; calibrated against Aqua</td></tr>
                  <tr><td><span className="tag nasa">NASA</span> MODIS on Aqua</td><td>1 km</td><td>Jul 2002</td><td>Calibration pair (1:30 pm/am overpass)</td></tr>
                  <tr><td><span className="tag nasa">NASA/NOAA</span> VIIRS on Suomi NPP</td><td>375 m</td><td>Jan 2012</td><td>Reference scale; matches Aqua's overpass time</td></tr>
                </tbody>
              </table>
            </div>
          </div>
          <div className="panel">
            <h3>Read this before you trust it</h3>
            <ul className="caveats">
              <li><b>India only, for now.</b> The pipeline is built to run globally; this release ships India and five sub-regions.</li>
              <li><b>2000 to 2011 are estimates.</b> They carry a calibration band and are never shown as measured.</li>
              <li><b>Cell-days are not area burned.</b> They count where and when fire was detected, not how much land burned.</li>
              <li><b>One ratio per region and month.</b> Biome-specific calibration is future work.</li>
              <li><b>Seasons follow the calendar year,</b> so a season that spans New Year is split across two rows.</li>
              <li><b>Recent weeks lag.</b> Near-real-time data is later replaced by reprocessed data, so only reprocessed years are shown.</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="section-foot">
        <span className="caps">PAGE 3</span>
        <span className="center">Method</span>
        <a className="round-btn right" href="#about" aria-label="Scroll to about"><ArrowDown /></a>
      </div>
    </section>
  );
}
