const DAY = 86400000;
const AXIS0 = Date.UTC(2000, 0, 1);

export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
// single letters when a month column is too narrow for three-letter labels (phones)
export const monthLabels = (widthPx) => (widthPx / 12 < 34 ? "JFMAMJJASOND".split("") : MONTHS.map((m) => m.toUpperCase()));
export const isLeap = (y) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
export const daysIn = (y) => (isLeap(y) ? 366 : 365);
export const dateOf = (y, d) => new Date(Date.UTC(y, 0, 1 + d));
export const fmtDate = (y, d) => {
  const t = dateOf(y, d);
  return `${t.getUTCDate()} ${MONTHS[t.getUTCMonth()]}`;
};
export const fmtDateLong = (y, d) => `${fmtDate(y, d)} ${y}`;
export const monthOfDoy = (y, d) => dateOf(y, d).getUTCMonth();
export const monthStartDoy = (y, m) => Math.round((Date.UTC(y, m, 1) - Date.UTC(y, 0, 1)) / DAY);

const nan = (n) => new Float64Array(n).fill(NaN);

function quantile(sorted, q) {
  if (!sorted.length) return NaN;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

function smooth7(vals, n) {
  const out = nan(366);
  for (let d = 0; d < n; d++) {
    let s = 0;
    let c = 0;
    for (let k = -3; k <= 3; k++) {
      const v = vals[d + k];
      if (d + k >= 0 && d + k < n && !Number.isNaN(v)) {
        s += v;
        c++;
      }
    }
    if (c >= 4) out[d] = s / c;
  }
  return out;
}


function movingMean(arr, n, half) {
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    let sum = 0;
    let c = 0;
    for (let k = -half; k <= half; k++) {
      if (i + k >= 0 && i + k < n) {
        sum += arr[i + k];
        c++;
      }
    }
    out[i] = sum / c;
  }
  return out;
}

// A fire season is a run of days where 3-week-smoothed activity stays above 15% of the
// year's peak; runs within 14 days merge, and runs holding under 6% of the year are dropped.
function detectSeasons(vals, n) {
  const v = new Float64Array(n);
  let total = 0;
  for (let d = 0; d < n; d++) {
    v[d] = Number.isNaN(vals[d]) ? 0 : vals[d];
    total += v[d];
  }
  const s = movingMean(movingMean(v, n, 3), n, 7);
  let max = 0;
  for (let d = 0; d < n; d++) if (s[d] > max) max = s[d];
  const thr = 0.15 * max;
  const runs = [];
  for (let d = 0; d < n; d++) {
    if (s[d] >= thr) {
      let e = d;
      while (e + 1 < n && s[e + 1] >= thr) e++;
      if (runs.length && d - runs[runs.length - 1][1] <= 14) runs[runs.length - 1][1] = e;
      else runs.push([d, e]);
      d = e;
    }
  }
  const out = [];
  for (const [a, b] of runs) {
    let sum = 0;
    let peak = a;
    for (let d = a; d <= b; d++) {
      sum += v[d];
      if (s[d] > s[peak]) peak = d;
    }
    if (total <= 0 || sum / total < 0.06) continue;
    let best = -1;
    let peakWeek = a;
    for (let d = a; d + 6 <= Math.min(b, n - 1); d++) {
      let w = 0;
      for (let k = 0; k < 7; k++) w += v[d + k];
      if (w > best) {
        best = w;
        peakWeek = d;
      }
    }
    out.push({ start: a, end: b, peak, peakWeek, share: sum / total, total: sum });
  }
  return out.sort((x, y) => y.share - x.share);
}

