import { useEffect, useMemo, useRef, useState } from "react";
import { buildModel, fmtDate, MONTHS, yearSummary } from "../lib/analytics";
import { cellCentroids, computeAoiSeries, loadCellDays, maskFromBBox, maskFromPolygons, parseGeoJSON } from "../lib/aoi";
import { copyText, exportCalendarPng, exportCsv } from "../lib/exporters";
import CalendarHeatmap from "./CalendarHeatmap";
import Climatology from "./Climatology";
import Compare from "./Compare";
import CriticalPeriods from "./CriticalPeriods";
import FireMap from "./FireMap";
import { ArrowDown } from "./Icons";

const MAX_VERTICES = 50000;

function signed(n, digits = 0) {
  return `${n >= 0 ? "+" : "−"}${Math.abs(n).toFixed(digits)}`;
}

function dayDelta(d) {
  const r = Math.round(d);
  if (r === 0) return "on the median date";
  return `${Math.abs(r)} day${Math.abs(r) === 1 ? "" : "s"} ${r > 0 ? "later" : "earlier"} than the median year`;
}

function readUrl(presetIds, minYear, maxYear) {
  const p = new URLSearchParams(window.location.search);
  const aoi = p.get("aoi");
  const bbox = (p.get("bbox") || "").split(",").map(Number);
  const validBbox = bbox.length === 4 && bbox.every(Number.isFinite) && bbox[0] < bbox[2] && bbox[1] < bbox[3];
  const y = Number(p.get("y"));
  const m = p.get("m") == null ? null : Number(p.get("m"));
  return {
    aoi: aoi === "custom" && validBbox ? "custom" : presetIds.includes(aoi) ? aoi : "punjab-haryana",
    bbox: validBbox ? bbox : null,
    year: y >= minYear && y <= maxYear ? y : maxYear,
    month: m != null && m >= 0 && m <= 11 ? m : null,
    mode: p.get("mode") === "anomaly" ? "anomaly" : "activity",
    cmp: p.get("cmp") || "",
  };
}

const rectName = ([w, s, e, n]) => `Custom area · ${((s + n) / 2).toFixed(1)}°N ${((w + e) / 2).toFixed(1)}°E`;

