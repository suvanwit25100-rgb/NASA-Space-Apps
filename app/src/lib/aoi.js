import { cellToLatLng } from "h3-js";

const base = import.meta.env.BASE_URL;
const DAY = 86400000;
const AXIS0 = Date.UTC(2000, 0, 1);
const LOW_DATA_CELLDAYS = 500;

export function cellCentroids(cells) {
  const lat = new Float32Array(cells.length);
  const lon = new Float32Array(cells.length);
  cells.forEach((c, i) => {
    const [la, lo] = cellToLatLng(c);
    lat[i] = la;
    lon[i] = lo;
  });
  return { lat, lon };
}

let cellDaysPromise = null;
export function loadCellDays(meta) {
  if (!cellDaysPromise) {
    cellDaysPromise = fetch(`${base}data/cell_days.bin`)
      .then((r) => {
        if (!r.ok) throw new Error("Could not load cell-day data");
        return r.arrayBuffer();
      })
      .then((buf) => {
        const out = {};
        let off = 0;
        for (const sensor of ["MODIS_TERRA", "MODIS_AQUA", "VIIRS_SNPP"]) {
          const n = meta.cellDays[sensor];
          out[sensor] = { cell: new Uint16Array(buf, off, n), day: new Uint16Array(buf, off + 2 * n, n), n };
          off += 4 * n;
        }
        return out;
      })
      .catch((e) => {
        cellDaysPromise = null;
        throw e;
      });
  }
  return cellDaysPromise;
}

export function maskFromBBox(centroids, bbox) {
  const [w, s, e, n] = bbox;
  const mask = new Uint8Array(centroids.lat.length);
  for (let i = 0; i < mask.length; i++) {
    const la = centroids.lat[i];
    const lo = centroids.lon[i];
    if (lo >= w && lo <= e && la >= s && la <= n) mask[i] = 1;
  }
  return mask;
}

