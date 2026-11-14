import { scaleLinear } from "d3";
import { fmtDate, monthStartDoy, MONTHS } from "../lib/analytics";
import { useSize } from "../lib/hooks";

const M = { l: 44, r: 12, t: 8, b: 24 };
const ROW = 14;

export default function CriticalPeriods({ model, year, onSelect }) {
  const [ref, { w }] = useSize();
  const ys = model.completeYears;
  const H = M.t + ys.length * ROW + M.b;
  const iw = Math.max(w - M.l - M.r, 10);
  const x = scaleLinear().domain([0, 365]).range([0, iw]);

  return (
    <div className="chart" ref={ref}>
      {w > 0 && (
        <svg height={H} role="img" aria-label="Fire seasons for each year, with the peak week of each season marked.">
          <g transform={`translate(${M.l},${M.t})`}>
            {MONTHS.map((m, i) => {
              const px = x(monthStartDoy(2001, i));
              return (
                <g key={m}>
                  <line x1={px} x2={px} y1={0} y2={ys.length * ROW} stroke="rgba(120,165,210,0.12)" />
                  <text x={px + 3} y={ys.length * ROW + 15} fill="#8fa8c4" fontSize="10" fontWeight="600">{m.toUpperCase()}</text>
                </g>
              );
            })}
            {ys.map((y, i) => {
              const sel = y === year;
              const calibrated = y < 2012;
              return (
                <g key={y} transform={`translate(0,${i * ROW})`} style={{ cursor: "pointer" }} onClick={() => onSelect(y)}>
                  <rect x={-M.l} y={0} width={w} height={ROW} fill={sel ? "rgba(255,138,31,0.1)" : "transparent"} />
                  <text x={-8} y={ROW / 2 + 3.5} textAnchor="end" fill={sel ? "#fff" : "#8fa8c4"} fontSize="10" fontWeight={sel ? 800 : 600}>{y}</text>
                  {(model.seasons[y] || []).map((se, k) => (
                    <g key={k} opacity={(calibrated ? 0.55 : 1) * (k === 0 ? 1 : 0.6)}>
                      <rect
                        x={x(se.start)} y={3} width={Math.max(x(se.end) - x(se.start), 2)} height={ROW - 6} rx="1"
                        fill={sel ? "#ffc760" : "#ff8a1f"}
                        stroke={calibrated ? "#ff8a1f" : "none"} strokeDasharray={calibrated ? "3 2" : "0"}
                      >
                        <title>{`${y}: ${fmtDate(y, se.start)} to ${fmtDate(y, se.end)}, peak week of ${fmtDate(y, se.peakWeek)}, ${Math.round(se.share * 100)}% of the year`}</title>
                      </rect>
                      <rect x={x(se.peakWeek)} y={1} width={Math.max(x(7), 2)} height={ROW - 2} fill="#fff" />
                    </g>
                  ))}
                </g>
              );
            })}
          </g>
        </svg>
      )}
      <div className="legend">
        <span><i style={{ background: "#ff8a1f" }} />Fire season (fainter bar: smaller second season)</span>
        <span><i style={{ background: "#fff" }} />Peak week</span>
        <span><i style={{ background: "transparent", border: "1px dashed #ff8a1f" }} />Calibrated years (pre-2012)</span>
      </div>
    </div>
  );
}
