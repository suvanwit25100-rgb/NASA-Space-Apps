import { useEffect, useMemo, useState } from "react";
import { loadNrt } from "../lib/nrt";
import { navigate } from "../lib/router";
import { useExplorer } from "../state/Explorer";
import { Reveal } from "./Reveal";
import { t } from "../lib/i18n";

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const fmt = (iso) => {
  const d = new Date(`${iso}T00:00:00Z`);
  return `${d.getUTCDate()} ${MON[d.getUTCMonth()]}`;
};

function Row({ r, onOpen }) {
  const z = r.a.z;
  const w = Math.min(Math.abs(z), 4) / 4;
  const pct = r.a.typical > 0 ? Math.round((r.a.n / r.a.typical - 1) * 100) : 0;
  return (
    <button className={`hot-row ${z >= 1.5 ? "hot" : z <= -1.5 ? "cold" : ""}`} onClick={() => onOpen(r.id)}>
      <span className="name">{r.name}</span>
      <span className="track" aria-hidden="true"><i className={z >= 0 ? "up" : "down"} style={{ width: `${w * 50}%`, [z >= 0 ? "left" : "right"]: "50%" }} /><u /></span>
      <span className="val num">{pct >= 0 ? "+" : "−"}{Math.abs(pct)}%<small>{z >= 0 ? "+" : "−"}{Math.abs(z).toFixed(1)} σ</small></span>
    </button>
  );
}

// Where fire activity is furthest from normal right now: newest-week near-real-time against the same week in 2013 to 2025.
export default function HotBoard() {
  const { byId, world, featured, setAoiId } = useExplorer();
  const [nrt, setNrt] = useState(null);
  useEffect(() => {
    loadNrt().then(setNrt);
  }, []);
  const rows = useMemo(() => {
    if (!nrt) return null;
    const pick = (list) => list.map((x) => ({ id: x.id, name: x.name, a: nrt.areas[x.id] })).filter((r) => r.a && r.a.typical >= 100);
    const regions = pick([world, ...featured].filter(Boolean)).sort((a, b) => b.a.z - a.a.z);
    const countries = pick(Object.values(byId).filter((r) => r.kind === "country")).filter((r) => r.a.typical >= 1000).sort((a, b) => b.a.z - a.a.z);
    return { regions, hot: countries.slice(0, 5), cold: countries.slice(-5).reverse() };
  }, [nrt, byId, world, featured]);
  if (!rows) return null;
  const open = (id) => {
    setAoiId(id);
    navigate("/seasons");
  };
  return (
    <section className="front-section" aria-label="Hottest this week">
      <Reveal as="p" className="eyebrow caps">{t("Right now")}</Reveal>
      <Reveal as="h2" className="front-h" delay={80}>{t("Furthest from normal")} <em>{t("this week.")}</em></Reveal>
      <Reveal as="p" className="front-lead" delay={140}>
        Burning cell-days in the newest seven days of near-real-time data ({fmt(nrt.start)} to {fmt(nrt.end)}, about 12 days behind), against the same week in 2013 to 2025. Tap a place to open its seasons.
      </Reveal>
      <div className="hot-grid">
        <Reveal className="panel">
          <h3 className="sub-h">World and featured regions</h3>
          <div className="hot-list">{rows.regions.map((r) => <Row key={r.id} r={r} onOpen={open} />)}</div>
        </Reveal>
        <Reveal className="panel" delay={120}>
          <h3 className="sub-h">Countries running highest</h3>
          <div className="hot-list">{rows.hot.map((r) => <Row key={r.id} r={r} onOpen={open} />)}</div>
          <h3 className="sub-h">Countries running lowest</h3>
          <div className="hot-list">{rows.cold.map((r) => <Row key={r.id} r={r} onOpen={open} />)}</div>
          <p className="hint">Countries with at least 1,000 typical cell-days a week. Near-real-time data is early and gets replaced, so small differences are not meaningful.</p>
        </Reveal>
      </div>
    </section>
  );
}
