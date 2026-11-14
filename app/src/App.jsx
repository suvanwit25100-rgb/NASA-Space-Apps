import { useEffect, useState } from "react";
import { loadCells4, loadRegions, loadSky } from "./lib/data";
import Nav from "./components/Nav";
import Hero from "./components/Hero";
import Explorer from "./components/Explorer";
import Method from "./components/Method";
import About from "./components/About";

export default function App() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [tourKey, setTourKey] = useState(0);

  useEffect(() => {
    Promise.all([loadRegions(), loadCells4(), loadSky()])
      .then(([r, cells4, sky]) => setData({ ...r, cells4, sky }))
      .catch((e) => setError(e.message));
  }, []);

  // section links like /#method point at content that renders after the data loads, so scroll once it exists
  useEffect(() => {
    if (!data || !window.location.hash) return;
    const el = document.querySelector(window.location.hash);
    if (el) requestAnimationFrame(() => el.scrollIntoView({ behavior: "instant", block: "start" }));
  }, [data]);

  const nCountries = data ? data.regions.filter((r) => r.kind === "country").length : 0;
  const stats = data && [
    { value: "25", label: "Years of record" },
    { value: "3", label: "Satellite sensors" },
    { value: String(nCountries), label: "Countries" },
  ];

  return (
    <>
      <Nav />
      <main>
        <Hero cells4={data?.cells4} sky={data?.sky} stats={stats} onTour={() => setTourKey((k) => k + 1)} />
        {error && <div className="section"><div className="error">Could not load the data: {error}</div></div>}
        {!data && !error && <div className="section"><div className="skeleton">Loading fire record…</div></div>}
        {data && <Explorer regions={data.regions} meta={data.meta} cells4={data.cells4} tourKey={tourKey} />}
        <Method />
        <About />
      </main>
      <footer className="footer">
        <p>Fire detections: NASA FIRMS (MODIS, VIIRS). Validation: NASA MCD64A1 and GFED4.1s. Basemap: © OpenStreetMap contributors © CARTO.</p>
        <p>Global Burn Log is a hackathon project; do not use it for operational emergency decisions.</p>
      </footer>
    </>
  );
}
