import { useEffect, useState } from "react";
import { useExplorer } from "../state/Explorer";

const base = import.meta.env.BASE_URL;
let cache = null;
const load = () => (cache ||= fetch(`${base}data/nrt.json`).then((r) => (r.ok ? r.json() : null)).catch(() => null));

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const fmt = (iso) => {
  const d = new Date(`${iso}T00:00:00Z`);
  return `${d.getUTCDate()} ${MON[d.getUTCMonth()]}`;
};

// The most recent seven days of near-real-time VIIRS against the same calendar week in 2013 to 2025.
export default function EarlyWarning() {
  const { aoiId, aoi } = useExplorer();
  const [nrt, setNrt] = useState(null);
  useEffect(() => {
    load().then(setNrt);
  }, []);
  const a = nrt?.areas?.[aoiId];
  if (!a) return null;
  const level = a.z >= 1.5 ? "high" : a.z <= -1.5 ? "low" : "normal";
  const word = { high: "Running well above normal", low: "Running well below normal", normal: "Within the normal range" }[level];
  const pct = a.typical > 0 ? Math.round((a.n / a.typical - 1) * 100) : 0;
  return (
    <section className={`panel early ${level}`} aria-label="Latest week">
      <div className="verdict-badge">
        <span className="caps">Latest week · {fmt(nrt.start)} to {fmt(nrt.end)}</span>
        <b>{word}</b>
      </div>
      <p>
        In <em>{aoi?.name || "this area"}</em> there were <em>{a.n.toLocaleString()}</em> burning cell-days in the newest seven days of near-real-time data, against about {Math.round(a.typical).toLocaleString()} in the same week of
        2013 to 2025 ({pct >= 0 ? "+" : "−"}{Math.abs(pct)}%, {a.z >= 0 ? "+" : "−"}{Math.abs(a.z).toFixed(1)} standard deviations, higher than {Math.round(a.pct)}% of those years).
        <span className="hint"> Near-real-time data arrives about 12 days behind and is later replaced by reprocessed data, so treat this as an early signal, not a final count.</span>
      </p>
    </section>
  );
}
