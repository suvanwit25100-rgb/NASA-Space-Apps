import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { buildModel, yearSummary } from "../lib/analytics";
import { calibrateArea, parseGeoJSON } from "../lib/aoi";
import { loadMapYear, loadSeries } from "../lib/data";
import { copyText } from "../lib/exporters";
import { useCoarse } from "../lib/hooks";
import { navigate } from "../lib/router";
import { TOUR } from "../lib/tour";

const MAX_VERTICES = 50000;
export const MIN_YEAR = 2001;

const Ctx = createContext(null);
export const useExplorer = () => useContext(Ctx);

function readUrl(ids, maxYear) {
  const p = new URLSearchParams(window.location.search);
  const aoi = p.get("aoi");
  const bbox = (p.get("bbox") || "").split(",").map(Number);
  const validBbox = bbox.length === 4 && bbox.every(Number.isFinite) && bbox[0] < bbox[2] && bbox[1] < bbox[3];
  const y = Number(p.get("y"));
  const m = p.get("m") == null ? null : Number(p.get("m"));
  return {
    aoi: aoi === "custom" && validBbox ? "custom" : ids.includes(aoi) ? aoi : "punjab-haryana",
    bbox: validBbox ? bbox : null,
    year: y >= MIN_YEAR && y <= maxYear ? y : maxYear,
    month: m != null && m >= 0 && m <= 11 ? m : null,
    mode: p.get("mode") === "anomaly" ? "anomaly" : "activity",
    cmp: ids.includes(p.get("cmp")) || p.get("cmp") === "custom" ? p.get("cmp") : "",
  };
}

export const rectName = ([w, s, e, n]) => `Custom area · ${((s + n) / 2).toFixed(1)}°N ${((w + e) / 2).toFixed(1)}°E`;