export function buildModel(aoi, meta) {
  const firstYear = 2000;
  const lastYear = Number(meta.axisEnd.slice(0, 4));
  const years = [];
  const byYear = {};
  for (let y = firstYear; y <= lastYear; y++) {
    const n = daysIn(y);
    const vals = nan(366);
    const lo = nan(366);
    const hi = nan(366);
    for (let d = 0; d < n; d++) {
      const idx = Math.round((Date.UTC(y, 0, 1 + d) - AXIS0) / DAY);
      const v = aoi.values[idx];
      if (v != null) {
        vals[d] = v;
        lo[d] = aoi.lo[idx];
        hi[d] = aoi.hi[idx];
      }
    }
    const complete = y > firstYear && vals.slice(0, n).every((v) => !Number.isNaN(v));
    years.push(y);
    byYear[y] = { y, n, vals, lo, hi, sm: smooth7(vals, n), smLo: smooth7(lo, n), smHi: smooth7(hi, n), complete };
  }

  const completeYears = years.filter((y) => byYear[y].complete);

  const clim = { median: nan(366), p10: nan(366), p90: nan(366) };
  for (let d = 0; d < 366; d++) {
    const col = completeYears.map((y) => byYear[y].sm[d]).filter((v) => !Number.isNaN(v)).sort((a, b) => a - b);
    if (col.length >= 5) {
      clim.median[d] = quantile(col, 0.5);
      clim.p10[d] = quantile(col, 0.1);
      clim.p90[d] = quantile(col, 0.9);
    }
  }

  const crit = {};
  for (const y of completeYears) {
    const { vals, sm, n } = byYear[y];
    let total = 0;
    for (let d = 0; d < n; d++) total += vals[d] || 0;
    let cum = 0;
    let start = 0;
    let end = n - 1;
    let gotStart = false;
    for (let d = 0; d < n; d++) {
      cum += vals[d] || 0;
      if (!gotStart && cum >= 0.1 * total) {
        start = d;
        gotStart = true;
      }
      if (cum >= 0.9 * total) {
        end = d;
        break;
      }
    }
    let best = -1;
    let peakWeek = 0;
    for (let d = 0; d + 6 < n; d++) {
      let s = 0;
      for (let k = 0; k < 7; k++) s += vals[d + k] || 0;
      if (s > best) {
        best = s;
        peakWeek = d;
      }
    }
    let peakDay = 0;
    let pv = -1;
    for (let d = 0; d < n; d++) {
      if (sm[d] > pv) {
        pv = sm[d];
        peakDay = d;
      }
    }
    crit[y] = { start, end, peakWeek, peakDay, total };
  }

  const seasons = {};
  for (const y of completeYears) seasons[y] = detectSeasons(byYear[y].vals, byYear[y].n);

  const all = [];
  for (const y of completeYears) for (let d = 0; d < byYear[y].n; d++) all.push(byYear[y].vals[d]);
  all.sort((a, b) => a - b);
  const vmax = Math.max(quantile(all, 0.995) || 1, 1);

  return { aoi, years, byYear, completeYears, clim, crit, seasons, vmax, firstYear, lastYear };
}

export function anomalyAt(model, y, d) {
  const cur = model.byYear[y]?.sm[d];
  if (cur == null || Number.isNaN(cur)) return null;
  const others = model.completeYears.filter((o) => o !== y).map((o) => model.byYear[o].sm[d]).filter((v) => !Number.isNaN(v));
  if (others.length < 5) return null;
  const mean = others.reduce((a, b) => a + b, 0) / others.length;
  const sd = Math.sqrt(others.reduce((a, b) => a + (b - mean) ** 2, 0) / others.length);
  const z = sd > 0.5 ? (cur - mean) / sd : 0;
  const pct = (others.filter((v) => v < cur).length / others.length) * 100;
  return { z, pct, mean };
}

export function weeklyAnomaly(model, y) {
  const out = [];
  const n = model.byYear[y].n;
  for (let w = 0; w * 7 + 3 < n; w++) {
    const a = anomalyAt(model, y, w * 7 + 3);
    out.push({ week: w, doy: w * 7 + 3, z: a ? a.z : null, pct: a ? a.pct : null });
  }
  return out;
}

export function yearSummary(model, y) {
  const c = model.crit[y];
  const ss = model.seasons[y];
  if (!c || !ss || !ss.length) return null;
  const main = ss[0];
  const totals = model.completeYears.map((o) => model.crit[o].total).sort((a, b) => a - b);
  const median = quantile(totals, 0.5);
  const rankAbove = model.completeYears.filter((o) => model.crit[o].total > c.total).length + 1;
  const sameStarts = [];
  for (const o of model.completeYears) {
    if (o === y) continue;
    const m = model.seasons[o].find((x) => Math.abs(x.peak - main.peak) <= 75);
    if (m) sameStarts.push(m.start);
  }
  sameStarts.sort((a, b) => a - b);
  return {
    ...c,
    main,
    others: ss.slice(1),
    median,
    vsMedian: c.total / median - 1,
    rankAbove,
    nYears: model.completeYears.length,
    medStart: sameStarts.length >= 5 ? quantile(sameStarts, 0.5) : null,
  };
}

export function isMeasured(y, d) {
  return dateOf(y, d) >= Date.UTC(2012, 0, 20);
}
