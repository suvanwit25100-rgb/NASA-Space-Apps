import { useEffect, useState } from "react";

const base = import.meta.env.BASE_URL;
const pct = (v) => `${(v * 100).toFixed(0)}%`;

const NAMES = {
  world: "World",
  "punjab-haryana": "Punjab & Haryana",
  "indo-gangetic": "Indo-Gangetic Plain",
  "central-india": "Central India forests",
  northeast: "Northeast India",
  peninsular: "Peninsular India",
  "amazon-arc": "Amazon arc",
  "southern-africa-savanna": "Southern African savanna",
  "sahel-savanna": "West African savanna",
  "northern-australia": "Northern Australia",
  "southeast-australia": "Southeast Australia",
  california: "California",
  "boreal-canada": "Boreal Canada",
  siberia: "Siberian boreal forest",
  "maritime-sea": "Sumatra & Kalimantan",
  "mainland-sea": "Mainland Southeast Asia",
  mediterranean: "Mediterranean Europe",
};

// Leave-one-year-out test of the calibration, produced by pipeline/holdout_test.py.
export default function Holdout() {
  const [d, setD] = useState(null);
  const [link, setLink] = useState("aquaToViirs");
  useEffect(() => {
    fetch(`${base}data/holdout.json`).then((r) => (r.ok ? r.json() : null)).then(setD).catch(() => {});
  }, []);
  if (!d) return null;
  const rows = Object.entries(d).map(([id, v]) => ({ id, s: v[link] })).filter((r) => r.s);
  const w = d.world?.[link];
  const beats = rows.filter((r) => r.s.medAbsTotalErr < r.s.medAbsNaiveTotalErr).length;
  const worst = rows.reduce((a, b) => (b.s.medAbsTotalErr > (a?.s.medAbsTotalErr ?? -1) ? b : a), null);
  const lowCov = rows.filter((r) => r.s.bandCoverage < 0.6).length;
  return (
    <section className="panel" data-tour="holdout">
      <h2>Tested on years it never saw</h2>
      <p className="lead-text">
        A calibration can fit its own data and still fail on new data. So each year was held out in turn: the ratio was learned from every other overlap year, applied to the
        held-out year's older-sensor counts, and the prediction was compared with what the newer sensor actually recorded that year.
        {w && (
          <> For the world, the predicted annual total was off by a median of <b>{pct(w.medAbsTotalErr)}</b> (against <b>{pct(w.medAbsNaiveTotalErr)}</b> for a single yearly ratio), and the monthly shape correlated at <b>r = {w.meanMonthlyR.toFixed(2)}</b>.</>
        )}
      </p>
      <div className="seg" role="group" aria-label="Which link of the calibration">
        <button aria-pressed={link === "aquaToViirs"} onClick={() => setLink("aquaToViirs")}>Aqua → VIIRS (2013–2025)</button>
        <button aria-pressed={link === "terraToAqua"} onClick={() => setLink("terraToAqua")}>Terra → Aqua (2003–2011)</button>
      </div>
      <div className="scroll-x" style={{ marginTop: 14 }}>
        <table className="prov">
          <thead>
            <tr>
              <th>Area</th>
              <th>Annual total error</th>
              <th>Single-ratio baseline</th>
              <th>Monthly r</th>
              <th>Inside the band</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ id, s }) => (
              <tr key={id}>
                <td>{NAMES[id] || id}</td>
                <td className="num">±{pct(s.medAbsTotalErr)}</td>
                <td className="num">±{pct(s.medAbsNaiveTotalErr)}</td>
                <td className="num">{s.meanMonthlyR.toFixed(2)}</td>
                <td className="num">{pct(s.bandCoverage)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="lead-text">
        The seasonal ratio gave a smaller annual-total error than a single yearly ratio in <b>{beats} of {rows.length}</b> areas. The largest miss is{" "}
        <b>{NAMES[worst?.id] || worst?.id}</b> at ±{pct(worst?.s.medAbsTotalErr ?? 0)}.
        {lowCov > 0 && <> In {lowCov} area{lowCov > 1 ? "s" : ""} the bands were a little too narrow (under 60% of months inside), so treat the calibration range as a minimum, not a guarantee.</>}
      </p>
      <p className="hint">
        We also tried a separate ratio for each biome inside an area (RESOLVE Ecoregions 2017, 8 groups). On the same held-out years it was worse than one ratio per area in 11 of 15 comparable areas for Aqua to VIIRS, because splitting the data makes each ratio noisier, so the app keeps one ratio per area.
      </p>
      <p className="hint">
        Annual total error is the median absolute miss over the held-out years. "Inside the band" is how often a month's true value fell within the one-standard-deviation range the app draws around calibrated years; about 68% would mean the bands are honest. The 2000 to 2011 estimates rest on both links in this chain.
      </p>
    </section>
  );
}
