import { dateOf, isMeasured } from "./analytics";

function download(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export function exportCsv(model) {
  const rows = ["date,burning_cell_days,low,high,source"];
  for (const y of model.years) {
    const { vals, lo, hi, n } = model.byYear[y];
    for (let d = 0; d < n; d++) {
      if (Number.isNaN(vals[d])) continue;
      const iso = dateOf(y, d).toISOString().slice(0, 10);
      const src = isMeasured(y, d) ? "measured_VIIRS" : "calibrated_from_MODIS";
      rows.push(`${iso},${vals[d]},${lo[d]},${hi[d]},${src}`);
    }
  }
  const header = [
    `# Global Burn Log: ${model.aoi.name}`,
    "# Daily burning cell-days on a VIIRS-equivalent scale (H3 res 5). Source: NASA FIRMS (MODIS, VIIRS).",
    "# low/high give the calibration range for MODIS-era days; they equal the value for VIIRS-measured days.",
  ];
  download(new Blob([`${header.join("\n")}\n${rows.join("\n")}\n`], { type: "text/csv" }), `burn-log-${slug(model.aoi.name)}.csv`);
}

export function exportCalendarPng(model, year, mode) {
  const src = document.querySelector("canvas.cal-canvas");
  if (!src) return;
  const k = src.width / src.getBoundingClientRect().width;
  const pad = 28 * k;
  const head = 78 * k;
  const foot = 44 * k;
  const out = document.createElement("canvas");
  out.width = Math.max(src.width + pad * 2, 900 * k);
  out.height = src.height + head + foot;
  const ctx = out.getContext("2d");
  ctx.fillStyle = "#050d1b";
  ctx.fillRect(0, 0, out.width, out.height);

  const fit = (text, weight, size, maxWidth) => {
    let px = size;
    ctx.font = `${weight} ${px}px Montserrat, system-ui, sans-serif`;
    while (ctx.measureText(text).width > maxWidth && px > 8 * k) {
      px -= 1;
      ctx.font = `${weight} ${px}px Montserrat, system-ui, sans-serif`;
    }
  };
  const maxW = out.width - pad * 2;

  ctx.fillStyle = "#f4f8ff";
  const title = `BURNING ACTIVITY CALENDAR · ${model.aoi.name.toUpperCase()}`;
  fit(title, 800, 22 * k, maxW);
  ctx.fillText(title, pad, 34 * k);

  ctx.fillStyle = "#8fa8c4";
  const sub = `${mode === "anomaly" ? "Anomaly vs the same week in other years" : "Daily burning cell-days"} · selected year ${year}`;
  fit(sub, 600, 12 * k, maxW);
  ctx.fillText(sub, pad, 56 * k);

  ctx.drawImage(src, (out.width - src.width) / 2, head);

  ctx.fillStyle = "#5d7592";
  const credit = "Global Burn Log · fire detections: NASA FIRMS (MODIS, VIIRS) · 2000 to 2011 are calibrated estimates, 2012 on measured by VIIRS";
  fit(credit, 500, 11 * k, maxW);
  ctx.fillText(credit, pad, out.height - 16 * k);
  out.toBlob((b) => b && download(b, `burn-log-${slug(model.aoi.name)}-calendar.png`));
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  }
}

