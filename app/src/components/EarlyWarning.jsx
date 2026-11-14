import { useEffect, useState } from "react";
import { useExplorer } from "../state/Explorer";

import { loadNrt, readWatch, writeWatch } from "../lib/nrt";

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const fmt = (iso) => {
  const d = new Date(`${iso}T00:00:00Z`);
  return `${d.getUTCDate()} ${MON[d.getUTCMonth()]}`;
};

// The most recent seven days of near-real-time VIIRS against the same calendar week in 2013 to 2025.
export default function EarlyWarning() {
  const { aoiId, aoi, byId } = useExplorer();
  const [nrt, setNrt] = useState(null);
  useEffect(() => {
    loadNrt().then(setNrt);
  }, []);
  const [watch, setWatch] = useState(readWatch);
  const [z, setZ] = useState(1.5);
  const a = nrt?.areas?.[aoiId];
  if (!a) return null;
  const watched = watch.find((w) => w.id === aoiId);
  const toggle = () => {
    const next = watched ? watch.filter((w) => w.id !== aoiId) : [...watch.filter((w) => w.id !== aoiId), { id: aoiId, z }];
    setWatch(next);
    writeWatch(next);
    window.dispatchEvent(new Event("burnlog:watch"));
  };
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
        <span className="hint"> {nrt.bias ? `Across the world this feed currently reads about ${Math.round((nrt.bias - 1) * 100)}% above earlier years for the same week (it cannot drop gas flares the way the reprocessed archive does), so small excesses are not reliable. ` : ""}{nrt.live ? "Refreshed daily from the repository." : "Bundled copy; the daily refresh was not reachable."} Near-real-time data arrives about 12 days behind and is later replaced by reprocessed data, so treat this as an early signal, not a final count.</span>
      </p>
      <div className="watch-controls">
        <label className="hint">
          Alert me above{" "}
          <select value={watched ? watched.z : z} disabled={!!watched} onChange={(e) => setZ(Number(e.target.value))} aria-label="Alert threshold">
            <option value={1}>+1.0 σ (elevated)</option>
            <option value={1.5}>+1.5 σ (well above normal)</option>
            <option value={2}>+2.0 σ (extreme)</option>
          </select>
        </label>
        <button className="btn-sm" onClick={toggle} aria-pressed={!!watched}>{watched ? "Stop watching" : "Watch this area"}</button>
      </div>
      {["world", "featured"].includes(byId?.[aoiId]?.kind) ? (
        <details className="push">
          <summary>Get push alerts on your phone</summary>
          <p className="hint">
            Install the free <a href="https://ntfy.sh" target="_blank" rel="noreferrer">ntfy</a> app (or open it in a browser) and subscribe to the topic{" "}
            <code>globalburnlog-{aoiId}</code>. You get one message when this area rises past +2σ or +3σ and at least +50% on the same week of earlier years, checked daily. No account, and we never see who subscribes.{" "}
            <a href={`https://ntfy.sh/globalburnlog-${aoiId}`} target="_blank" rel="noreferrer">Open the topic</a>
          </p>
        </details>
      ) : (
        <p className="hint push">Push alerts are offered for the world and the featured regions. Use the watchlist above for this area.</p>
      )}
    </section>
  );
}
