import { useEffect, useState } from "react";
import { loadAois, loadCellMonths, loadCells } from "./lib/data";
import Nav from "./components/Nav";
import Hero from "./components/Hero";
import Explorer from "./components/Explorer";
import Method from "./components/Method";
import About from "./components/About";

export default function App() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    Promise.all([loadAois(), loadCells(), loadCellMonths()])
      .then(([a, cells, cm]) => setData({ ...a, cells, cm }))
      .catch((e) => setError(e.message));
  }, []);

  const stats = data && [
    { value: "25", label: "Years of record" },
    { value: "3", label: "Satellite sensors" },
    { value: data.cells.length.toLocaleString(), label: "Map cells (India)" },
  ];

  return (
    <>
      <Nav />
      <main>
        <Hero cells={data?.cells} cm={data?.cm} stats={stats} />
        {error && <div className="section"><div className="error">Could not load the data: {error}</div></div>}
        {!data && !error && <div className="section"><div className="skeleton">Loading fire record…</div></div>}
        {data && <Explorer aois={data.aois} meta={data.meta} cells={data.cells} cm={data.cm} />}
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