// One-page picture report for an area and year: verdict, key dates, seasons, typical-year chart, provenance.
export function exportReportPng(model, year, sum, verdict, unc) {
  if (!sum) return;
  const W = 1240;
  const H = 1754;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const x = c.getContext("2d");
  const F = (w, s, serif) => `${w} ${s}px ${serif ? "'Cormorant Garamond', Georgia, serif" : "Lato, system-ui, sans-serif"}`;
  const g = x.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "#1b0f0a");
  g.addColorStop(0.35, "#0b0c10");
  g.addColorStop(1, "#0b0c10");
  x.fillStyle = g;
  x.fillRect(0, 0, W, H);
  const glow = x.createRadialGradient(W * 0.9, 0, 10, W * 0.9, 0, 520);
  glow.addColorStop(0, "rgba(255,122,47,.35)");
  glow.addColorStop(1, "rgba(255,122,47,0)");
  x.fillStyle = glow;
  x.fillRect(0, 0, W, 560);

  const P = 80;
  const fmt = (d) => {
    const t = dateOf(year, d);
    return `${t.getUTCDate()} ${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][t.getUTCMonth()]}`;
  };
  const wrap = (text, px, y0, maxW, lh) => {
    let line = "";
    let y = y0;
    for (const word of text.split(" ")) {
      const t = line ? `${line} ${word}` : word;
      if (x.measureText(t).width > maxW && line) {
        x.fillText(line, P, y);
        line = word;
        y += lh;
      } else line = t;
    }
    x.fillText(line, P, y);
    return y + lh;
  };

  x.fillStyle = "#ff7a2f";
  x.font = F(900, 18);
  x.fillText("GLOBAL BURN LOG  ·  AREA REPORT", P, 96);
  x.fillStyle = "#f5efe6";
  x.font = F(400, 84, true);
  x.fillText(model.aoi.name, P, 196);
  x.fillStyle = "#bdb1a6";
  x.font = F(700, 26);
  x.fillText(`${year}`, P, 244);

  // verdict
  let y = 310;
  if (verdict) {
    x.fillStyle = verdict.level === "high" || verdict.level === "above" ? "rgba(255,122,47,.2)" : "rgba(111,179,255,.12)";
    x.beginPath();
    x.roundRect(P, y, W - P * 2, 150, 28);
    x.fill();
    x.fillStyle = "#ffb869";
    x.font = F(500, 56, true);
    x.fillText(verdict.label, P + 36, y + 70);
    x.fillStyle = "#e9e2d7";
    x.font = F(400, 22);
    const up = verdict.rank <= Math.ceil(verdict.n / 2);
    const k = up ? verdict.rank : verdict.n - verdict.rank + 1;
    const suffix = ["th", "st", "nd", "rd"][k % 10 < 4 && ![11, 12, 13].includes(k % 100) ? k % 10 : 0];
    x.fillText(`${k === 1 ? "" : `${k}${suffix} `}${up ? "busiest" : "quietest"} of ${verdict.n} years  ·  ${verdict.z >= 0 ? "+" : "−"}${Math.abs(verdict.z).toFixed(1)} standard deviations`, P + 36, y + 112);
    y += 190;
  }

  // key numbers
  const kp = [
    ["MAIN SEASON", `${fmt(sum.main.start)} – ${fmt(sum.main.end)}`],
    ["PEAK WEEK BEGINS", fmt(sum.main.peakWeek)],
    ["BURNING CELL-DAYS", Math.round(sum.total).toLocaleString()],
  ];
  const cw = (W - P * 2 - 40) / 3;
  kp.forEach(([k, v], i) => {
    const cx = P + i * (cw + 20);
    x.strokeStyle = "rgba(230,200,170,.25)";
    x.lineWidth = 2;
    x.beginPath();
    x.roundRect(cx, y, cw, 150, 24);
    x.stroke();
    x.fillStyle = "#bdb1a6";
    x.font = F(700, 16);
    x.fillText(k, cx + 26, y + 44);
    x.fillStyle = "#ffb869";
    x.font = F(500, v.length > 14 ? 38 : 46, true);
    x.fillText(v, cx + 26, y + 108);
  });
  y += 210;

  // typical year chart
  const cx0 = P;
  const cw2 = W - P * 2;
  const ch = 420;
  x.fillStyle = "#f5efe6";
  x.font = F(500, 38, true);
  x.fillText(`The typical year, and ${year}`, P, y);
  y += 30;
  const top = y;
  const yr = model.byYear[year];
  const vals = [...model.clim.p90, ...yr.sm].filter((v) => !Number.isNaN(v));
  const vmax = Math.max(...vals, 1);
  const px = (d) => cx0 + (d / 365) * cw2;
  const py = (v) => top + ch - (v / vmax) * (ch - 10);
  x.fillStyle = "rgba(255,255,255,.04)";
  x.beginPath();
  x.roundRect(cx0 - 10, top - 10, cw2 + 20, ch + 50, 20);
  x.fill();
  x.fillStyle = "rgba(255,122,47,.2)";
  x.beginPath();
  let started = false;
  for (let d = 0; d < 365; d++) if (!Number.isNaN(model.clim.p90[d])) { x[started ? "lineTo" : "moveTo"](px(d), py(model.clim.p90[d])); started = true; }
  for (let d = 364; d >= 0; d--) if (!Number.isNaN(model.clim.p10[d])) x.lineTo(px(d), py(model.clim.p10[d]));
  x.closePath();
  x.fill();
  const stroke = (arr, col, w) => {
    x.strokeStyle = col;
    x.lineWidth = w;
    x.beginPath();
    let s = false;
    for (let d = 0; d < 365; d++) if (!Number.isNaN(arr[d])) { x[s ? "lineTo" : "moveTo"](px(d), py(arr[d])); s = true; }
    x.stroke();
  };
  stroke(model.clim.median, "#bdb1a6", 3);
  stroke(yr.sm, "#ffb869", 5);
  x.fillStyle = "#bdb1a6";
  x.font = F(700, 16);
  ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"].forEach((m, i) => x.fillText(m, px(Math.round((Date.UTC(2001, i, 1) - Date.UTC(2001, 0, 1)) / 86400000)) + 4, top + ch + 26));
  y = top + ch + 90;
  x.font = F(600, 18);
  x.fillStyle = "#ffb869";
  x.fillText(`— ${year}`, P, y);
  x.fillStyle = "#bdb1a6";
  x.fillText("— median year", P + 130, y);
  x.fillStyle = "rgba(255,122,47,.8)";
  x.fillText("▮ typical range (10th to 90th percentile)", P + 330, y);
  y += 70;

  // seasons
  x.fillStyle = "#f5efe6";
  x.font = F(500, 38, true);
  x.fillText("Fire seasons detected", P, y);
  y += 44;
  x.font = F(400, 24);
  for (const s of [sum.main, ...sum.others].slice(0, 3)) {
    x.fillStyle = "#e9e2d7";
    x.fillText(`${fmt(s.start)} to ${fmt(s.end)}  ·  peak week of ${fmt(s.peakWeek)}  ·  ${Math.round(s.share * 100)}% of the year's activity`, P, y);
    y += 40;
  }

  // provenance
  y = H - 210;
  x.strokeStyle = "rgba(230,200,170,.25)";
  x.lineWidth = 1;
  x.beginPath();
  x.moveTo(P, y);
  x.lineTo(W - P, y);
  x.stroke();
  x.fillStyle = "#bdb1a6";
  x.font = F(400, 19);
  y += 40;
  const prov = `Source: NASA FIRMS active fire (MODIS Terra and Aqua 2000–2025, VIIRS Suomi NPP 2012–2025), counted as burning cell-days on an H3 resolution-5 grid. ${unc?.measured === false ? `${year} is a calibrated MODIS estimate (about ±${Math.round(unc.pct)}% on the daily value). ` : year < 2012 ? "" : `${year} is measured directly by VIIRS. `}Cell-days show where and when fire was detected, not area burned. Hackathon project; not for operational emergency decisions.`;
  y = wrap(prov, 19, y, W - P * 2, 30);
  x.fillStyle = "#ff7a2f";
  x.font = F(900, 17);
  x.fillText("globalburnlog.earth", P, H - 50);
  c.toBlob((b) => b && download(b, `burn-log-report-${slug(model.aoi.name)}-${year}.png`));
}
