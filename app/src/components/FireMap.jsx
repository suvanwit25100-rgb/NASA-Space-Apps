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
import { cellToLatLng } from "h3-js";
import { coverageFactor } from "../lib/overpass";

maplibregl.setWorkerUrl(workerUrl);

const STYLE = "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";

const THIN = 3; // fewer burning days than this in a cell is one or two detections, too little to read as a pattern

export default function FireMap({ cells4, mapYear, aoi, year, month, setMonth, drawing, onToggleDraw, onDrawn }) {
  const [flagThin, setFlagThin] = useState(false);
  const [adjust, setAdjust] = useState(false);
  const [layersOpen, setLayersOpen] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [isFs, setIsFs] = useState(false);
  const wrapRef = useRef(null);
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
    for (let i = 0; i < acc.length; i++) {
      if (acc[i] <= 0) continue;
      const raw = acc[i];
      let v = raw;
      if (adjust) {
        const [lat] = cellToLatLng(cells4[i]);
        v = raw / coverageFactor(lat, year >= 2012 ? "viirs" : "modis");
      }
      out.push({ hex: cells4[i], v, raw });
    }
    const sorted = out.map((d) => d.v).sort((a, b) => a - b);
    const ref = sorted.length ? Math.max(sorted[Math.floor(sorted.length * 0.97)], 2) : 1;
    return { rows: out, ref };
  }, [cells4, mapYear, month, adjust, year]);

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
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");
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
          visible: aoi.id !== "world",
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
          data: flagThin ? data.rows.filter((d) => d.raw < THIN) : [],
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
          onHover: (info) => setHover(info.object ? { x: info.x, y: info.y, v: info.object.v, raw: info.object.raw } : null),
          updateTriggers: { getFillColor: [data.ref] },
        }),
      ],
    });
  }, [data, aoi, ready, draft, flagThin]);

  const thinCount = useMemo(() => data.rows.filter((d) => d.raw < THIN).length, [data]);

  useEffect(() => {
    if (!playing) return undefined;
    const id = setInterval(() => setMonth((m) => (m == null ? 0 : (m + 1) % 12)), 1100);
    return () => clearInterval(id);
  }, [playing, setMonth]);

  useEffect(() => {
    const on = () => {
      setIsFs(document.fullscreenElement === wrapRef.current);
      setTimeout(() => mapRef.current?.resize(), 60);
    };
    document.addEventListener("fullscreenchange", on);
    return () => document.removeEventListener("fullscreenchange", on);
  }, []);

  const fullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else wrapRef.current?.requestFullscreen?.();
  };
  const resetView = () => {
    const map = mapRef.current;
    if (!map) return;
    const [w, s, e, n] = aoi.bbox;
    map.fitBounds([[w, s], [e, n]], { padding: 40, duration: 900, maxZoom: 7 });
  };

  const era = year >= 2012 ? "VIIRS 375 m" : year >= 2003 ? "MODIS Aqua 1 km" : "MODIS Terra 1 km";
  const label = month == null ? `${year}, full year` : `${MONTHS[month]} ${year}`;
  const loading = !mapYear;

  return (
    <div className={`map-wrap ${isFs ? "fs" : ""}`} ref={wrapRef}>
      <div ref={hostRef} style={{ position: "absolute", inset: 0 }} />
      <div className="map-vignette" aria-hidden="true" />

      <div className="map-badge">
        {loading ? "Loading map…" : <>
          <span className="live-dot" aria-hidden="true" />
          <b>{label}</b>
          <span className="sep">·</span>{data.rows.length.toLocaleString()} burning cells
          <span className="sep">·</span><span className="era">{era}</span>
        </>}
      </div>

      <div className="map-tools" role="group" aria-label="Map tools">
        <button className="map-btn" onClick={onToggleDraw} aria-pressed={drawing} title={drawing ? "Cancel drawing" : "Draw an area"}>
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="4" y="5" width="16" height="14" rx="2" strokeDasharray="3 3" /><path d="M9 12h6M12 9v6" /></svg>
          <span>{drawing ? "Cancel" : "Draw area"}</span>
        </button>
        <button className="map-btn" onClick={resetView} title="Zoom back to the selected area">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="2" /></svg>
          <span>Reset view</span>
        </button>
        <button className="map-btn" onClick={fullscreen} title={isFs ? "Exit full screen" : "Full screen"}>
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" /></svg>
          <span>{isFs ? "Exit" : "Full screen"}</span>
        </button>
        <div className="layers">
          <button className="map-btn" onClick={() => setLayersOpen((o) => !o)} aria-expanded={layersOpen} title="Map layers and corrections">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3 3 8l9 5 9-5-9-5zM3 13l9 5 9-5" /></svg>
            <span>Layers</span>
          </button>
          {layersOpen && (
            <div className="layers-menu">
              <label className="thin-toggle">
                <input type="checkbox" checked={flagThin} onChange={(e) => setFlagThin(e.target.checked)} />
                <span><b>Outline thin-evidence cells</b><small>{thinCount.toLocaleString()} of {data.rows.length.toLocaleString()} have under {THIN} burning days</small></span>
              </label>
              <label className="thin-toggle">
                <input type="checkbox" checked={adjust} onChange={(e) => setAdjust(e.target.checked)} />
                <span><b>Adjust for satellite coverage</b><small>Orbits converge toward the poles, so high-latitude cells are seen more often</small></span>
              </label>
            </div>
          )}
        </div>
      </div>

      <div className="map-legend" aria-label="Colour scale">
        <span className="caps">Burning days</span>
        <i className="ramp" style={{ background: FIRE_CSS }} />
        <div className="ends"><span>Few</span><span>Many</span></div>
        <small>Scaled within the selected period</small>
      </div>

      <div className="map-timeline" role="group" aria-label="Map period">
        <button className="play" onClick={() => setPlaying((p) => !p)} aria-pressed={playing} aria-label={playing ? "Pause the month-by-month animation" : "Play the year month by month"}>
          {playing ? (
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>
          ) : (
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>
          )}
        </button>
        <div className="months">
          <button aria-pressed={month == null} onClick={() => { setPlaying(false); setMonth(null); }}>Year</button>
          {MONTHS.map((m, i) => (
            <button key={m} aria-pressed={month === i} onClick={() => { setPlaying(false); setMonth(i); }}>{m}</button>
          ))}
        </div>
      </div>

      {drawing && <div className="map-banner">{coarse ? "Press and drag with one finger to draw your area" : "Click and drag on the map to draw your area"}</div>}
      {hover && (
        <div className="map-tip" style={{ left: hover.x, top: hover.y }}>
          <i style={{ background: `rgb(${(fireColor(hover.v, data.ref) || [255, 122, 47]).map((c) => Math.round(c)).join(",")})` }} />
          <span><b>{hover.raw}</b> burning day{hover.raw === 1 ? "" : "s"}{adjust ? ` (${hover.v.toFixed(1)} adjusted)` : ""}<small>in this ~1,770 km² cell</small></span>
        </div>
      )}
    </div>
  );
}