function inRing(x, y, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function maskFromPolygons(centroids, polygons) {
  const mask = new Uint8Array(centroids.lat.length);
  const boxes = polygons.map((rings) => {
    let w = 180;
    let s = 90;
    let e = -180;
    let n = -90;
    for (const [x, y] of rings[0]) {
      w = Math.min(w, x);
      e = Math.max(e, x);
      s = Math.min(s, y);
      n = Math.max(n, y);
    }
    return [w, s, e, n];
  });
  for (let i = 0; i < mask.length; i++) {
    const x = centroids.lon[i];
    const y = centroids.lat[i];
    for (let k = 0; k < polygons.length; k++) {
      const [w, s, e, n] = boxes[k];
      if (x < w || x > e || y < s || y > n) continue;
      const rings = polygons[k];
      if (inRing(x, y, rings[0]) && !rings.slice(1).some((h) => inRing(x, y, h))) {
        mask[i] = 1;
        break;
      }
    }
  }
  return mask;
}

export function parseGeoJSON(text) {
  let gj;
  try {
    gj = JSON.parse(text);
  } catch {
    throw new Error("That file is not valid JSON.");
  }
  const polys = [];
  const visit = (g) => {
    if (!g) return;
    if (g.type === "FeatureCollection") g.features.forEach(visit);
    else if (g.type === "Feature") visit(g.geometry);
    else if (g.type === "GeometryCollection") g.geometries.forEach(visit);
    else if (g.type === "Polygon") polys.push(g.coordinates);
    else if (g.type === "MultiPolygon") g.coordinates.forEach((c) => polys.push(c));
  };
  visit(gj);
  if (!polys.length) throw new Error("No Polygon or MultiPolygon found in that file.");
  let w = 180;
  let s = 90;
  let e = -180;
  let n = -90;
  for (const rings of polys) {
    for (const [x, y] of rings[0]) {
      if (typeof x !== "number" || typeof y !== "number") throw new Error("Coordinates must be [longitude, latitude].");
      w = Math.min(w, x);
      e = Math.max(e, x);
      s = Math.min(s, y);
      n = Math.max(n, y);
    }
  }
  if (!(w >= -180 && e <= 180 && s >= -90 && n <= 90)) throw new Error("Coordinates must be longitude/latitude (WGS84).");
  return { polygons: polys, bbox: [w, s, e, n] };
}

function mean(a) {
  return a.reduce((x, y) => x + y, 0) / a.length;
}

// seasonal (calendar-month) ratio num/den with relative spread, over the given months
function seasonalRatio(num, den, months, monthOfYear) {
  const byMonth = Array.from({ length: 12 }, () => []);
  const all = [];
  for (const m of months) {
    if (den[m] > 0) {
      const r = num[m] / den[m];
      byMonth[monthOfYear[m]].push(r);
      all.push(r);
    }
  }
  const pooled = all.length ? mean(all) : 1;
  const means = byMonth.map((r) => (r.length ? mean(r) : NaN));
  const rels = byMonth.map((r, i) => {
    if (!r.length || !(means[i] > 0)) return NaN;
    const sd = Math.sqrt(mean(r.map((x) => (x - means[i]) ** 2)));
    return sd / means[i];
  });
  const valid = rels.filter((x) => !Number.isNaN(x));
  const relPool = valid.length ? mean(valid) : 0.5;
  return {
    ratio: means.map((x) => (Number.isNaN(x) ? pooled : x)),
    rel: rels.map((x) => (Number.isNaN(x) ? relPool : x)),
  };
}

// Mirrors aoi_series() in pipeline/export_frontend_data.py
export function computeAoiSeries(mask, cd, meta) {
  const last = Date.parse(`${meta.axisEnd}T00:00:00Z`);
  const nDays = Math.round((last - AXIS0) / DAY) + 1;
  const lastDate = new Date(last);
  const monthCount = (lastDate.getUTCFullYear() - 2000) * 12 + lastDate.getUTCMonth() + 1;
  const monthOf = new Int16Array(nDays);
  const monthOfYear = new Int8Array(monthCount);
  for (let d = 0; d < nDays; d++) {
    const t = new Date(AXIS0 + d * DAY);
    const mi = (t.getUTCFullYear() - 2000) * 12 + t.getUTCMonth();
    monthOf[d] = mi;
    monthOfYear[mi] = t.getUTCMonth();
  }

  const daily = {};
  const monthly = {};
  const seen = new Uint8Array(mask.length);
  for (const sensor of ["MODIS_TERRA", "MODIS_AQUA", "VIIRS_SNPP"]) {
    const dd = new Float64Array(nDays);
    const mm = new Float64Array(monthCount);
    const { cell, day, n } = cd[sensor];
    for (let i = 0; i < n; i++) {
      if (mask[cell[i]] && day[i] < nDays) {
        dd[day[i]] += 1;
        mm[monthOf[day[i]]] += 1;
        seen[cell[i]] = 1;
      }
    }
    daily[sensor] = dd;
    monthly[sensor] = mm;
  }
  const dayIdx = (y, m, d) => Math.round((Date.UTC(y, m, d) - AXIS0) / DAY);
  const mIdx = (y, m) => (y - 2000) * 12 + m;
  const range = (a, b) => Array.from({ length: Math.max(0, b - a) }, (_, i) => a + i);

  const v = seasonalRatio(monthly.VIIRS_SNPP, monthly.MODIS_AQUA, range(mIdx(2012, 1), monthCount), monthOfYear);
  const a = seasonalRatio(monthly.MODIS_AQUA, monthly.MODIS_TERRA, range(mIdx(2002, 7), mIdx(2012, 0)), monthOfYear);

  const viirsStart = dayIdx(2012, 0, 20);
  const aquaStart = dayIdx(2002, 6, 1);
  const terraStart = dayIdx(2000, 10, 1);
  const values = new Array(nDays).fill(null);
  const lo = new Array(nDays).fill(null);
  const hi = new Array(nDays).fill(null);
  for (let d = terraStart; d < nDays; d++) {
    const mo = monthOfYear[monthOf[d]];
    let val;
    let rel = 0;
    if (d >= viirsStart) val = daily.VIIRS_SNPP[d];
    else if (d >= aquaStart) {
      val = daily.MODIS_AQUA[d] * v.ratio[mo];
      rel = v.rel[mo];
    } else {
      val = daily.MODIS_TERRA[d] * a.ratio[mo] * v.ratio[mo];
      rel = Math.hypot(v.rel[mo], a.rel[mo]);
    }
    values[d] = Math.round(val * 10) / 10;
    lo[d] = Math.round(Math.max(val * (1 - rel), 0) * 10) / 10;
    hi[d] = Math.round(val * (1 + rel) * 10) / 10;
  }
  const viirsTotal = cd.VIIRS_SNPP ? daily.VIIRS_SNPP.reduce((x, y) => x + y, 0) : 0;
  return {
    values,
    lo,
    hi,
    cells: seen.reduce((x, y) => x + y, 0),
    lowData: viirsTotal < LOW_DATA_CELLDAYS,
  };
}
