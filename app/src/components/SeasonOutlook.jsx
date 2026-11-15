import { useMemo } from "react";
import { fmtDate, seasonOutlook } from "../lib/analytics";
import { useExplorer } from "../state/Explorer";

const DAY = 86400000;
const doyOf = (d) => Math.floor((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - Date.UTC(d.getFullYear(), 0, 1)) / DAY);

// "Typical season starts around 13 Oct, in about 150 days", with this year's start so far compared with usual.
export default function SeasonOutlook() {
  const { model, aoi, year, maxYear } = useExplorer();
  const out = useMemo(() => (model ? seasonOutlook(model) : null), [model]);
  if (!out) return null;
  const today = new Date();
  const doy = doyOf(today);
  const yr = today.getFullYear();
  const MON = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const nameOf = (s) => `Season peaking in ${MON[new Date(Date.UTC(2001, 0, 1 + Math.round(s.peak))).getUTCMonth()]}`;
  if (out.yearRound) {
    return (
      <section className="panel outlook" aria-label="When the season usually starts">
        <h2>When does the season start?</h2>
        <p className="hint"><em>{aoi.name}</em> burns through most of the year, so there is no single start date to count down to. Activity usually peaks the week of <b>{fmtDate(2001, out.seasons[0].peak)}</b>.</p>
      </section>
    );
  }
  const rows = out.seasons.map((s, i) => {
    const days = ((s.start - doy + 365) % 365);
    const inside = doy >= s.start && doy <= s.end;
    const status = days === 0 ? "starts about today" : `starts in about ${days} day${days === 1 ? "" : "s"}`;
    // this year's season (current calendar year), if the latest data year is already past it
    const cur = year === yr || year === maxYear ? (model.seasons[year] || []).find((x) => Math.abs(x.peak - s.peak) <= 60) : null;
    return { s, i, status, inside, days, cur };
  });
  const soonest = [...rows].sort((a, b) => (a.inside ? -1 : b.inside ? 1 : a.days - b.days))[0];
  return (
    <section className="panel outlook" data-tour="outlook" aria-label="When the season usually starts">
      <div className="panel-top">
        <div>
          <h2>When does the season start?</h2>
          <p className="hint">From {out.seasons[0].years} years of record. The range is the middle half of those years.</p>
        </div>
      </div>
      <div className="outlook-grid">
        {rows.map(({ s, i, status, inside, cur }) => (
          <article key={i} className={`outlook-card ${soonest.i === i ? "next" : ""}`}>
            <span className="caps">{nameOf(s)}{soonest.i === i ? (inside ? " · happening now" : " · next up") : ""}</span>
            <b className="num">{fmtDate(2001, s.start)}</b>
            <small>typically starts · usually {fmtDate(2001, s.startLo)} to {fmtDate(2001, s.startHi)}</small>
            <div className="bar" aria-hidden="true">
              <i style={{ left: `${(s.start / 365) * 100}%`, width: `${((s.end - s.start) / 365) * 100}%` }} />
              <u style={{ left: `${(doy / 365) * 100}%` }} title="Today" />
            </div>
            <p>
              Peaks the week of <b>{fmtDate(2001, s.peak)}</b>, ends about <b>{fmtDate(2001, s.end)}</b>.
              <span className={inside ? "now" : ""}> {inside ? "It is in its usual window now." : `It ${status}.`}</span>
              {cur && year === yr ? ` This year it started ${Math.abs(cur.start - s.start) <= 2 ? "right on time" : `${Math.abs(Math.round(cur.start - s.start))} days ${cur.start > s.start ? "late" : "early"}`}.` : ""}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
