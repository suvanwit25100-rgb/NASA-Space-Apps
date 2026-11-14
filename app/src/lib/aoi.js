import { loadBuffer } from "./data";

const DAY = 86400000;
const AXIS0 = Date.UTC(2000, 0, 1);
const LOW_DATA_CELLDAYS = 500;
const MAX_TILES = 16;
const SENSORS = ["MODIS_TERRA", "MODIS_AQUA", "VIIRS_SNPP"];

let tileIndexPromise = null;
const tileIndex = () => {
  if (!tileIndexPromise) {
    tileIndexPromise = fetch(`${import.meta.env.BASE_URL}data/tiles/index.json`)
      .then((r) => {
        if (!r.ok) throw new Error("Could not load the tile index");
        return r.json();
      })
      .catch((e) => {
        tileIndexPromise = null;
        throw e;
      });
  }
  return tileIndexPromise;
};

function parseTile(buf) {
  const dv = new DataView(buf);
  const nCells = dv.getUint32(0, true);
  const coords = new Float32Array(buf, 4, nCells * 2);
  const lat = new Float32Array(nCells);
  const lon = new Float32Array(nCells);
  for (let i = 0; i < nCells; i++) {
    lat[i] = coords[2 * i];
    lon[i] = coords[2 * i + 1];
  }
  let off = 4 + nCells * 8;
  const seg = {};
  for (const s of SENSORS) {
    const n = dv.getUint32(off, true);
    off += 4;
    seg[s] = { n, cell: new Uint16Array(buf, off, n), day: new Uint16Array(buf, off + 2 * n, n) };
    off += 4 * n;
  }
  return { nCells, lat, lon, seg };
}

// Loads the 5-degree tiles that a bounding box touches (rejects very large areas).
export async function loadTilesFor(bbox) {
  const idx = await tileIndex();
  const d = idx.tileDeg;
  const cols = 360 / d;
  const [w, s, e, n] = bbox;
  const x0 = Math.max(0, Math.floor((w + 180) / d));
  const x1 = Math.min(cols - 1, Math.floor((e + 180) / d));
  const y0 = Math.max(0, Math.floor((s + 90) / d));
  const y1 = Math.min(180 / d - 1, Math.floor((n + 90) / d));
  const ids = [];
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (idx.tiles[y * cols + x]) ids.push(y * cols + x);
  if ((x1 - x0 + 1) * (y1 - y0 + 1) > MAX_TILES) {
    throw new Error("That area is too large to calibrate in the browser. Draw a smaller one, or pick a region or country from the list.");
  }
  if (!ids.length) throw new Error("No fire detections fall inside that area.");
  const tiles = await Promise.all(ids.map((id) => loadBuffer(`tiles/${id}.bin.gz`).then(parseTile)));
  return tiles;
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

export function maskFromBBox(tile, bbox) {
  const [w, s, e, n] = bbox;
  const mask = new Uint8Array(tile.nCells);
  for (let i = 0; i < mask.length; i++) {
    if (tile.lon[i] >= w && tile.lon[i] <= e && tile.lat[i] >= s && tile.lat[i] <= n) mask[i] = 1;
  }
  return mask;
}

export function maskFromPolygons(tile, polygons) {
  const mask = new Uint8Array(tile.nCells);
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
    const x = tile.lon[i];
    const y = tile.lat[i];
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

// Mirrors aoi_series() in pipeline/calibration.py. parts: [{ tile, mask }]
export function computeAoiSeries(parts, meta) {
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
  let cells = 0;
  const seenByPart = parts.map((p) => new Uint8Array(p.tile.nCells));
  for (const sensor of SENSORS) {
    const dd = new Float64Array(nDays);
    const mm = new Float64Array(monthCount);
    parts.forEach((p, k) => {
      const { cell, day, n } = p.tile.seg[sensor];
      for (let i = 0; i < n; i++) {
        if (p.mask[cell[i]] && day[i] < nDays) {
          dd[day[i]] += 1;
          mm[monthOf[day[i]]] += 1;
          seenByPart[k][cell[i]] = 1;
        }
      }
    });
    daily[sensor] = dd;
    monthly[sensor] = mm;
  }
  for (const s of seenByPart) for (let i = 0; i < s.length; i++) cells += s[i];

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
  const viirsTotal = daily.VIIRS_SNPP.reduce((x, y) => x + y, 0);
  const ratios = { aqua_over_terra: Array.from(a.ratio, (x) => Math.round(x * 100) / 100) };
  return { values, lo, hi, cells, ratios, lowData: viirsTotal < LOW_DATA_CELLDAYS };
}

export async function calibrateArea({ bbox, polygons }, meta) {
  const tiles = await loadTilesFor(bbox);
  const parts = tiles.map((tile) => ({ tile, mask: polygons ? maskFromPolygons(tile, polygons) : maskFromBBox(tile, bbox) }));
  const res = computeAoiSeries(parts, meta);
  if (res.cells === 0) throw new Error("No fire detections fall inside that area.");
  return res;
}