export default function Explorer({ aois, meta, cells, cm }) {
  const presetIds = useMemo(() => aois.map((a) => a.id), [aois]);
  const models = useMemo(() => Object.fromEntries(aois.map((a) => [a.id, buildModel(a, meta)])), [aois, meta]);
  const anyModel = models[presetIds[0]];
  const minYear = anyModel.completeYears[0];
  const maxYear = anyModel.completeYears[anyModel.completeYears.length - 1];
  const initial = useMemo(() => readUrl(presetIds, minYear, maxYear), [presetIds, minYear, maxYear]);

  const [aoiId, setAoiId] = useState(initial.aoi);
  const [year, setYear] = useState(initial.year);
  const [mode, setMode] = useState(initial.mode);
  const [mapMonth, setMapMonth] = useState(initial.month);
  const [cmpId, setCmpId] = useState(initial.cmp);
  const [custom, setCustom] = useState(null);
  const [drawing, setDrawing] = useState(false);
  const [toast, setToast] = useState("");
  const fileRef = useRef(null);
  const lastModel = useRef(models[initial.aoi] || models["punjab-haryana"]);
  const centroids = useMemo(() => cellCentroids(cells), [cells]);

  const customModel = useMemo(() => (custom?.status === "ready" ? buildModel(custom.aoi, meta) : null), [custom, meta]);

  const toastTimer = useRef(null);
  const flash = (msg) => {
    clearTimeout(toastTimer.current);
    setToast(msg);
    toastTimer.current = setTimeout(() => setToast(""), 4500);
  };

  const startCustom = ({ bbox, polygons, source, name }) => {
    const previous = { aoiId, custom };
    setDrawing(false);
    setAoiId("custom");
    setCustom({ status: "loading", source, name, bbox });
    const fail = (message) => {
      setAoiId(previous.aoiId === "custom" && previous.custom?.status !== "ready" ? "punjab-haryana" : previous.aoiId);
      setCustom(previous.custom?.status === "ready" ? previous.custom : null);
      flash(message);
    };
    loadCellDays(meta)
      .then((cd) => {
        const mask = polygons ? maskFromPolygons(centroids, polygons) : maskFromBBox(centroids, bbox);
        const res = computeAoiSeries(mask, cd, meta);
        if (res.cells === 0) {
          fail("No fire detections fall inside that area. The data currently covers India.");
          return;
        }
        setCustom({ status: "ready", source, name, bbox, aoi: { id: "custom", name, bbox, polygons, noFit: source === "rect", ...res } });
      })
      .catch((e) => fail(e.message));
  };

  const initialised = useRef(false);
  useEffect(() => {
    if (initialised.current) return;
    initialised.current = true;
    if (initial.aoi === "custom" && initial.bbox) startCustom({ bbox: initial.bbox, source: "rect", name: rectName(initial.bbox) });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const model = aoiId === "custom" ? customModel || lastModel.current : models[aoiId] || models["punjab-haryana"];
  useEffect(() => {
    lastModel.current = model;
  }, [model]);
  const aoi = model.aoi;
  const sum = yearSummary(model, year);

  const compareOptions = useMemo(() => {
    const opts = aois.filter((a) => a.id !== aoiId).map((a) => ({ id: a.id, name: a.name }));
    if (customModel && aoiId !== "custom") opts.push({ id: "custom", name: customModel.aoi.name });
    return opts;
  }, [aois, aoiId, customModel]);
  const cmpModel = cmpId && cmpId !== aoiId ? (cmpId === "custom" ? customModel : models[cmpId]) : null;

  useEffect(() => {
    const sp = new URLSearchParams();
    sp.set("aoi", aoiId);
    if (aoiId === "custom" && custom?.bbox) sp.set("bbox", custom.bbox.map((v) => v.toFixed(3)).join(","));
    sp.set("y", year);
    if (mapMonth != null) sp.set("m", mapMonth);
    if (mode !== "activity") sp.set("mode", mode);
    if (cmpId) sp.set("cmp", cmpId);
    window.history.replaceState(null, "", `?${sp.toString()}${window.location.hash}`);
  }, [aoiId, custom, year, mapMonth, mode, cmpId]);

  const select = (y, m) => {
    if (y >= minYear && y <= maxYear) setYear(y);
    if (m !== undefined) setMapMonth(m);
  };

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 5e6) return flash("That file is over 5 MB. Please simplify it first.");
    try {
      const { polygons, bbox } = parseGeoJSON(await file.text());
      const vertices = polygons.reduce((n, rings) => n + rings.reduce((m, r) => m + r.length, 0), 0);
      if (vertices > MAX_VERTICES) return flash(`That outline has ${vertices.toLocaleString()} vertices. Please simplify it below ${MAX_VERTICES.toLocaleString()}.`);
      startCustom({ bbox, polygons, source: "file", name: file.name.replace(/\.[^.]+$/, "").slice(0, 40) || "Uploaded area" });
    } catch (err) {
      flash(err.message);
    }
  };

  const toggleDrawing = () => {
    setDrawing((d) => !d);
    document.querySelector(".map-wrap")?.scrollIntoView({ block: "center", behavior: "smooth" });
  };

  const share = async () => {
    const ok = await copyText(window.location.href);
    flash(ok ? (aoiId === "custom" && custom?.source === "file" ? "Link copied. Uploaded outlines are shared as their bounding box." : "Link copied.") : "Could not copy the link.");
  };

  return (
    <section id="explore" className="section" aria-label="Explorer">
      <div className="section-head">
        <div className="eyebrow caps">02 · Explore</div>
        <h2>When does it burn<span className="dot">?</span></h2>
        <p>
          Pick a region and a year, or draw your own area. Every square is one day of satellite fire detections, harmonised so a day in
          2004 can be fairly compared with a day in 2024.
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
              {custom && (
                <span className="chip-group">
                  <button className="chip" aria-pressed={aoiId === "custom"} onClick={() => custom.status === "ready" && setAoiId("custom")}>
                    {custom.status === "loading" ? "Calibrating…" : custom.name}
                  </button>
                  <button
                    className="chip-x"
                    aria-label="Remove custom area"
                    onClick={() => {
                      setCustom(null);
                      if (aoiId === "custom") setAoiId("punjab-haryana");
                      if (cmpId === "custom") setCmpId("");
                    }}
                  >
                    ×
                  </button>
                </span>
              )}
            </div>
            <div className="actions">
              <button className="btn-sm" aria-pressed={drawing} onClick={toggleDrawing}>{drawing ? "Cancel drawing" : "Draw on map"}</button>
              <button className="btn-sm" onClick={() => fileRef.current?.click()}>Upload GeoJSON</button>
              <input ref={fileRef} type="file" accept=".geojson,.json,application/geo+json,application/json" hidden onChange={onFile} />
              <label className="select-wrap">
                <span className="sr">Compare with</span>
                <select value={cmpId} onChange={(e) => setCmpId(e.target.value)} aria-label="Compare with another area">
                  <option value="">Compare with…</option>
                  {compareOptions.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
              </label>
            </div>
            {aoi.lowData && aoiId === "custom" && <p className="warn">Few detections here, so the calibration is noisy. Treat estimates before 2012 with caution.</p>}
            <p className="hint" style={{ margin: "10px 0 0" }}>
              {aoi.cells.toLocaleString()} map cells with fire detections · data currently covers India · a global pipeline is on the roadmap.
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
              <small>{sum.medStart == null ? `ends ${fmtDate(year, sum.main.end)}` : dayDelta(sum.main.start - sum.medStart)}</small>
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
            <div className="toolbar">
              <div className="seg" role="group" aria-label="Colour mode">
                <button aria-pressed={mode === "activity"} onClick={() => setMode("activity")}>Activity</button>
                <button aria-pressed={mode === "anomaly"} onClick={() => setMode("anomaly")}>Anomaly</button>
              </div>
              <div className="seg" role="group" aria-label="Share and export">
                <button onClick={share} title="Copy a link to this exact view">Copy link</button>
                <button onClick={() => exportCsv(model)} title="Download the daily series">CSV</button>
                <button onClick={() => exportCalendarPng(model, year, mode)} title="Download the calendar as an image">PNG</button>
              </div>
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

        {cmpModel && (
          <div className="panel" style={{ marginBottom: 18 }}>
            <div className="panel-top">
              <div>
                <h3>Compare regions in {year}</h3>
                <p className="hint">Do two regions burn at the same time of year? Each curve is scaled to its region's own typical peak.</p>
              </div>
              <button className="btn-sm" onClick={() => setCmpId("")}>Close comparison</button>
            </div>
            <Compare a={model} b={cmpModel} year={year} />
          </div>
        )}

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
          <FireMap
            cells={cells}
            cm={cm}
            aoi={aoi}
            year={year}
            month={mapMonth}
            drawing={drawing}
            onDrawn={(bbox) => startCustom({ bbox, source: "rect", name: rectName(bbox) })}
          />
          <p className="map-note">
            Map cells come from whichever sensor was flying that month, so MODIS-era maps are sparser than VIIRS-era ones by design. The
            calendar and charts above are the harmonised, comparable view.
          </p>
        </div>
      </div>

      {toast && <div className="toast" role="status">{toast}</div>}

      <div className="section-foot">
        <span className="caps">PAGE 2</span>
        <span className="center">Explorer</span>
        <a className="round-btn right" href="#method" aria-label="Scroll to the method"><ArrowDown /></a>
      </div>
    </section>
  );
}
