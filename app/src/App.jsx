import { Fragment, useEffect, useState } from "react";
import Nav from "./components/Nav";
import Tour from "./components/Tour";
import { loadCells4, loadRegions, loadSky } from "./lib/data";
import { PALETTE_NAMES, getPalette, setPalette } from "./lib/colors";
import { LANGS, getLang, setLang, t } from "./lib/i18n";
import { CHAPTERS, Link, navigate, useRoute } from "./lib/router";
import { TOUR } from "./lib/tour";
import AboutPage from "./pages/AboutPage";
import CalendarPage from "./pages/CalendarPage";
import DataPage from "./pages/DataPage";
import ComparePage from "./pages/ComparePage";
import Home from "./pages/Home";
import MapPage from "./pages/MapPage";
import MethodPage from "./pages/MethodPage";
import SeasonsPage from "./pages/SeasonsPage";
import { ExplorerProvider, useExplorer } from "./state/Explorer";

function SiteFooter({ palette, onPalette, lang, onLang }) {
  return (
    <footer className="footer">
      <div className="palette-switch" role="group" aria-label="Colour scheme for the heatmap and map">
        <span className="caps">{t("Colours")}</span>
        {Object.entries(PALETTE_NAMES).map(([k, label]) => (
          <button key={k} className="chip" aria-pressed={palette === k} onClick={() => onPalette(k)}>{t(label)}</button>
        ))}
      </div>
      <div className="palette-switch" role="group" aria-label={t("Language")}>
        <span className="caps">{t("Language")}</span>
        {Object.entries(LANGS).map(([k, label]) => (
          <button key={k} className="chip" lang={k} aria-pressed={lang === k} onClick={() => onLang(k)}>{label}</button>
        ))}
        {lang !== "en" && <small className="hint">Interface translated with AI assistance, not yet reviewed by native speakers; the long explanations are still in English.</small>}
      </div>
      <p>Fire detections: NASA FIRMS (MODIS, VIIRS). Validation: NASA MCD64A1 and GFED4.1s. Basemap: © OpenStreetMap contributors © CARTO.</p>
      <p>Global Burn Log is a hackathon project; do not use it for operational emergency decisions. <Link to="/data">{t("Use the data")}</Link></p>
      <p className="copyright">© 2026 QuickSort. All rights reserved.</p>
    </footer>
  );
}

function RoutedPage({ route }) {
  switch (route) {
    case "/calendar": return <CalendarPage />;
    case "/seasons": return <SeasonsPage />;
    case "/data": return <DataPage />;
    case "/map": return <MapPage />;
    case "/compare": return <ComparePage />;
    case "/method": return <MethodPage />;
    case "/about": return <AboutPage />;
    default: return null;
  }
}

function TourMount() {
  const e = useExplorer();
  if (e.tourStep == null) return null;
  const steps = TOUR.map((t) => ({ id: t.id, title: t.title, body: t.body(e.tourCtx) }));
  return (
    <Tour
      index={e.tourStep}
      steps={steps}
      onBack={() => e.setTourStep((i) => Math.max(i - 1, 0))}
      onNext={() => e.setTourStep((i) => Math.min(i + 1, TOUR.length - 1))}
      onClose={() => e.setTourStep(null)}
    />
  );
}

function Toast() {
  const e = useExplorer();
  return e.toast ? <div className="toast" role="status">{e.toast}</div> : null;
}

export default function App() {
  const route = useRoute();
  const [palette, setPaletteState] = useState(() => {
    let v = "fire";
    try {
      v = window.localStorage.getItem("burnlog:palette") || "fire";
    } catch {
      /* storage can be blocked; the default look is fine */
    }
    setPalette(v);
    return getPalette();
  });
  const [lang, setLangState] = useState(() => {
    let v = "en";
    try {
      v = window.localStorage.getItem("burnlog:lang") || "en";
    } catch {
      /* default */
    }
    if (!LANGS[v]) v = "en";
    setLang(v, CHAPTERS);
    return getLang();
  });
  const chooseLang = (v) => {
    setLang(v, CHAPTERS);
    setLangState(v);
    try {
      window.localStorage.setItem("burnlog:lang", v);
    } catch {
      /* not persisted */
    }
  };
  const choosePalette = (v) => {
    setPalette(v);
    setPaletteState(v);
    try {
      window.localStorage.setItem("burnlog:palette", v);
    } catch {
      /* not persisted in private windows */
    }
  };
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  // scroll animation: progress bar, background parallax, and sections that glide in as you reach them
  useEffect(() => {
    const root = document.documentElement;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    const on = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const max = Math.max(1, root.scrollHeight - window.innerHeight);
        root.style.setProperty("--progress", String(Math.min(1, window.scrollY / max)));
        root.style.setProperty("--bgshift", `${reduce ? 0 : window.scrollY * -0.08}px`);
      });
    };
    on();
    window.addEventListener("scroll", on, { passive: true });
    window.addEventListener("resize", on);
    return () => {
      window.removeEventListener("scroll", on);
      window.removeEventListener("resize", on);
      cancelAnimationFrame(raf);
    };
  }, []);

  useEffect(() => {
    if (route === "/" || !data) return undefined;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce || !("IntersectionObserver" in window)) return undefined;
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }),
      { threshold: 0.08, rootMargin: "0px 0px -6% 0px" },
    );
    const t = setTimeout(() => {
      document.querySelectorAll(".page > *").forEach((el, i) => {
        if (el.classList.contains("in")) return;
        el.classList.add("scroll-in");
        el.style.setProperty("--d", `${Math.min(i, 4) * 60}ms`);
        io.observe(el);
      });
    }, 60);
    return () => { clearTimeout(t); io.disconnect(); };
  }, [route, data]);

  useEffect(() => {
    Promise.all([loadRegions(), loadCells4(), loadSky()])
      .then(([r, cells4, sky]) => setData({ ...r, cells4, sky }))
      .catch((e) => setError(e.message));
  }, []);

  // first visit lands on the home page; a tour link opens its page directly
  useEffect(() => {
    if (window.location.pathname === "/" && new URLSearchParams(window.location.search).get("tour") === "1") {
      navigate(TOUR[0].route + "?tour=1", { query: false, replace: true });
    }
  }, []);

  if (!data && !error) {
    return (
      <>
        <Nav route={route} />
        <main className="page"><div className="skeleton">Loading the fire record…</div></main>
      </>
    );
  }
  if (error) {
    return (
      <>
        <Nav route={route} />
        <main className="page"><div className="error">Could not load the data: {error}</div></main>
      </>
    );
  }
  const nCountries = data.regions.filter((r) => r.kind === "country").length;

  return (
    <ExplorerProvider data={data}>
      <a className="skip-link" href="#main" onClick={(e) => { e.preventDefault(); const m = document.querySelector("main"); m?.setAttribute("tabindex", "-1"); m?.focus(); }}>Skip to content</a>
      <Nav key={lang} route={route} />
      <div className="progress" aria-hidden="true" />
      {route !== "/" && <div className="page-bg" aria-hidden="true" />}
      {route !== "/" && <div className="si-mark fixed" role="note">SI-generated image (ChatGPT)</div>}
      <Fragment key={`${palette}-${lang}`}>{route === "/" ? <Home nCountries={nCountries} /> : <RoutedPage route={route} />}</Fragment>
      <SiteFooter palette={palette} onPalette={choosePalette} lang={lang} onLang={chooseLang} />
      <TourMount />
      <Toast />
    </ExplorerProvider>
  );
}
