import { useEffect, useMemo, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?url";
import { MapboxOverlay } from "@deck.gl/mapbox";
import { H3HexagonLayer } from "@deck.gl/geo-layers";
import { PolygonLayer } from "@deck.gl/layers";
import { fireColor } from "../lib/colors";
import { FIRE_CSS } from "../lib/colors";
import { MONTHS } from "../lib/analytics";
import { useCoarse } from "../lib/hooks";

maplibregl.setWorkerUrl(workerUrl);

const STYLE = "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";

const THIN = 3; // fewer burning days than this in a cell is one or two detections, too little to read as a pattern

export default function FireMap({ cells4, mapYear, aoi, year, month, drawing, onDrawn }) {
  const [flagThin, setFlagThin] = useState(false);
  const hostRef = useRef(null);
  const mapRef = useRef(null);
  const overlayRef = useRef(null);
  const [hover, setHover] = useState(null);
  const [ready, setReady] = useState(false);
  const [draft, setDraft] = useState(null);
  const coarse = useCoarse();
  const onDrawnRef = useRef(onDrawn);
  onDrawnRef.current = onDrawn;

  const data = useMemo(() => {
    if (!mapYear) return { rows: [], ref: 1 };
    const acc = new Uint16Array(cells4.length);
    for (let i = 0; i < mapYear.n; i++) if (month == null || mapYear.month[i] === month) acc[mapYear.cell[i]] += mapYear.days[i];
    const out = [];
    for (let i = 0; i < acc.length; i++) if (acc[i] > 0) out.push({ hex: cells4[i], v: acc[i] });
    const sorted = out.map((d) => d.v).sort((a, b) => a - b);
    const ref = sorted.length ? Math.max(sorted[Math.floor(sorted.length * 0.97)], 2) : 1;
    return { rows: out, ref };
  }, [cells4, mapYear, month]);

  useEffect(() => {
    const map = new maplibregl.Map({
      container: hostRef.current,
      style: STYLE,
      center: [30, 15],
      zoom: 1.8,
      minZoom: 1,
      maxZoom: 9,
      attributionControl: { compact: true },
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    const overlay = new MapboxOverlay({ interleaved: false, layers: [] });
    map.addControl(overlay);
    map.on("load", () => setReady(true));
    mapRef.current = map;
    overlayRef.current = overlay;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || aoi.noFit) return;
    const [w, s, e, n] = aoi.bbox;
    map.fitBounds([[w, s], [e, n]], { padding: 40, duration: 900, maxZoom: 7 });
  }, [aoi, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !drawing) return undefined;
    let start = null;
    let last = null;
    const canvas = map.getCanvas();
    canvas.style.cursor = "crosshair";
    canvas.style.touchAction = "none";
    map.dragPan.disable();
    const box = (a, b) => [Math.min(a.lng, b.lng), Math.min(a.lat, b.lat), Math.max(a.lng, b.lng), Math.max(a.lat, b.lat)];
    const cancel = () => {
      start = null;
      last = null;
      setDraft(null);
    };
    const down = (e) => {
      if (e.points && e.points.length > 1) return cancel(); // a second finger means pinch-zoom, not drawing
      start = e.lngLat;
      last = e.lngLat;
    };
    const move = (e) => {
      if (e.points && e.points.length > 1) return cancel();
      if (!start) return;
      last = e.lngLat;
      setDraft(box(start, e.lngLat));
    };
    const up = (e) => {
      if (!start) return;
      const b = box(start, last || e.lngLat);
      cancel();
      if (b[2] - b[0] > 0.15 && b[3] - b[1] > 0.15) onDrawnRef.current?.(b);
    };
    const events = [["mousedown", down], ["mousemove", move], ["mouseup", up], ["touchstart", down], ["touchmove", move], ["touchend", up], ["touchcancel", cancel]];
    events.forEach(([n, f]) => map.on(n, f));
    return () => {
      events.forEach(([n, f]) => map.off(n, f));
      map.dragPan.enable();
      canvas.style.cursor = "";
      canvas.style.touchAction = "";
      setDraft(null);
    };
  }, [drawing, ready]);

  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay) return;
    const [w, s, e, n] = aoi.bbox;
    overlay.setProps({
      layers: [
        new PolygonLayer({
          id: "aoi",
          data: aoi.polygons ? aoi.polygons.map((p) => ({ p })) : [{ p: [[[w, s], [e, s], [e, n], [w, n]]] }],
          getPolygon: (d) => d.p,
          filled: false,
          stroked: true,
          getLineColor: [159, 208, 255, 200],
          getLineWidth: 2,
          lineWidthUnits: "pixels",
        }),
        new PolygonLayer({
          id: "draft",
          data: draft ? [{ p: [[[draft[0], draft[1]], [draft[2], draft[1]], [draft[2], draft[3]], [draft[0], draft[3]]]] }] : [],
          getPolygon: (d) => d.p,
          filled: true,
          getFillColor: [255, 138, 31, 40],
          stroked: true,
          getLineColor: [255, 138, 31, 255],
          getLineWidth: 2,
          lineWidthUnits: "pixels",
        }),
        new H3HexagonLayer({
          id: "thin",
          data: flagThin ? data.rows.filter((d) => d.v < THIN) : [],
          getHexagon: (d) => d.hex,
          filled: false,
          stroked: true,
          getLineColor: [159, 208, 255, 230],
          getLineWidth: 1.5,
          lineWidthUnits: "pixels",
          extruded: false,
          coverage: 0.92,
        }),
        new H3HexagonLayer({
          id: "burn",
          data: data.rows,
          getHexagon: (d) => d.hex,
          getFillColor: (d) => {
            const c = fireColor(d.v, data.ref) || [0, 0, 0];
            return [c[0], c[1], c[2], 90 + Math.min(150, (d.v / data.ref) * 160)];
          },
          extruded: false,
          pickable: true,
          coverage: 0.92,
          onHover: (info) => setHover(info.object ? { x: info.x, y: info.y, v: info.object.v } : null),
          updateTriggers: { getFillColor: [data.ref] },
        }),
      ],
    });
  }, [data, aoi, ready, draft, flagThin]);

  const thinCount = useMemo(() => data.rows.filter((d) => d.v < THIN).length, [data]);

  const era = year >= 2012 ? "VIIRS 375 m" : year >= 2003 ? "MODIS Aqua 1 km" : "MODIS Terra 1 km";
  const label = month == null ? `${year}, full year` : `${MONTHS[month]} ${year}`;
  const loading = !mapYear;

  return (
    <>
      <div className="map-wrap">
        <div ref={hostRef} style={{ position: "absolute", inset: 0 }} />
        <div className="map-badge">
          {loading ? "Loading map…" : <>Showing <b>{label}</b> · {data.rows.length.toLocaleString()} burning cells · <span style={{ color: "#8fa8c4" }}>{era}</span></>}
        </div>
        {drawing && <div className="map-badge" style={{ top: "auto", bottom: 34, borderColor: "#ff8a1f" }}>{coarse ? "Press and drag with one finger to draw your area" : "Click and drag on the map to draw your area"}</div>}
        {hover && (
          <div className="map-tip" style={{ left: hover.x, top: hover.y }}>
            <b>{hover.v}</b> burning day{hover.v === 1 ? "" : "s"} in this ~1,770 km² cell
          </div>
        )}
      </div>
      <div className="legend" style={{ marginTop: 12 }}>
        <span>Fewer burning days<i className="ramp" style={{ background: FIRE_CSS }} />More burning days</span>
        <span>
          <label className="thin-toggle">
            <input type="checkbox" checked={flagThin} onChange={(e) => setFlagThin(e.target.checked)} /> Outline thin-evidence cells ({thinCount.toLocaleString()} of {data.rows.length.toLocaleString()} have under {THIN} burning days)
          </label>
        </span>
        <span>Colour is scaled within the selected period, so compare patterns, not absolute levels, across years.</span>
      </div>
    </>
  );
}
