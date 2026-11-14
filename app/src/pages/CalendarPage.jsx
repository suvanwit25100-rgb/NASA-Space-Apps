import AreaBar from "../components/AreaBar";
import CalendarHeatmap from "../components/CalendarHeatmap";
import Loading from "../components/Loading";
import { ChapterNav, PageHead } from "../components/PageHead";
import Replays from "../components/Replays";
import { StoryLead } from "../components/Story";
import Verdict from "../components/Verdict";
import { exportCalendarPng, exportCsv } from "../lib/exporters";
import { useExplorer } from "../state/Explorer";

export default function CalendarPage() {
  const e = useExplorer();
  return (
    <main className="page">
      <PageHead path="/calendar" />
      <AreaBar />
      <Loading>
        <StoryLead />
        <Verdict />
        <section className="panel" data-tour="calendar">
          <div className="panel-top">
            <div>
              <h2>Burning activity calendar</h2>
              <p className="hint">
                {e.coarse
                  ? "One row per year, one column per day. Tap a day for the value, anomaly and confidence; tap a row to select that year."
                  : "One row per year, one column per day. Hover for the value, anomaly and confidence; click a row to select that year."}
              </p>
            </div>
            <div className="toolbar">
              <div className="seg" role="group" aria-label="Colour mode">
                <button aria-pressed={e.mode === "activity"} onClick={() => e.setMode("activity")}>Activity</button>
                <button aria-pressed={e.mode === "anomaly"} onClick={() => e.setMode("anomaly")}>Anomaly</button>
              </div>
              <div className="seg" role="group" aria-label="Share and export">
                <button onClick={e.share} title="Copy a link to this exact view">Copy link</button>
                <button onClick={() => e.model && exportCsv(e.model)} title="Download the daily series">CSV</button>
                <button onClick={() => e.model && exportCalendarPng(e.model, e.year, e.mode)} title="Download the calendar as an image">PNG</button>
              </div>
            </div>
          </div>
          {e.model && <CalendarHeatmap model={e.model} year={e.year} mode={e.mode} onSelect={e.select} />}
        </section>
      </Loading>
      <Replays />
      <ChapterNav path="/calendar" />
    </main>
  );
}
