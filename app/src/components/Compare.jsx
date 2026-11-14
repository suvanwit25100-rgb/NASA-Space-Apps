import { useMemo } from "react";
import { area, line, scaleLinear } from "d3";
import { fmtDate, MONTHS, monthStartDoy, yearSummary } from "../lib/analytics";
import { useSize } from "../lib/hooks";

const M = { l: 44, r: 14, t: 12, b: 26 };
const COLORS = { a: "#ff8a1f", b: "#5fb0ff" };

function curves(model, year) {
  let peak = 1;
  for (let d = 0; d < 366; d++) if (model.clim.median[d] > peak) peak = model.clim.median[d];
  const norm = (arr) => Array.from(arr, (v) => v / peak);
  return { median: norm(model.clim.median), cur: norm(model.byYear[year].sm), p10: norm(model.clim.p10), p90: norm(model.clim.p90), n: model.byYear[year].n };
}

export default function Compare({ a, b, year }) {
  const [ref, { w }] = useSize();
  const H = 240;
  const iw = Math.max(w - M.l - M.r, 10);
  const ih = H - M.t - M.b;
  const sa = yearSummary(a, year);
  const sb = yearSummary(b, year);

  const paths = useMemo(() => {
    const ca = curves(a, year);
    const cb = curves(b, year);
    let ymax = 1;
    for (const c of [ca, cb]) for (let d = 0; d < c.n; d++) for (const v of [c.cur[d], c.p90[d]]) if (v > ymax) ymax = v;
    const x = scaleLinear().domain([0, 365]).range([0, iw]);
    const y = scaleLinear().domain([0, ymax * 1.05]).range([ih, 0]).nice();
    const ln = (arr, n) => line().defined((d) => !Number.isNaN(arr[d])).x((d) => x(d)).y((d) => y(arr[d]))(Array.from({ length: n }, (_, i) => i));
    const band = (c) => area().defined((d) => !Number.isNaN(c.p10[d])).x((d) => x(d)).y0((d) => y(c.p10[d])).y1((d) => y(c.p90[d]))(Array.from({ length: 366 }, (_, i) => i));
    return { x, y, a: { med: ln(ca.median, 366), cur: ln(ca.cur, ca.n), band: band(ca) }, b: { med: ln(cb.median, 366), cur: ln(cb.cur, cb.n), band: band(cb) } };
  }, [a, b, year, iw, ih]);

  const rows = [
    ["Main season", (s, y) => `${fmtDate(y, s.main.start)} to ${fmtDate(y, s.main.end)}`],
    ["Peak week begins", (s, y) => fmtDate(y, s.main.peakWeek)],
    ["Share of year in main season", (s) => `${Math.round(s.main.share * 100)}%`],
    ["Total cell-days", (s) => Math.round(s.total).toLocaleString()],
    ["Versus median year", (s) => `${s.vsMedian >= 0 ? "+" : "−"}${Math.abs(s.vsMedian * 100).toFixed(0)}%`],
  ];

  return (
    <div>
      <div className="chart" ref={ref}>
        {w > 0 && (
          <svg height={H} role="img" aria-label={`Seasonal curves for ${a.aoi.name} and ${b.aoi.name} in ${year}, each scaled so its own typical peak is 1.`}>
            <g transform={`translate(${M.l},${M.t})`}>
              {paths.y.ticks(4).map((t) => (
                <g key={t}>
                  <line x1={0} x2={iw} y1={paths.y(t)} y2={paths.y(t)} stroke="rgba(120,165,210,0.12)" />
                  <text x={-8} y={paths.y(t) + 3} textAnchor="end" fill="#8fa8c4" fontSize="10">{t}</text>
                </g>
              ))}
              {MONTHS.map((m, i) => (
                <text key={m} x={paths.x(monthStartDoy(2001, i)) + 3} y={ih + 16} fill="#8fa8c4" fontSize="10" fontWeight="600">{m.toUpperCase()}</text>
              ))}
              <path d={paths.a.band} fill="rgba(255,138,31,0.1)" />
              <path d={paths.b.band} fill="rgba(95,176,255,0.1)" />
              <path d={paths.a.med} fill="none" stroke={COLORS.a} strokeWidth="1.2" strokeDasharray="4 3" opacity="0.8" />
              <path d={paths.b.med} fill="none" stroke={COLORS.b} strokeWidth="1.2" strokeDasharray="4 3" opacity="0.8" />
              <path d={paths.a.cur} fill="none" stroke={COLORS.a} strokeWidth="2.2" />
              <path d={paths.b.cur} fill="none" stroke={COLORS.b} strokeWidth="2.2" />
            </g>
          </svg>
        )}
        <div className="legend" style={{ marginTop: 4 }}>
          <span><i style={{ background: COLORS.a, height: 3 }} />{a.aoi.name}, {year}</span>
          <span><i style={{ background: COLORS.b, height: 3 }} />{b.aoi.name}, {year}</span>
          <span>Dashed: each region's median year. Both are scaled to their own typical peak, so shape, not size, is compared.</span>
        </div>
      </div>
      {sa && sb && (
        <div className="scroll-x" style={{ marginTop: 14 }}>
          <table className="prov">
            <thead>
              <tr>
                <th>{year}</th>
                <th style={{ color: COLORS.a }}>{a.aoi.name}</th>
                <th style={{ color: COLORS.b }}>{b.aoi.name}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(([label, f]) => (
                <tr key={label}>
                  <td>{label}</td>
                  <td className="num">{f(sa, year)}</td>
                  <td className="num">{f(sb, year)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
