import { scaleLinear } from "d3";
import { fmtDate, seasonTrend } from "../lib/analytics";
import { useSize } from "../lib/hooks";

const M = { l: 48, r: 12, t: 10, b: 26 };
const H = 220;

function verdict(r, label) {
  const dec = r.slope * 10;
  if (Math.abs(r.t) < 2) return `${label}: no clear shift (${dec >= 0 ? "+" : "−"}${Math.abs(dec).toFixed(1)} days per decade, within noise)`;
  return `${label}: ${Math.abs(dec).toFixed(1)} days per decade ${dec > 0 ? "later" : "earlier"}`;
}

export default function Trend({ model }) {
  const [ref, { w }] = useSize();
  const tr = seasonTrend(model);
  if (!tr) return <p className="hint">This area burns most of the year, so there is no single season to follow across years.</p>;
  const iw = Math.max(w - M.l - M.r, 10);
  const ih = H - M.t - M.b;
  const x = scaleLinear().domain([tr.pts[0].y - 0.5, tr.pts[tr.pts.length - 1].y + 0.5]).range([0, iw]);
  const all = tr.pts.flatMap((p) => [p.start, p.end]);
  const y = scaleLinear().domain([Math.min(...all) - 8, Math.max(...all) + 8]).range([ih, 0]);
  const line = (r, color) => {
    const y0 = tr.pts[0].y;
    const y1 = tr.pts[tr.pts.length - 1].y;
    return <line x1={x(y0)} x2={x(y1)} y1={y(r.icpt + r.slope * y0)} y2={y(r.icpt + r.slope * y1)} stroke={color} strokeWidth="2" strokeDasharray="5 4" />;
  };
  const withIcpt = (r, k) => {
    const xs = tr.pts.map((p) => p.y);
    const ys = tr.pts.map((p) => p[k]);
    const mx = xs.reduce((a, b) => a + b, 0) / xs.length;
    const my = ys.reduce((a, b) => a + b, 0) / ys.length;
    return { ...r, icpt: my - r.slope * mx };
  };
  const s = withIcpt(tr.start, "start");
  const e = withIcpt(tr.end, "end");
  const ticks = y.ticks(5);
  return (
    <div className="chart" ref={ref}>
      {w > 0 && (
        <svg height={H} role="img" aria-label="Main fire season start and end date for each year, with trend lines.">
          <g transform={`translate(${M.l},${M.t})`}>
            {ticks.map((t) => (
              <g key={t}>
                <line x1={0} x2={iw} y1={y(t)} y2={y(t)} stroke="rgba(230,200,170,0.1)" />
                <text x={-8} y={y(t) + 3.5} textAnchor="end" fill="#9d8f82" fontSize="10" fontWeight="600">{fmtDate(2001, Math.round(t))}</text>
              </g>
            ))}
            {[2000, 2005, 2010, 2015, 2020, 2025].filter((v) => v >= tr.pts[0].y && v <= tr.pts[tr.pts.length - 1].y).map((v) => (
              <text key={v} x={x(v)} y={ih + 18} textAnchor="middle" fill="#9d8f82" fontSize="10" fontWeight="600">{v}</text>
            ))}
            {line(s, "#ffb869")}
            {line(e, "#6fb3ff")}
            {tr.pts.map((p) => (
              <g key={p.y} opacity={p.y < 2012 ? 0.55 : 1}>
                <circle cx={x(p.y)} cy={y(p.start)} r="3.5" fill="#ffb869"><title>{`${p.y}: season starts ${fmtDate(p.y, p.start)}`}</title></circle>
                <circle cx={x(p.y)} cy={y(p.end)} r="3.5" fill="#6fb3ff"><title>{`${p.y}: season ends ${fmtDate(p.y, p.end)}`}</title></circle>
              </g>
            ))}
          </g>
        </svg>
      )}
      <div className="legend">
        <span><i style={{ background: "#ffb869" }} />Season start</span>
        <span><i style={{ background: "#6fb3ff" }} />Season end</span>
        <span>Fainter dots are calibrated years (pre-2012)</span>
      </div>
      <ul className="trend-notes">
        <li>{verdict(tr.start, "Start")}</li>
        <li>{verdict(tr.end, "End")}</li>
      </ul>
      <p className="hint">Twenty-five years, part of it calibrated, is a signal worth looking at, not proof of a climate trend.</p>
    </div>
  );
}
