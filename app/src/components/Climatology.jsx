import { useMemo, useState } from "react";
import { area, line, scaleLinear } from "d3";
import { fmtDate, monthStartDoy, MONTHS, weeklyAnomaly, anomalyAt } from "../lib/analytics";
import { useSize } from "../lib/hooks";

const M = { l: 48, r: 14, t: 14, b: 26 };

function MonthAxis({ x, h }) {
  return (
    <g>
      {MONTHS.map((m, i) => {
        const px = x(monthStartDoy(2001, i));
        return (
          <g key={m}>
            <line x1={px} x2={px} y1={0} y2={h} stroke="rgba(120,165,210,0.12)" />
            <text x={px + 4} y={h + 16} fill="#8fa8c4" fontSize="10" fontWeight="600">{m.toUpperCase()}</text>
          </g>
        );
      })}
    </g>
  );
}

export default function Climatology({ model, year }) {
  const [ref, { w }] = useSize();
  const [hoverD, setHoverD] = useState(null);
  const H = 250;
  const WH = 110;
  const iw = Math.max(w - M.l - M.r, 10);
  const ih = H - M.t - M.b;
  const wih = WH - 14 - M.b;

  const { x, y, paths, wk, yMax } = useMemo(() => {
    const cur = model.byYear[year];
    let ymax = 1;
    for (let d = 0; d < 366; d++) {
      for (const v of [model.clim.p90[d], cur.sm[d], cur.smHi[d]]) if (v > ymax) ymax = v;
    }
    const x = scaleLinear().domain([0, 365]).range([0, iw]);
    const y = scaleLinear().domain([0, ymax * 1.08]).range([ih, 0]).nice();
    const idx = Array.from({ length: 366 }, (_, i) => i).filter((d) => !Number.isNaN(model.clim.median[d]));
    const ln = (arr) => line().defined((d) => !Number.isNaN(arr[d])).x((d) => x(d)).y((d) => y(arr[d]));
    const band = area().defined((d) => !Number.isNaN(model.clim.p10[d])).x((d) => x(d)).y0((d) => y(model.clim.p10[d])).y1((d) => y(model.clim.p90[d]));
    const ubd = area().defined((d) => !Number.isNaN(cur.smLo[d])).x((d) => x(d)).y0((d) => y(cur.smLo[d])).y1((d) => y(cur.smHi[d]));
    const days = Array.from({ length: cur.n }, (_, i) => i);
    return {
      x,
      y,
      yMax: y.domain()[1],
      wk: weeklyAnomaly(model, year),
      paths: {
        band: band(idx),
        median: ln(model.clim.median)(idx),
        cur: ln(cur.sm)(days),
        unc: ubd(days),
      },
    };
  }, [model, year, iw, ih]);

  const seasons = model.seasons[year] || [];
  const zx = scaleLinear().domain([0, 365]).range([0, iw]);
  const bw = Math.max(iw / 53 - 1.5, 1);

  const onMove = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const d = Math.round(x.invert(e.clientX - r.left - M.l));
    setHoverD(d >= 0 && d < model.byYear[year].n ? d : null);
  };
  const a = hoverD != null ? anomalyAt(model, year, hoverD) : null;

  return (
    <div className="chart" ref={ref}>
      {w > 0 && (
        <>
          <svg height={H} role="img" aria-label={`Climatology for ${model.aoi.name}: the median and 10 to 90 percent range of burning activity by day of year, with ${year} overlaid.`} onMouseMove={onMove} onMouseLeave={() => setHoverD(null)}>
            <g transform={`translate(${M.l},${M.t})`}>
              {y.ticks(4).map((t) => (
                <g key={t}>
                  <line x1={0} x2={iw} y1={y(t)} y2={y(t)} stroke="rgba(120,165,210,0.12)" />
                  <text x={-8} y={y(t) + 3} textAnchor="end" fill="#8fa8c4" fontSize="10">{t}</text>
                </g>
              ))}
              <MonthAxis x={x} h={ih} />
              {seasons.map((se, i) => <rect key={`b${i}`} x={x(se.start)} y={0} width={Math.max(x(se.end) - x(se.start), 1)} height={ih} fill={i === 0 ? "rgba(255,199,96,0.1)" : "rgba(255,199,96,0.05)"} />)}
              <path d={paths.band} fill="rgba(95,176,255,0.2)" />
              <path d={paths.median} fill="none" stroke="#9fd0ff" strokeWidth="1.6" />
              {year < 2012 && <path d={paths.unc} fill="rgba(255,138,31,0.22)" />}
              <path d={paths.cur} fill="none" stroke="#ff8a1f" strokeWidth="2.2" />
              {seasons.map((se, i) => (
                <g key={`m${i}`}>
                  <line x1={x(se.start)} x2={x(se.start)} y1={0} y2={ih} stroke="#ffc760" strokeDasharray="3 3" opacity={i === 0 ? 1 : 0.5} />
                  <line x1={x(se.end)} x2={x(se.end)} y1={0} y2={ih} stroke="#ffc760" strokeDasharray="3 3" opacity={i === 0 ? 1 : 0.5} />
                  <circle cx={x(se.peak)} cy={y(model.byYear[year].sm[se.peak])} r={i === 0 ? 4.5 : 3.5} fill="#fff" stroke="#ff8a1f" strokeWidth="2" />
                </g>
              ))}
              {hoverD != null && <line x1={x(hoverD)} x2={x(hoverD)} y1={0} y2={ih} stroke="#fff" opacity="0.7" />}
            </g>
          </svg>
          {hoverD != null && (
            <div className="tip" style={{ left: Math.min(M.l + x(hoverD) + 14, w - 240), top: 12 }}>
              <b>{fmtDate(year, hoverD)}</b>
              <div><span className="m">{year}</span> {model.byYear[year].sm[hoverD]?.toFixed(0)} <span className="m">· median</span> {model.clim.median[hoverD]?.toFixed(0)}</div>
              <div><span className="m">Typical range</span> {model.clim.p10[hoverD]?.toFixed(0)} to {model.clim.p90[hoverD]?.toFixed(0)}</div>
              {a && <div><span className="m">Anomaly</span> {a.z >= 0 ? "+" : ""}{a.z.toFixed(1)}σ</div>}
            </div>
          )}
          <div className="legend" style={{ marginTop: 4 }}>
            <span><i style={{ background: "#ff8a1f", height: 3 }} />{year} (7-day mean)</span>
            <span><i style={{ background: "#9fd0ff", height: 3 }} />Median year</span>
            <span><i style={{ background: "rgba(95,176,255,0.4)" }} />Typical range (10th to 90th percentile)</span>
            {year < 2012 && <span><i style={{ background: "rgba(255,138,31,0.4)" }} />Calibration uncertainty</span>}
          </div>
          <p className="caps" style={{ margin: "18px 0 4px", color: "#8fa8c4" }}>Weekly anomaly in {year}: how unusual each week was</p>
          <svg height={WH} role="img" aria-label={`Weekly anomaly bars for ${year}, in standard deviations from other years.`}>
            <g transform={`translate(${M.l},8)`}>
              <line x1={0} x2={iw} y1={wih / 2} y2={wih / 2} stroke="rgba(120,165,210,0.4)" />
              {wk.map((d) => {
                if (d.z == null) return null;
                const z = Math.max(-3, Math.min(3, d.z));
                const hh = (Math.abs(z) / 3) * (wih / 2);
                return (
                  <rect key={d.week} x={zx(d.week * 7)} y={z >= 0 ? wih / 2 - hh : wih / 2} width={bw} height={Math.max(hh, 0.5)} fill={z >= 0 ? "#ff8a1f" : "#4b9bff"} opacity={0.4 + Math.abs(z) / 5}>
                    <title>{`Week of ${fmtDate(year, d.week * 7)}: ${d.z >= 0 ? "+" : ""}${d.z.toFixed(1)}σ`}</title>
                  </rect>
                );
              })}
              <text x={-8} y={10} textAnchor="end" fill="#8fa8c4" fontSize="10">+3σ</text>
              <text x={-8} y={wih} textAnchor="end" fill="#8fa8c4" fontSize="10">−3σ</text>
              <MonthAxis x={zx} h={wih} />
            </g>
          </svg>
        </>
      )}
    </div>
  );
}
