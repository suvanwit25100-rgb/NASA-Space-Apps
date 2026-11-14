import { scaleBand, scaleLinear } from "d3";
import { useEffect, useState } from "react";
import { MONTHS } from "../lib/analytics";
import { useSize } from "../lib/hooks";
import { useExplorer } from "../state/Explorer";

const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
const sd = (a) => {
  const m = mean(a);
  return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / a.length);
};
const cache = new Map();

function monthly(model, y) {
  const d = model.byYear[y];
  const s = new Array(12).fill(0);
  const n = new Array(12).fill(0);
  for (let i = 0; i < d.n; i++) {
    if (Number.isNaN(d.vals[i])) continue;
    const m = new Date(Date.UTC(y, 0, 1 + i)).getUTCMonth();
    s[m] += d.vals[i];
    n[m]++;
  }
  return s.map((v, m) => (n[m] >= 25 ? v : null));
}

function MiniBars({ label, values, fmt, color }) {
  const [ref, { w }] = useSize();
  const H = 74;
  const iw = Math.max(w - 8, 10);
  const x = scaleBand().domain(MONTHS.map((_, i) => i)).range([0, iw]).padding(0.25);
  const ext = Math.max(0.0001, ...values.filter((v) => v != null).map(Math.abs));
  const y = scaleLinear().domain([-ext, ext]).range([H, 0]);
  return (
    <div className="mini-row" ref={ref}>
      <span className="caps">{label}</span>
      {w > 0 && (
        <svg height={H + 14} role="img" aria-label={label}>
          <line x1={0} x2={iw} y1={y(0)} y2={y(0)} stroke="rgba(245,239,230,.4)" strokeDasharray="3 3" />
          {values.map((v, i) =>
            v == null ? null : (
              <rect key={i} x={x(i)} y={Math.min(y(v), y(0))} width={x.bandwidth()} height={Math.max(Math.abs(y(v) - y(0)), 1)} rx="2" fill={color(v)}>
                <title>{`${MONTHS[i]}: ${fmt(v)}`}</title>
              </rect>
            ),
          )}
          {MONTHS.map((m, i) => <text key={m} x={x(i) + x.bandwidth() / 2} y={H + 11} textAnchor="middle" fill="#9d8f82" fontSize="9" fontWeight="600">{iw / 12 < 34 ? m[0] : m.toUpperCase()}</text>)}
        </svg>
      )}
    </div>
  );
}

// Monthly temperature and rainfall anomalies for the area's centre (ERA5 via Open-Meteo), beside fire activity.
export default function WeatherContext() {
  const { model, aoi, year } = useExplorer();
  const [wx, setWx] = useState(null);
  const [state, setState] = useState("idle");
  const [w, s, e, n] = aoi?.bbox || [0, 0, 0, 0];
  const lat = (s + n) / 2;
  const lon = (w + e) / 2;
  const big = e - w > 25 || n - s > 20;
  const key = `${lat.toFixed(1)},${lon.toFixed(1)}`;

  useEffect(() => {
    setState("idle");
    setWx(null);
  }, [key]);

  if (!aoi || !model) return null;

  const load = async () => {
    setState("loading");
    try {
      if (!cache.has(key)) {
        const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat.toFixed(2)}&longitude=${lon.toFixed(2)}&start_date=2000-01-01&end_date=2025-12-31&daily=temperature_2m_mean,precipitation_sum&timezone=UTC`;
        const r = await fetch(url);
        if (!r.ok) throw new Error(String(r.status));
        cache.set(key, (await r.json()).daily);
      }
      setWx(cache.get(key));
      setState("ready");
    } catch {
      setState("error");
    }
  };

  if (big) return <p className="hint">This area is too large for one weather point to mean much. Pick a region or a smaller country, or draw a smaller area.</p>;
  if (state !== "ready") {
    return (
      <div>
        <p className="hint">
          Loads monthly temperature and rainfall for the centre of this area ({lat.toFixed(1)}°, {lon.toFixed(1)}°) from the free Open-Meteo service (ERA5 reanalysis). Only those coordinates are sent, and only when you press the button.
        </p>
        <button className="btn-sm" onClick={load} disabled={state === "loading"}>{state === "loading" ? "Loading…" : state === "error" ? "Could not load, try again" : "Load weather context"}</button>
      </div>
    );
  }

  const T = new Map();
  const P = new Map();
  wx.time.forEach((t, i) => {
    const y = Number(t.slice(0, 4));
    const m = Number(t.slice(5, 7)) - 1;
    const k = `${y}-${m}`;
    if (wx.temperature_2m_mean[i] != null) (T.get(k) || T.set(k, []).get(k)).push(wx.temperature_2m_mean[i]);
    if (wx.precipitation_sum[i] != null) (P.get(k) || P.set(k, []).get(k)).push(wx.precipitation_sum[i]);
  });
  const years = model.completeYears;
  const tm = (y, m) => (T.get(`${y}-${m}`) ? mean(T.get(`${y}-${m}`)) : null);
  const pm = (y, m) => (P.get(`${y}-${m}`) ? P.get(`${y}-${m}`).reduce((a, b) => a + b, 0) : null);
  const tAnom = [];
  const pAnom = [];
  const fAnom = [];
  const fire = Object.fromEntries(years.map((y) => [y, monthly(model, y)]));
  for (let m = 0; m < 12; m++) {
    const others = years.filter((y) => y !== year);
    const t0 = others.map((y) => tm(y, m)).filter((v) => v != null);
    const p0 = others.map((y) => pm(y, m)).filter((v) => v != null);
    const f0 = others.map((y) => fire[y][m]).filter((v) => v != null);
    const t1 = tm(year, m);
    const p1 = pm(year, m);
    const f1 = fire[year]?.[m];
    tAnom.push(t1 != null && t0.length > 5 ? t1 - mean(t0) : null);
    pAnom.push(p1 != null && p0.length > 5 && mean(p0) > 1 ? (p1 / mean(p0) - 1) * 100 : null);
    fAnom.push(f1 != null && f0.length > 5 && sd(f0) > 0 ? (f1 - mean(f0)) / sd(f0) : null);
  }
  const warm = (v) => (v >= 0 ? "#ff8a1f" : "#6fb3ff");
  const wet = (v) => (v >= 0 ? "#6fb3ff" : "#ffb869");
  return (
    <div>
      <MiniBars label={`Temperature anomaly in ${year}`} values={tAnom} fmt={(v) => `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(1)} °C vs other years`} color={warm} />
      <MiniBars label={`Rainfall vs normal in ${year}`} values={pAnom} fmt={(v) => `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(0)}% vs other years`} color={wet} />
      <MiniBars label={`Fire activity anomaly in ${year}`} values={fAnom} fmt={(v) => `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(1)} standard deviations vs other years`} color={warm} />
      <p className="hint">Hot and dry months above the line usually line up with more fire. Weather at the area's centre point is only a rough guide for large areas. Weather: Open-Meteo.com (ERA5 reanalysis, CC BY 4.0).</p>
    </div>
  );
}
