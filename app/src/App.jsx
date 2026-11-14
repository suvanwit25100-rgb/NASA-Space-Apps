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

  useEffect(() => {
    Promise.all([loadRegions(), loadCells4(), loadSky()])
      .then(([r, cells4, sky]) => setData({ ...r, cells4, sky }))
      .catch((e) => setError(e.message));
  }, []);

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
        <Hero cells4={data?.cells4} sky={data?.sky} stats={stats} />
        {error && <div className="section"><div className="error">Could not load the data: {error}</div></div>}
        {!data && !error && <div className="section"><div className="skeleton">Loading fire record…</div></div>}
        {data && <Explorer regions={data.regions} meta={data.meta} cells4={data.cells4} />}
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
