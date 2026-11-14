import { scaleLinear } from "d3";
import { useEffect, useState } from "react";
import { MONTHS } from "../lib/analytics";
import { useSize } from "../lib/hooks";
import { useExplorer } from "../state/Explorer";

const base = import.meta.env.BASE_URL;
let cache = null;
const load = () => (cache ||= fetch(`${base}data/burned_area.json`).then((r) => (r.ok ? r.json() : {})).catch(() => ({})));

// share of the year's activity per calendar month, from the harmonised series over [from, to] ("YYYY-MM")
function ourProfile(model, from, to) {
  const sum = new Array(12).fill(0);
  const cnt = new Array(12).fill(0);
  const key = (y, m) => y * 12 + m;
  const [fy, fm] = from.split("-").map(Number);
  const [ty, tm] = to.split("-").map(Number);
  for (const y of model.years) {
    const d = model.byYear[y];
    const monthSum = new Array(12).fill(0);
    const monthN = new Array(12).fill(0);
    for (let i = 0; i < d.n; i++) {
      if (Number.isNaN(d.vals[i])) continue;
      const m = new Date(Date.UTC(y, 0, 1 + i)).getUTCMonth();
      monthSum[m] += d.vals[i];
      monthN[m]++;
    }
    for (let m = 0; m < 12; m++) {
      const k = key(y, m);
      if (k < key(fy, fm - 1) || k > key(ty, tm - 1) || monthN[m] < 25) continue;
      sum[m] += monthSum[m];
      cnt[m]++;
    }
  }
  const mean = sum.map((s, m) => (cnt[m] ? s / cnt[m] : 0));
  const tot = mean.reduce((a, b) => a + b, 0) || 1;
  return mean.map((v) => v / tot);
}

const corr = (a, b) => {
  const ma = a.reduce((s, v) => s + v, 0) / a.length;
  const mb = b.reduce((s, v) => s + v, 0) / b.length;
  let n = 0;
  let da = 0;
  let db = 0;
  a.forEach((v, i) => {
    n += (v - ma) * (b[i] - mb);
    da += (v - ma) ** 2;
    db += (b[i] - mb) ** 2;
  });
  return n / Math.sqrt(da * db);
};

const M = { l: 40, r: 12, t: 10, b: 26 };
const H = 230;

export default function BurnedOverlay() {
  const { model, aoiId } = useExplorer();
  const [ref, { w }] = useSize();
  const [data, setData] = useState(null);
  useEffect(() => {
    load().then(setData);
  }, []);
  const entry = data?.[aoiId];
  if (!entry || !model) {
    return <p className="hint">No independent burned-area reference is bundled for this area. Choose one of the validated regions (India, the Amazon arc, southern Africa, Siberia and others) to see the check.</p>;
  }
  const series = [];
  if (entry.gfed) series.push({ id: "gfed", label: "GFED4.1s burned area", from: entry.gfedFrom, to: entry.gfedTo, ref: entry.gfed, color: "#6fb3ff" });
  if (entry.mcd) series.push({ id: "mcd", label: "NASA MCD64A1 burned area", from: entry.mcdFrom, to: entry.mcdTo, ref: entry.mcd, color: "#9ad1a0" });
  const first = series[0];
  const ours = ourProfile(model, first.from, first.to);
  const iw = Math.max(w - M.l - M.r, 10);
  const ih = H - M.t - M.b;
  const all = [...ours, ...series.flatMap((s) => s.ref)];
  const x = scaleLinear().domain([0, 11]).range([0, iw]);
  const y = scaleLinear().domain([0, Math.max(...all) * 1.1]).range([ih, 0]);
  const path = (arr) => arr.map((v, i) => `${i ? "L" : "M"}${x(i)},${y(v)}`).join("");
  const results = series.map((s) => {
    const o = ourProfile(model, s.from, s.to);
    return { ...s, ours: o, r: corr(o, s.ref) };
  });
  return (
    <div className="chart" ref={ref}>
      {w > 0 && (
        <svg height={H} role="img" aria-label="Seasonal profile of the harmonised fire series against independent burned-area data.">
          <g transform={`translate(${M.l},${M.t})`}>
            {y.ticks(4).map((t) => (
              <g key={t}>
                <line x1={0} x2={iw} y1={y(t)} y2={y(t)} stroke="rgba(230,200,170,0.1)" />
                <text x={-8} y={y(t) + 3.5} textAnchor="end" fill="#9d8f82" fontSize="10" fontWeight="600">{Math.round(t * 100)}%</text>
              </g>
            ))}
            {MONTHS.map((m, i) => <text key={m} x={x(i)} y={ih + 18} textAnchor="middle" fill="#9d8f82" fontSize="10" fontWeight="600">{iw / 12 < 34 ? m[0] : m.toUpperCase()}</text>)}
            {results.map((s) => <path key={s.id} d={path(s.ref)} fill="none" stroke={s.color} strokeWidth="2.5" strokeDasharray="6 4" />)}
            <path d={path(ours)} fill="none" stroke="#ffb869" strokeWidth="3" />
            {ours.map((v, i) => <circle key={i} cx={x(i)} cy={y(v)} r="3.5" fill="#ffb869" />)}
          </g>
        </svg>
      )}
      <div className="legend">
        <span><i style={{ background: "#ffb869" }} />Harmonised fire detections</span>
        {results.map((s) => <span key={s.id}><i style={{ background: s.color }} />{s.label} ({s.from} to {s.to}): r = {s.r.toFixed(2)}</span>)}
      </div>
      <p className="hint">Each line shows the share of a year's activity falling in each month, so the shapes can be compared even though one counts detections and the other area burned.</p>
    </div>
  );
}
