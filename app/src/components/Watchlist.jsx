import { useEffect, useState } from "react";
import { loadNrt, readWatch, writeWatch } from "../lib/nrt";
import { useExplorer } from "../state/Explorer";

// Areas the visitor chose to watch, with their newest-week status. Stored in this browser only: there is no server,
// so an alert shows when the site is opened, not as a push message.
export default function Watchlist() {
  const { byId, setAoiId } = useExplorer();
  const [watch, setWatch] = useState(readWatch);
  const [nrt, setNrt] = useState(null);
  useEffect(() => {
    loadNrt().then(setNrt);
    const on = () => setWatch(readWatch());
    window.addEventListener("burnlog:watch", on);
    return () => window.removeEventListener("burnlog:watch", on);
  }, []);
  if (!watch.length || !nrt) return null;
  const rows = watch.map((w) => ({ ...w, a: nrt.areas[w.id], name: byId[w.id]?.name })).filter((r) => r.a && r.name);
  if (!rows.length) return null;
  const hot = rows.filter((r) => r.a.z >= r.z);
  const remove = (id) => {
    const next = watch.filter((w) => w.id !== id);
    setWatch(next);
    writeWatch(next);
  };
  return (
    <section className={`panel watchlist ${hot.length ? "alert" : ""}`} aria-label="Watched areas" role={hot.length ? "alert" : undefined}>
      <h2>{hot.length ? `${hot.length} watched area${hot.length > 1 ? "s" : ""} above your threshold` : "Your watched areas"}</h2>
      <ul>
        {rows.map((r) => (
          <li key={r.id} className={r.a.z >= r.z ? "hot" : ""}>
            <button className="link-btn" onClick={() => setAoiId(r.id)}>{r.name}</button>
            <span>{r.a.z >= 0 ? "+" : "−"}{Math.abs(r.a.z).toFixed(1)} σ this week · alert at +{r.z.toFixed(1)} σ</span>
            <button className="chip-x" onClick={() => remove(r.id)} aria-label={`Stop watching ${r.name}`}>×</button>
          </li>
        ))}
      </ul>
      <p className="hint">Kept in this browser only. Status is for {nrt.start} to {nrt.end}.</p>
    </section>
  );
}
