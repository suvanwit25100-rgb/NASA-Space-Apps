import { useEffect, useMemo, useRef, useState } from "react";
import { anomalyAt, fmtDateLong, isMeasured, monthLabels, monthOfDoy, monthStartDoy } from "../lib/analytics";
import { anomalyColor, fireColor, rgb, ANOM_CSS, FIRE_CSS } from "../lib/colors";
import { useSize } from "../lib/hooks";

const ML = 54;
const MT = 28;
const MR = 14;
const ROW = 15;

export default function CalendarHeatmap({ model, year, mode, onSelect }) {
  const [wrapRef, { w }] = useSize();
  const canvasRef = useRef(null);
  const [hover, setHover] = useState(null);
  const years = model.years;
  const height = MT + years.length * ROW + 6;

  const anom = useMemo(() => {
    const out = {};
    for (const y of years) {
      const arr = new Float32Array(366).fill(NaN);
      if (model.byYear[y].complete) {
        for (let d = 0; d < model.byYear[y].n; d++) {
          const a = anomalyAt(model, y, d);
          if (a) arr[d] = a.z;
        }
      }
      out[y] = arr;
    }
    return out;
  }, [model, years]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !w) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = w * dpr;
    canvas.height = height * dpr;
    canvas.style.height = `${height}px`;
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, height);
    const cw = (w - ML - MR) / 366;

    ctx.font = "600 10px Montserrat, system-ui, sans-serif";
    ctx.textBaseline = "middle";
    years.forEach((y, r) => {
      const yy = MT + r * ROW;
      const { vals, n } = model.byYear[y];
      for (let d = 0; d < n; d++) {
        let c = null;
        if (mode === "activity") c = fireColor(vals[d], model.vmax);
        else c = anomalyColor(anom[y][d]);
        ctx.fillStyle = c ? rgb(c) : "rgba(120,165,210,0.06)";
        ctx.fillRect(ML + d * cw, yy, Math.ceil(cw) + 0.4, ROW - 1.5);
      }
      const sel = y === year;
      ctx.fillStyle = sel ? "#fff" : "#8fa8c4";
      ctx.textAlign = "right";
      ctx.fillText(String(y), ML - 18, yy + ROW / 2);
      ctx.fillStyle = isMeasured(y, 180) ? "#5fb0ff" : y === model.firstYear ? "#3a4a60" : "#ff8a1f";
      ctx.globalAlpha = isMeasured(y, 180) ? 0.9 : 0.55;
      ctx.fillRect(ML - 12, yy + 2, 3, ROW - 5);
      ctx.globalAlpha = 1;
    });

    ctx.textAlign = "left";
    ctx.fillStyle = "#8fa8c4";
    const labels = monthLabels(w - ML - MR);
    for (let m = 0; m < 12; m++) {
      const x = ML + monthStartDoy(2001, m) * cw;
      ctx.fillText(labels[m], x + 2, 10);
      ctx.fillStyle = "rgba(120,165,210,0.35)";
      ctx.fillRect(x, 17, 1, 6);
      ctx.fillStyle = "#8fa8c4";
    }

    const r = years.indexOf(year);
    if (r >= 0) {
      const yy = MT + r * ROW;
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 1.2;
      ctx.strokeRect(ML - 0.5, yy - 0.5, w - ML - MR + 1, ROW);
      (model.seasons[year] || []).forEach((se, i) => {
        ctx.fillStyle = i === 0 ? "#ffc760" : "rgba(255,199,96,0.55)";
        ctx.fillRect(ML + se.start * cw, yy + ROW - 1, (se.end - se.start + 1) * cw, 2.5);
        ctx.beginPath();
        ctx.arc(ML + (se.peak + 0.5) * cw, yy - 3, i === 0 ? 2.8 : 2.2, 0, Math.PI * 2);
        ctx.fillStyle = i === 0 ? "#fff" : "rgba(255,255,255,0.65)";
        ctx.fill();
      });
    }
    if (hover) {
      const yy = MT + years.indexOf(hover.y) * ROW;
      ctx.strokeStyle = "rgba(255,255,255,0.9)";
      ctx.lineWidth = 1;
      ctx.strokeRect(ML + hover.d * cw - 0.5, yy - 0.5, cw + 1, ROW);
    }
  }, [model, year, mode, w, hover, anom, years, height]);

  const locate = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const yv = e.clientY - rect.top;
    const cw = (rect.width - ML - MR) / 366;
    const r = Math.floor((yv - MT) / ROW);
    const d = Math.floor((x - ML) / cw);
    if (r < 0 || r >= years.length || d < 0 || d >= 366) return null;
    const y = years[r];
    if (d >= model.byYear[y].n) return null;
    return { y, d, x, yv };
  };

  const tip = hover && (() => {
    const { y, d } = hover;
    const v = model.byYear[y].vals[d];
    if (Number.isNaN(v)) return { title: fmtDateLong(y, d), lines: ["No satellite record yet for this date."] };
    const a = anomalyAt(model, y, d);
    const measured = isMeasured(y, d);
    const lo = model.byYear[y].lo[d];
    const hi = model.byYear[y].hi[d];
    const lines = [
      `<span class="m">Burning cell-days</span> <b style="display:inline">${v.toFixed(v < 10 ? 1 : 0)}</b>`,
      a
        ? `<span class="m">Anomaly</span> ${a.z >= 0 ? "+" : ""}${a.z.toFixed(1)}σ · higher than ${Math.round(a.pct)}% of other years' same week`
        : `<span class="m">Anomaly</span> not available for this year`,
      measured
        ? `<span class="m">Confidence</span> High · measured directly by VIIRS (375 m)`
        : `<span class="m">Confidence</span> ${hi > 0 ? `Calibrated estimate, plausible range ${lo.toFixed(0)} to ${hi.toFixed(0)}` : "Calibrated estimate"}, scaled from MODIS`,
    ];
    return { title: fmtDateLong(y, d), lines };
  })();

  return (
    <div className="chart" ref={wrapRef}>
      <canvas
        ref={canvasRef}
        className="cal-canvas"
        role="img"
        aria-label={`Calendar heatmap of burning activity, one row per year from ${years[0]} to ${years[years.length - 1]}, one column per day of year. Hover or click a day for details.`}
        style={{ cursor: "crosshair" }}
        onMouseMove={(e) => setHover(locate(e))}
        onMouseLeave={() => setHover(null)}
        onClick={(e) => {
          const p = locate(e);
          if (p) onSelect(p.y, monthOfDoy(p.y, p.d));
        }}
      />
      {tip && hover && (
        <div className="tip" style={{ left: Math.min(hover.x + 16, (w || 600) - 270), top: Math.max(hover.yv - 90, 8) }}>
          <b>{tip.title}</b>
          {tip.lines.map((l, i) => (
            <div key={i} dangerouslySetInnerHTML={{ __html: l }} />
          ))}
        </div>
      )}
      <div className="legend">
        <span>
          Low
          <i className="ramp" style={{ background: mode === "activity" ? FIRE_CSS : ANOM_CSS }} />
          {mode === "activity" ? "High burning" : "Unusually high"}
        </span>
        <span><i style={{ background: "#5fb0ff", width: 3, height: 10 }} />VIIRS-measured (2012 on)</span>
        <span><i style={{ background: "#ff8a1f", width: 3, height: 10, opacity: 0.6 }} />Calibrated from MODIS</span>
        <span><i style={{ background: "#ffc760", height: 3 }} />Fire seasons of the selected year, with the peak marked above</span>
      </div>
    </div>
  );
}
