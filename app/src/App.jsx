import { useEffect, useState } from "react";
import Nav from "./components/Nav";
import Tour from "./components/Tour";
import { loadCells4, loadRegions, loadSky } from "./lib/data";
import { navigate, useRoute } from "./lib/router";
import { TOUR } from "./lib/tour";
import AboutPage from "./pages/AboutPage";
import CalendarPage from "./pages/CalendarPage";
import ComparePage from "./pages/ComparePage";
import Home from "./pages/Home";
import MapPage from "./pages/MapPage";
import MethodPage from "./pages/MethodPage";
import SeasonsPage from "./pages/SeasonsPage";
import { ExplorerProvider, useExplorer } from "./state/Explorer";

function SiteFooter() {
  return (
    <footer className="footer">
      <p>Fire detections: NASA FIRMS (MODIS, VIIRS). Validation: NASA MCD64A1 and GFED4.1s. Basemap: © OpenStreetMap contributors © CARTO.</p>
      <p>Global Burn Log is a hackathon project; do not use it for operational emergency decisions.</p>
    </footer>
  );
}

function RoutedPage({ route }) {
  switch (route) {
    case "/calendar": return <CalendarPage />;
    case "/seasons": return <SeasonsPage />;
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
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
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
      <Nav route={route} />
      {route !== "/" && <div className="page-bg" aria-hidden="true" />}
      {route === "/" ? <Home nCountries={nCountries} /> : <RoutedPage route={route} />}
      <SiteFooter />
      <TourMount />
      <Toast />
    </ExplorerProvider>
  );
}
