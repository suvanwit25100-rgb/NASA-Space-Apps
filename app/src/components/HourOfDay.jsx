import { scaleLinear } from "d3";
import { useState } from "react";
import { MONTHS } from "../lib/analytics";
import { useSize } from "../lib/hooks";
import { useExplorer } from "../state/Explorer";

const base = import.meta.env.BASE_URL;
let cache = null;
const load = () => (cache ||= fetch(`${base}data/hours.json`).then((r) => (r.ok ? r.json() : null)).catch(() => null));

const SENSORS = [
  { i: 0, label: "Terra (MODIS, about 10:30 and 22:30)", color: "#6fb3ff" },
  { i: 1, label: "Aqua (MODIS, about 13:30 and 01:30)", color: "#9ad1a0" },
  { i: 2, label: "Suomi NPP (VIIRS, about 13:30 and 01:30)", color: "#ffb869" },
];
const M = { l: 44, r: 12, t: 12, b: 28 };
const H = 230;

// Local solar hour of every vegetation-fire detection, from pipeline/fetch_hours.py (sample years, not all 26).
export default function HourOfDay() {
  const { aoiId, aoi } = useExplorer();
  const [ref, { w }] = useSize();
  const [data, setData] = useState(null);
  const [state, setState] = useState("idle");
  const [month, setMonth] = useState(-1); // -1 = all year

  const open = async () => {
    setState("loading");
    const d = await load();
    setData(d);
    setState(d ? "ready" : "error");
  };

  if (state !== "ready") {
    return (
      <div>
        <p className="hint">Shows the local time of day of each detection, from the satellites' own timestamps. About 1 MB, loaded only when you ask.</p>
        <button className="btn-sm" onClick={open} disabled={state === "loading"}>{state === "loading" ? "Loading…" : state === "error" ? "Could not load, try again" : "Show time of day"}</button>
      </div>
    );
  }
  const a = data.areas[aoiId];
  if (!a) return <p className="hint">No time-of-day data for this area (custom areas are not covered).</p>;

  const series = SENSORS.map((s) => {
    const hours = new Array(24).fill(0);
    for (let m = 0; m < 12; m++) if (month < 0 || m === month) for (let h = 0; h < 24; h++) hours[h] += a[s.i][m][h];
    const tot = hours.reduce((x, y) => x + y, 0);
    return { ...s, tot, share: hours.map((v) => (tot > 0 ? v / tot : 0)) };
  }).filter((s) => s.tot >= 200);

  const iw = Math.max(w - M.l - M.r, 10);
  const ih = H - M.t - M.b;
  const x = scaleLinear().domain([0, 24]).range([0, iw]);
  const ymax = Math.max(0.05, ...series.flatMap((s) => s.share)) * 1.1;
  const y = scaleLinear().domain([0, ymax]).range([ih, 0]);
  const night = (s) => {
    let n = 0;
    for (let h = 0; h < 24; h++) if (h >= 18 || h < 6) n += s.share[h];
    return n;
  };
  const v = series.find((s) => s.i === 2);

  return (
    <div className="chart" ref={ref}>
      <div className="pill-row" role="group" aria-label="Month">
        <button className="chip" aria-pressed={month < 0} onClick={() => setMonth(-1)}>All year</button>
        {MONTHS.map((m, i) => <button key={m} className="chip" aria-pressed={month === i} onClick={() => setMonth(i)}>{m}</button>)}
      </div>
      {series.length === 0 ? (
        <p className="hint">Too few detections in {month < 0 ? "this area" : MONTHS[month]} to draw a profile.</p>
      ) : (
        w > 0 && (
          <svg height={H} role="img" aria-label="Share of each satellite's detections by local solar hour.">
            <g transform={`translate(${M.l},${M.t})`}>
              <rect x={x(18)} y={0} width={x(24) - x(18)} height={ih} fill="rgba(111,179,255,.07)" />
              <rect x={0} y={0} width={x(6)} height={ih} fill="rgba(111,179,255,.07)" />
              {y.ticks(4).map((t) => (
                <g key={t}>
                  <line x1={0} x2={iw} y1={y(t)} y2={y(t)} stroke="rgba(230,200,170,.1)" />
                  <text x={-8} y={y(t) + 3.5} textAnchor="end" fill="#9d8f82" fontSize="10" fontWeight="600">{Math.round(t * 100)}%</text>
                </g>
              ))}
              {[0, 3, 6, 9, 12, 15, 18, 21].map((h) => <text key={h} x={x(h + 0.5)} y={ih + 18} textAnchor="middle" fill="#9d8f82" fontSize="10" fontWeight="600">{String(h).padStart(2, "0")}:00</text>)}
              {series.map((s) => (
                <g key={s.i}>
                  {s.share.map((p, h) => <rect key={h} x={x(h) + 1 + s.i * ((x(1) - x(0) - 2) / 3)} y={y(p)} width={(x(1) - x(0) - 2) / 3} height={ih - y(p)} fill={s.color} opacity=".9"><title>{`${s.label}: ${(p * 100).toFixed(1)}% of detections at ${String(h).padStart(2, "0")}:00 local solar time`}</title></rect>)}
                </g>
              ))}
            </g>
          </svg>
        )
      )}
      <div className="legend">{series.map((s) => <span key={s.i}><i style={{ background: s.color }} />{s.label}</span>)}</div>
      <p className="hint">
        {v ? `${Math.round(night(v) * 100)}% of ${aoi?.name || "this area"}'s VIIRS detections${month < 0 ? "" : ` in ${MONTHS[month]}`} were made at night (shaded, 18:00 to 06:00 local solar time). ` : ""}
        The bars cluster around each satellite's fixed overpass times because that is the only time it looks, so this is when fires are <em>seen</em>, not a continuous daily curve. Local solar time is UTC plus longitude/15. Built from a sample of years ({data.years.viirs} for VIIRS, {data.years.modis} for MODIS).
      </p>
    </div>
  );
}
