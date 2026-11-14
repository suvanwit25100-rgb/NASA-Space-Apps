import { useMemo, useState } from "react";
import { buildModel, fmtDate, MONTHS, yearSummary } from "../lib/analytics";
import CalendarHeatmap from "./CalendarHeatmap";
import Climatology from "./Climatology";
import CriticalPeriods from "./CriticalPeriods";
import FireMap from "./FireMap";
import { ArrowDown } from "./Icons";

function signed(n, digits = 0) {
  return `${n >= 0 ? "+" : "−"}${Math.abs(n).toFixed(digits)}`;
}

function dayDelta(d) {
  const r = Math.round(d);
  if (r === 0) return "on the median date";
  return `${Math.abs(r)} day${Math.abs(r) === 1 ? "" : "s"} ${r > 0 ? "later" : "earlier"} than the median year`;
}

export default function Explorer({ aois, meta, cells, cm }) {
  const [aoiId, setAoiId] = useState("punjab-haryana");
  const [year, setYear] = useState(meta.axisEnd ? Number(meta.axisEnd.slice(0, 4)) : 2025);
  const [mode, setMode] = useState("activity");
  const [mapMonth, setMapMonth] = useState(null);

  const models = useMemo(() => Object.fromEntries(aois.map((a) => [a.id, buildModel(a, meta)])), [aois, meta]);
  const model = models[aoiId];
  const aoi = model.aoi;
  const minYear = model.completeYears[0];
  const maxYear = model.completeYears[model.completeYears.length - 1];
  const sum = yearSummary(model, year);

  const select = (y, m) => {
    if (y >= minYear && y <= maxYear) setYear(y);
    if (m !== undefined) setMapMonth(m);
  };

  return (
    <section id="explore" className="section" aria-label="Explorer">
      <div className="section-head">
        <div className="eyebrow caps">02 · Explore</div>
        <h2>When does it burn<span className="dot">?</span></h2>
        <p>
          Pick a region and a year. Every square is one day of satellite fire detections, harmonised so a day in 2004 can be fairly
          compared with a day in 2024.
        </p>
      </div>

      <div className="wrap">
        <div className="controls">
          <div className="panel">
            <span className="label caps">Area of interest</span>
            <div className="chips" role="group" aria-label="Area of interest">
              {aois.map((a) => (
                <button key={a.id} className="chip" aria-pressed={a.id === aoiId} onClick={() => setAoiId(a.id)}>
                  {a.name}
                </button>
              ))}
            </div>
            <p className="hint" style={{ margin: "12px 0 0" }}>
              {aoi.cells.toLocaleString()} map cells · more regions, custom drawing and a global pipeline are on the roadmap.
            </p>
          </div>
          <div className="panel">
            <span className="label caps">Year</span>
            <div className="year-row">
              <button className="step" aria-label="Previous year" disabled={year <= minYear} onClick={() => select(year - 1)}>‹</button>
              <input type="range" min={minYear} max={maxYear} value={year} onChange={(e) => select(Number(e.target.value))} aria-label="Year" />
              <button className="step" aria-label="Next year" disabled={year >= maxYear} onClick={() => select(year + 1)}>›</button>
              <span className="year-big num">{year}</span>
            </div>
            <p className="hint" style={{ margin: "10px 0 0" }}>
              {year >= 2012 ? "Measured directly by VIIRS (375 m)." : "Estimated from MODIS and calibrated to VIIRS; see the uncertainty band."}
            </p>
          </div>
        </div>

        {sum && (
          <div className="story">
            <div className="panel lead">
              In <em>{aoi.name}</em>, the main burning season of <em>{year}</em> ran from <em>{fmtDate(year, sum.main.start)}</em> to{" "}
              <em>{fmtDate(year, sum.main.end)}</em>, peaking the week of <em>{fmtDate(year, sum.main.peakWeek)}</em> and holding{" "}
              <em>{Math.round(sum.main.share * 100)}%</em> of the year's activity.
              {sum.others.length > 0 && (
                <> A second season ran {fmtDate(year, sum.others[0].start)} to {fmtDate(year, sum.others[0].end)} ({Math.round(sum.others[0].share * 100)}%).</>
              )}{" "}
              Overall activity was <em>{signed(sum.vsMedian * 100)}%</em> versus the median year.
            </div>
            <div className="panel kpi">
              <b className="num">{fmtDate(year, sum.main.start)}</b>
              <span className="caps">Main season starts</span>
              <small>{sum.medStart == null ? `ends ${fmtDate(year, sum.main.end)}` : `${dayDelta(sum.main.start - sum.medStart)}`}</small>
            </div>
            <div className="panel kpi">
              <b className="num">{fmtDate(year, sum.main.peakWeek)}</b>
              <span className="caps">Peak week begins</span>
              <small>season ends {fmtDate(year, sum.main.end)}</small>
            </div>
            <div className="panel kpi">
              <b className="num">{Math.round(sum.total).toLocaleString()}</b>
              <span className="caps">Burning cell-days</span>
              <small className={sum.vsMedian >= 0 ? "up" : "down"}>
                {signed(sum.vsMedian * 100)}% vs median · #{sum.rankAbove} of {sum.nYears} years
              </small>
            </div>
          </div>
        )}

        <div className="panel" style={{ marginBottom: 18 }}>
          <div className="panel-top">
            <div>
              <h3>Burning activity calendar</h3>
              <p className="hint">One row per year, one column per day. Hover for the value, anomaly and confidence; click a row to select that year.</p>
            </div>
            <div className="seg" role="group" aria-label="Colour mode">
              <button aria-pressed={mode === "activity"} onClick={() => setMode("activity")}>Activity</button>
              <button aria-pressed={mode === "anomaly"} onClick={() => setMode("anomaly")}>Anomaly</button>
            </div>
          </div>
          <CalendarHeatmap model={model} year={year} mode={mode} onSelect={select} />
        </div>

        <div className="grid-2">
          <div className="panel">
            <h3>Climatology and {year}</h3>
            <p className="hint">The typical year, and where {year} sat against it. Shaded bands are {year}'s fire seasons.</p>
            <Climatology model={model} year={year} />
          </div>
          <div className="panel">
            <h3>Fire seasons, every year</h3>
            <p className="hint">A season is a stretch where activity stays above about 15% of that year's peak. Regions with two seasons show two bars; watch them drift over the years.</p>
            <CriticalPeriods model={model} year={year} onSelect={select} />
          </div>
        </div>

        <div className="panel">
          <div className="panel-top">
            <div>
              <h3>Where it burned</h3>
              <p className="hint">Cells with satellite-detected fire. Click a day in the calendar to jump to its month, or choose below.</p>
            </div>
          </div>
          <div className="chips" style={{ marginBottom: 14 }} role="group" aria-label="Map period">
            <button className="chip" aria-pressed={mapMonth == null} onClick={() => setMapMonth(null)}>Full year</button>
            {MONTHS.map((m, i) => (
              <button key={m} className="chip" aria-pressed={mapMonth === i} onClick={() => setMapMonth(i)}>{m}</button>
            ))}
          </div>
          <FireMap cells={cells} cm={cm} aoi={aoi} year={year} month={mapMonth} />
          <p className="map-note">
            Map cells come from whichever sensor was flying that month, so MODIS-era maps are sparser than VIIRS-era ones by design. The
            calendar and charts above are the harmonised, comparable view.
          </p>
        </div>
      </div>

      <div className="section-foot">
        <span className="caps">PAGE 2</span>
        <span className="center">Explorer</span>
        <a className="round-btn right" href="#method" aria-label="Scroll to the method"><ArrowDown /></a>
      </div>
    </section>
  );
}
