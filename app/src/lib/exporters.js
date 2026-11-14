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
