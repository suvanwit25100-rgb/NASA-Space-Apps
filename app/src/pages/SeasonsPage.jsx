import AreaBar from "../components/AreaBar";
import BurnedOverlay from "../components/BurnedOverlay";
import Climatology from "../components/Climatology";
import CriticalPeriods from "../components/CriticalPeriods";
import Loading from "../components/Loading";
import { ChapterNav, PageHead } from "../components/PageHead";
import Replays from "../components/Replays";
import { KpiRow, StoryLead } from "../components/Story";
import TimeOfDay from "../components/TimeOfDay";
import Trend from "../components/Trend";
import Verdict from "../components/Verdict";
import { useExplorer } from "../state/Explorer";

export default function SeasonsPage() {
  const e = useExplorer();
  return (
    <main className="page">
      <PageHead path="/seasons" />
      <AreaBar />
      <Loading>
        <StoryLead />
        <KpiRow />
        <Verdict />
        <div className="grid-2">
          <section className="panel" data-tour="climatology">
            <h2>Climatology and {e.year}</h2>
            <p className="hint">The typical year, and where {e.year} sat against it. Shaded bands are {e.year}'s fire seasons.</p>
            {e.model && <Climatology model={e.model} year={e.year} />}
          </section>
          <section className="panel">
            <h2>Fire seasons, every year</h2>
            <p className="hint">A season is a stretch where activity stays above about 15% of that year's peak. Regions with two seasons show two bars; watch them drift over the years.</p>
            {e.model && <CriticalPeriods model={e.model} year={e.year} onSelect={e.select} />}
          </section>
        </div>
        <section className="panel" data-tour="trend">
          <h2>Has the season moved?</h2>
          <p className="hint">Start and end of the main fire season in every year, with a straight-line trend.</p>
          {e.model && <Trend model={e.model} />}
        </section>
        <section className="panel" data-tour="burned">
          <h2>Checked against burned area</h2>
          <p className="hint">The same seasonal shape from independent burned-area data, where we have it.</p>
          <BurnedOverlay />
        </section>
        <section className="panel" data-tour="timeofday">
          <h2>Morning or afternoon?</h2>
          <p className="hint">When in the day fires are caught: a time-of-day signal from the two MODIS satellites' different overpass times.</p>
          <TimeOfDay />
        </section>
      </Loading>
      <Replays />
      <ChapterNav path="/seasons" />
    </main>
  );
}
