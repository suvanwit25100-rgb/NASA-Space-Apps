import { GithubIcon } from "../components/Icons";
import { Link } from "../lib/router";

const REPO = "https://github.com/suvanwit25100-rgb/NASA-Space-Apps";
const FILES = [
  ["regions.json", "Index of every area: id, name, kind (world, featured, country), cell count, bounding box, and the data window.", "/data/regions.json"],
  ["series/<id>.json.gz", "One area's daily series: values (burning cell-days per day from 2000-01-01), lo and hi (calibration range), ratios. Use ids such as ind, bra, punjab-haryana, california.", "/data/series/punjab-haryana.json.gz"],
  ["map/<year>.bin.gz", "Binary map layer for one year: columns of uint32 cell index, uint8 month, uint8 burning days, for H3 resolution-4 cells.", "/data/map/2023.bin.gz"],
  ["map/cells4.bin.gz", "The H3 cell ids (uint64, sorted) that the map layers index into.", "/data/map/cells4.bin.gz"],
  ["nrt.json", "The newest seven days of near-real-time data against the same week in 2013 to 2025, per area. Refreshed daily.", "/data/nrt.json"],
  ["hours.json", "Detections by sensor, month and local solar hour, per area (sample years).", "/data/hours.json"],
  ["burned_area.json", "Seasonal profiles of independent burned-area data (GFED4.1s, NASA MCD64A1) used for the check.", "/data/burned_area.json"],
  ["holdout.json", "Results of the leave-one-year-out test of the calibration.", "/data/holdout.json"],
];
const PY = `import gzip, json, requests, numpy as np, pandas as pd

raw = requests.get("https://globalburnlog.earth/data/series/punjab-haryana.json.gz").content
d = json.loads(gzip.decompress(raw) if raw[:2] == b"\\x1f\\x8b" else raw)
s = pd.Series([np.nan if v is None else v for v in d["values"]],
              index=pd.date_range("2000-01-01", periods=len(d["values"])))
print(s.resample("MS").sum(min_count=28).tail())`;
const JS = `const res = await fetch("https://globalburnlog.earth/data/series/punjab-haryana.json.gz");
const text = await new Response(res.body.pipeThrough(new DecompressionStream("gzip"))).text();
const { values } = JSON.parse(text);   // daily, from 2000-01-01; null before 2000-11-01`;

export default function DataPage() {
  return (
    <main className="page">
      <header className="page-head">
        <span className="numeral" aria-hidden="true">+</span>
        <h1>Use the data</h1>
        <p>Everything on this site is plain files you can download. No key, no login, no rate limit beyond the CDN.</p>
      </header>
      <section className="panel">
        <h2>Open it in a notebook</h2>
        <p className="lead-text">
          A short notebook loads one area, plots its monthly series, scores a year against the others, draws the typical year with its range, and reads the
          latest week and a map layer. It runs against the live files.
        </p>
        <div className="cta-row">
          <a className="btn primary" href={`https://colab.research.google.com/github/${REPO.replace("https://github.com/", "")}/blob/main/notebooks/use_the_data.ipynb`} target="_blank" rel="noreferrer">Open in Google Colab</a>
          <a className="btn" href={`${REPO}/blob/main/notebooks/use_the_data.ipynb`} target="_blank" rel="noreferrer"><GithubIcon width="16" height="16" /> View the notebook</a>
        </div>
      </section>
      <section className="panel">
        <h2>The files</h2>
        <div className="scroll-x">
          <table className="prov">
            <thead><tr><th>File under /data/</th><th>What it holds</th><th /></tr></thead>
            <tbody>
              {FILES.map(([f, what, href]) => (
                <tr key={f}><td><code>{f}</code></td><td>{what}</td><td><a href={href} target="_blank" rel="noreferrer">Try it</a></td></tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="hint">
          Files ending in .gz are gzip. Some hosts and browsers decompress them for you, so check the first two bytes (0x1f 0x8b) before decompressing, as the examples do.
          The unit is a <em>burning cell-day</em>: an H3 resolution-5 cell with at least one MODIS detection that day, or at least two VIIRS detections. Years before 2012 are
          calibrated estimates with the lo and hi range; see the <Link to="/method">Method</Link> page.
        </p>
      </section>
      <div className="grid-2">
        <section className="panel">
          <h2>Python</h2>
          <pre className="code"><code>{PY}</code></pre>
        </section>
        <section className="panel">
          <h2>JavaScript</h2>
          <pre className="code"><code>{JS}</code></pre>
        </section>
      </div>
      <section className="panel">
        <h2>Credit and limits</h2>
        <p className="lead-text">
          Please credit NASA FIRMS (MODIS and VIIRS active fire) and the Global Burn Log. Cell-days show where and when fire was detected, not how much land burned, and the
          near-real-time file is an early signal that gets replaced. The whole pipeline that builds these files is in the <a href={REPO} target="_blank" rel="noreferrer">repository</a>.
        </p>
      </section>
    </main>
  );
}
