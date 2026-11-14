import { fmtDate } from "../lib/analytics";
import { useExplorer } from "../state/Explorer";

const signed = (n, digits = 0) => `${n >= 0 ? "+" : "−"}${Math.abs(n).toFixed(digits)}`;

function dayDelta(d) {
  const r = Math.round(d);
  if (r === 0) return "on the median date";
  return `${Math.abs(r)} day${Math.abs(r) === 1 ? "" : "s"} ${r > 0 ? "later" : "earlier"} than the median year`;
}

export function StoryLead() {
  const { sum, aoi, year, yearRound } = useExplorer();
  if (!sum) return <div className="panel lead">Not enough fire detections in this area to describe a season.</div>;
  return (
    <div className="panel lead">
      {yearRound ? (
        <>
          In <em>{aoi.name}</em>, fire burns <em>year-round</em> in <em>{year}</em>, with activity peaking the week of{" "}
          <em>{fmtDate(year, sum.main.peakWeek)}</em>.
        </>
      ) : (
        <>
          In <em>{aoi.name}</em>, the main burning season of <em>{year}</em> ran from <em>{fmtDate(year, sum.main.start)}</em> to{" "}
          <em>{fmtDate(year, sum.main.end)}</em>, peaking the week of <em>{fmtDate(year, sum.main.peakWeek)}</em> and holding{" "}
          <em>{Math.round(sum.main.share * 100)}%</em> of the year's activity.
          {sum.others.length > 0 && (
            <> A second season ran {fmtDate(year, sum.others[0].start)} to {fmtDate(year, sum.others[0].end)} ({Math.round(sum.others[0].share * 100)}%).</>
          )}
        </>
      )}{" "}
      Overall activity was <em>{signed(sum.vsMedian * 100)}%</em> versus the median year.
    </div>
  );
}

export function KpiRow() {
  const { sum, year, yearRound } = useExplorer();
  if (!sum) return null;
  return (
    <div className="kpis">
      <div className="panel kpi">
        <b className="num">{yearRound ? "Year-round" : fmtDate(year, sum.main.start)}</b>
        <span className="caps">{yearRound ? "Fire season" : "Main season starts"}</span>
        <small>{yearRound ? "activity never fully stops" : sum.medStart == null ? `ends ${fmtDate(year, sum.main.end)}` : dayDelta(sum.main.start - sum.medStart)}</small>
      </div>
      <div className="panel kpi">
        <b className="num">{fmtDate(year, sum.main.peakWeek)}</b>
        <span className="caps">Peak week begins</span>
        <small>{yearRound ? "the busiest seven days" : `season ends ${fmtDate(year, sum.main.end)}`}</small>
      </div>
      <div className="panel kpi">
        <b className="num">{Math.round(sum.total).toLocaleString()}</b>
        <span className="caps">Burning cell-days</span>
        <small className={sum.vsMedian >= 0 ? "up" : "down"}>
          {signed(sum.vsMedian * 100)}% vs median · #{sum.rankAbove} of {sum.nYears} years
        </small>
      </div>
    </div>
  );
}
