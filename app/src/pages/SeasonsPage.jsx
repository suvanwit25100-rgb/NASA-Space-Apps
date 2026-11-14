import AreaBar from "../components/AreaBar";
import Climatology from "../components/Climatology";
import CriticalPeriods from "../components/CriticalPeriods";
import Loading from "../components/Loading";
import { ChapterNav, PageHead } from "../components/PageHead";
import { KpiRow, StoryLead } from "../components/Story";
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
      </Loading>
      <ChapterNav path="/seasons" />
    </main>
  );
}