export function ExplorerProvider({ data, children }) {
  const { regions, meta, cells4 } = data;
  const ids = useMemo(() => regions.map((r) => r.id), [regions]);
  const byId = useMemo(() => Object.fromEntries(regions.map((r) => [r.id, r])), [regions]);
  const world = byId.world;
  const featured = useMemo(() => regions.filter((r) => r.kind === "featured"), [regions]);
  const countries = useMemo(() => regions.filter((r) => r.kind === "country").sort((a, b) => a.name.localeCompare(b.name)), [regions]);
  const maxYear = Number(meta.axisEnd.slice(0, 4));
  const initial = useMemo(() => readUrl(ids, maxYear), [ids, maxYear]);

  const [aoiId, setAoiId] = useState(initial.aoi);
  const [year, setYear] = useState(initial.year);
  const [mode, setMode] = useState(initial.mode);
  const [mapMonth, setMapMonth] = useState(initial.month);
  const [cmpId, setCmpId] = useState(initial.cmp);
  const [loaded, setLoaded] = useState({});
  const [loadError, setLoadError] = useState("");
  const [custom, setCustom] = useState(null);
  const [drawing, setDrawing] = useState(false);
  const [toast, setToast] = useState("");
  const [mapYear, setMapYear] = useState(null);
  const [search, setSearch] = useState("");
  const coarse = useCoarse();
  const [tourStep, setTourStep] = useState(() => (new URLSearchParams(window.location.search).get("tour") === "1" ? 0 : null));
  const fileRef = useRef(null);
  const toastTimer = useRef(null);
  const lastModel = useRef(null);

  const customModel = useMemo(() => (custom?.status === "ready" ? buildModel(custom.aoi, meta) : null), [custom, meta]);

  const flash = (msg) => {
    clearTimeout(toastTimer.current);
    setToast(msg);
    toastTimer.current = setTimeout(() => setToast(""), 4500);
  };

  const wanted = [aoiId, cmpId].filter((id) => id && id !== "custom");
  useEffect(() => {
    let cancelled = false;
    for (const id of wanted) {
      if (loaded[id]) continue;
      loadSeries(id)
        .then((s) => {
          if (cancelled) return;
          setLoadError("");
          setLoaded((prev) => ({ ...prev, [id]: buildModel({ ...byId[id], ...s }, meta) }));
        })
        .catch((e) => !cancelled && setLoadError(e.message));
    }
    return () => {
      cancelled = true;
    };
  }, [aoiId, cmpId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let cancelled = false;
    loadMapYear(year)
      .then((d) => !cancelled && setMapYear(d))
      .catch((e) => !cancelled && flash(e.message));
    return () => {
      cancelled = true;
    };
  }, [year]);

  const startCustom = ({ bbox, polygons, source, name }) => {
    const previous = { aoiId, custom };
    setDrawing(false);
    setAoiId("custom");
    setCustom({ status: "loading", source, name, bbox });
    calibrateArea({ bbox, polygons }, meta)
      .then((res) => setCustom({ status: "ready", source, name, bbox, aoi: { id: "custom", name, bbox, polygons, noFit: source === "rect", ...res } }))
      .catch((e) => {
        setAoiId(previous.aoiId === "custom" && previous.custom?.status !== "ready" ? "punjab-haryana" : previous.aoiId);
        setCustom(previous.custom?.status === "ready" ? previous.custom : null);
        flash(e.message);
      });
  };

  const removeCustom = () => {
    setCustom(null);
    if (aoiId === "custom") setAoiId("punjab-haryana");
    if (cmpId === "custom") setCmpId("");
  };

  const initialised = useRef(false);
  useEffect(() => {
    if (initialised.current) return;
    initialised.current = true;
    if (initial.aoi === "custom" && initial.bbox) startCustom({ bbox: initial.bbox, source: "rect", name: rectName(initial.bbox) });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const model = (aoiId === "custom" ? customModel : loaded[aoiId]) || lastModel.current;
  useEffect(() => {
    if (model) lastModel.current = model;
  }, [model]);
  const cmpModel = cmpId && cmpId !== aoiId ? (cmpId === "custom" ? customModel : loaded[cmpId]) : null;

  useEffect(() => {
    const sp = new URLSearchParams();
    sp.set("aoi", aoiId);
    if (aoiId === "custom" && custom?.bbox) sp.set("bbox", custom.bbox.map((v) => v.toFixed(3)).join(","));
    sp.set("y", year);
    if (mapMonth != null) sp.set("m", mapMonth);
    if (mode !== "activity") sp.set("mode", mode);
    if (cmpId) sp.set("cmp", cmpId);
    window.history.replaceState(null, "", `${window.location.pathname}?${sp.toString()}`);
  }, [aoiId, custom, year, mapMonth, mode, cmpId]);

  const select = (y, m) => {
    if (y >= MIN_YEAR && y <= maxYear) setYear(y);
    if (m !== undefined) setMapMonth(m);
  };

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 5e6) return flash("That file is over 5 MB. Please simplify it first.");
    try {
      const { polygons, bbox } = parseGeoJSON(await file.text());
      const vertices = polygons.reduce((n, rings) => n + rings.reduce((m, r) => m + r.length, 0), 0);
      if (vertices > MAX_VERTICES) return flash(`That outline has ${vertices.toLocaleString()} vertices. Please simplify it below ${MAX_VERTICES.toLocaleString()}.`);
      startCustom({ bbox, polygons, source: "file", name: file.name.replace(/\.[^.]+$/, "").slice(0, 40) || "Uploaded area" });
    } catch (err) {
      flash(err.message);
    }
  };

  const toggleDrawing = () => {
    setDrawing((d) => !d);
    document.querySelector(".map-wrap")?.scrollIntoView({ block: "center", behavior: "smooth" });
  };

  const share = async () => {
    const ok = await copyText(window.location.href);
    flash(ok ? (aoiId === "custom" && custom?.source === "file" ? "Link copied. Uploaded outlines are shared as their bounding box." : "Link copied.") : "Could not copy the link.");
  };

  const onSearch = (value) => {
    setSearch(value);
    const hit = countries.find((c) => c.name.toLowerCase() === value.trim().toLowerCase());
    if (hit) {
      setAoiId(hit.id);
      setSearch("");
    }
  };

  // ---- guided tour: each step names a page, a target on it and the state to show
  const tourCtx = { models: loaded, year, maxYear };
  const ctxRef = useRef(tourCtx);
  ctxRef.current = tourCtx;

  useEffect(() => {
    if (tourStep == null) return undefined;
    const cfg = TOUR[tourStep];
    const a = cfg.apply(ctxRef.current);
    setAoiId(a.aoi);
    setYear(a.year);
    setMode(a.mode);
    setMapMonth(a.month);
    setCmpId(a.cmp);
    navigate(cfg.route);
    let tries = 0;
    let timer;
    const focus = () => {
      const el = document.querySelector(`[data-tour="${cfg.target}"]`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
        el.classList.add("tour-focus");
      } else if (tries++ < 30) timer = setTimeout(focus, 160);
    };
    timer = setTimeout(focus, 300);
    return () => {
      clearTimeout(timer);
      document.querySelectorAll(".tour-focus").forEach((n) => n.classList.remove("tour-focus"));
    };
  }, [tourStep]);

  useEffect(() => {
    if (tourStep == null) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") setTourStep(null);
      else if (e.key === "ArrowRight") setTourStep((i) => Math.min(i + 1, TOUR.length - 1));
      else if (e.key === "ArrowLeft") setTourStep((i) => Math.max(i - 1, 0));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [tourStep]);

  useEffect(() => {
    window.__burnlogExplorer = true;
    const on = () => setTourStep(0);
    window.addEventListener("burnlog:tour", on);
    return () => {
      window.__burnlogExplorer = false;
      window.removeEventListener("burnlog:tour", on);
    };
  }, []);

  const aoi = model?.aoi;
  const sum = model ? yearSummary(model, year) : null;

  const value = {
    regions, meta, cells4, byId, world, featured, countries, maxYear, minYear: MIN_YEAR,
    aoiId, setAoiId, year, setYear, select, mode, setMode, mapMonth, setMapMonth, cmpId, setCmpId,
    loaded, loadError, model, aoi, sum, cmpModel, yearRound: !!sum && sum.main.end - sum.main.start >= 300,
    activeCountry: byId[aoiId]?.kind === "country",
    custom, customModel, startCustom, removeCustom, drawing, toggleDrawing, onFile, fileRef,
    mapYear, search, onSearch, share, flash, toast, coarse, tourStep, setTourStep, tourCtx,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
