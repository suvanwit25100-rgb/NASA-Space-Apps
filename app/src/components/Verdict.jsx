import { fmtDate } from "../lib/analytics";
import { exportReportPng } from "../lib/exporters";
import { useExplorer } from "../state/Explorer";
import { yearUncertainty, yearVerdict } from "../lib/analytics";

const sig = (z) => `${z >= 0 ? "+" : "−"}${Math.abs(z).toFixed(1)}`;
const ord = (n) => `${n}${["th", "st", "nd", "rd"][(n % 100 >> 3) ^ 1 && n % 10 < 4 ? n % 10 : 0]}`;

export default function Verdict() {
  const { model, year, aoi, sum } = useExplorer();
  const v = model ? yearVerdict(model, year) : null;
  if (!v) return null;
  const u = yearUncertainty(model, year);
  const up = v.rank <= Math.ceil(v.n / 2);
  const k = up ? v.rank : v.n - v.rank + 1;
  const busiest = `${k === 1 ? "" : `${ord(k)} `}${up ? "busiest" : "quietest"}`;
  return (
    <section className={`panel verdict ${v.level}`} data-tour="verdict" aria-label={`Is ${year} unusual?`}>
      <div className="verdict-badge">
        <span className="caps">Is {year} unusual?</span>
        <b>{v.label}</b>
      </div>
      <p>
        In <em>{aoi.name}</em>, {year} was the <em>{busiest}</em> of {v.n} years ({sig(v.z)} standard deviations from the typical year).
        {v.peak && (
          <> Its most unusual stretch was the week of <em>{fmtDate(year, v.peak.doy - 3)}</em>, running {Math.abs(v.peak.z).toFixed(1)} standard deviations {v.peak.z >= 0 ? "above" : "below"} the same week in other years.</>
        )}
        {u && (
          <span className="hint">
            {" "}
            {u.measured ? "This year is measured directly by VIIRS, with no calibration range." : `This year is a calibrated MODIS estimate with a range of about ±${Math.round(u.pct)}% on the daily value, so read the size of the difference loosely.`}
          </span>
        )}
      </p>
      <button className="btn-sm verdict-report" onClick={() => exportReportPng(model, year, sum, v, u)} title="Download a one-page picture report for this area and year">Download report</button>
    </section>
  );
}
