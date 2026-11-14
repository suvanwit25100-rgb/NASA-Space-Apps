import { scaleBand, scaleLinear } from "d3";
import { MONTHS } from "../lib/analytics";
import { useSize } from "../lib/hooks";
import { useExplorer } from "../state/Explorer";

const M = { l: 44, r: 12, t: 14, b: 26 };
const H = 210;

// Aqua (~13:30) against Terra (~10:30) burning cell-days per calendar month, learned on their 2002 to 2011 overlap.
export default function TimeOfDay() {
  const { aoi, model } = useExplorer();
  const [ref, { w }] = useSize();
  const r = aoi?.ratios?.aqua_over_terra;
  if (!r) return <p className="hint">Not enough overlapping Terra and Aqua detections in this area to show a time-of-day signal.</p>;
  const iw = Math.max(w - M.l - M.r, 10);
  const ih = H - M.t - M.b;
  const x = scaleBand().domain(MONTHS.map((_, i) => i)).range([0, iw]).padding(0.25);
  const top = Math.max(2, ...r);
  // log scale so "twice as many in the afternoon" and "half as many" look equally far from 1
  const y = scaleLinear().domain([Math.log2(1 / top) , Math.log2(top)]).range([ih, 0]);
  const mid = y(0);
  // months with little fire are noisy, so only months holding at least 5% of the typical year count as evidence
  const share = new Array(12).fill(0);
  if (model) for (let d = 0; d < 365; d++) if (!Number.isNaN(model.clim.median[d])) share[new Date(Date.UTC(2001, 0, 1 + d)).getUTCMonth()] += model.clim.median[d];
  const tot = share.reduce((a, b) => a + b, 0) || 1;
  const busy = share.map((v) => v / tot >= 0.05);
  const pool = r.map((v, i) => (busy[i] ? v : -1));
  const best = pool.some((v) => v > 0) ? pool.indexOf(Math.max(...pool)) : r.indexOf(Math.max(...r));
  return (
    <div className="chart" ref={ref}>
      {w > 0 && (
        <svg height={H} role="img" aria-label="Ratio of afternoon (Aqua) to morning (Terra) burning cell-days by month.">
          <g transform={`translate(${M.l},${M.t})`}>
            <line x1={0} x2={iw} y1={mid} y2={mid} stroke="rgba(245,239,230,.5)" strokeDasharray="4 4" />
            <text x={-8} y={mid + 3.5} textAnchor="end" fill="#bdb1a6" fontSize="10" fontWeight="700">1×</text>
            {[2, 4].filter((t) => t <= top).map((t) => (
              <g key={t}>
                <line x1={0} x2={iw} y1={y(Math.log2(t))} y2={y(Math.log2(t))} stroke="rgba(230,200,170,.1)" />
                <text x={-8} y={y(Math.log2(t)) + 3.5} textAnchor="end" fill="#9d8f82" fontSize="10" fontWeight="600">{t}×</text>
              </g>
            ))}
            {r.map((v, i) => {
              const yy = y(Math.log2(Math.max(v, 1 / top)));
              return (
                <g key={i}>
                  <rect x={x(i)} y={Math.min(yy, mid)} width={x.bandwidth()} height={Math.abs(yy - mid)} rx="3" fill={v >= 1 ? "#ffb869" : "#6fb3ff"} opacity={i === best ? 1 : busy[i] ? 0.75 : 0.3}>
                    <title>{`${MONTHS[i]}: the afternoon pass saw ${v.toFixed(2)}× the burning cell-days of the morning pass`}</title>
                  </rect>
                  <text x={x(i) + x.bandwidth() / 2} y={ih + 18} textAnchor="middle" fill="#9d8f82" fontSize="10" fontWeight="600">{iw / 12 < 34 ? MONTHS[i][0] : MONTHS[i].toUpperCase()}</text>
                </g>
              );
            })}
          </g>
        </svg>
      )}
      <p className="hint">
        Above the line, the afternoon pass (Aqua, about 13:30) sees more burning cell-days than the morning pass (Terra, about 10:30). In {MONTHS[best]} it sees {r[best].toFixed(1)}× as many here, which says fires in this area are mostly lit or spread after midday that month. Pale bars are months with little fire, which are noisy. Learned on the 2002 to 2011 overlap of the two satellites, so it describes the typical year, not a particular one.
      </p>
    </div>
  );
}
