import { useMemo } from "react";
import AreaBar from "../components/AreaBar";
import Compare from "../components/Compare";
import Loading from "../components/Loading";
import { ChapterNav, PageHead } from "../components/PageHead";
import { useExplorer } from "../state/Explorer";

export default function ComparePage() {
  const e = useExplorer();
  const { world, featured, countries, aoiId, cmpId, setCmpId, customModel } = e;
  const groups = useMemo(
    () => ({ regions: [world, ...featured].filter((r) => r && r.id !== aoiId), countries: countries.filter((r) => r.id !== aoiId) }),
    [world, featured, countries, aoiId],
  );
  const ideas = groups.regions.slice(0, 6);
  return (
    <main className="page">
      <PageHead path="/compare">Do two places burn at the same time of year? Pick a second area and set the two seasonal curves side by side.</PageHead>
      <AreaBar />
      <Loading>
        <section className="panel" data-tour="compare">
          <div className="panel-top">
            <div>
              <h2>{e.cmpModel ? `Compare regions in ${e.year}` : "Choose something to compare with"}</h2>
              <p className="hint">Each curve is scaled to its region's own typical peak, so the shape of the season is compared, not its size.</p>
            </div>
            <label className="field">
              <span className="sr">Compare with</span>
              <select value={cmpId} onChange={(ev) => setCmpId(ev.target.value)} aria-label="Compare with another area">
                <option value="">Compare with…</option>
                {customModel && aoiId !== "custom" && <option value="custom">{customModel.aoi.name}</option>}
                <optgroup label="Regions">{groups.regions.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</optgroup>
                <optgroup label="Countries">{groups.countries.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</optgroup>
              </select>
            </label>
          </div>
          {e.cmpModel && e.model ? (
            <Compare a={e.model} b={e.cmpModel} year={e.year} />
          ) : (
            <div className="empty">
              <p>Try one of these:</p>
              <div className="pill-row wrap">
                {ideas.map((r) => <button key={r.id} className="chip" onClick={() => setCmpId(r.id)}>{r.name}</button>)}
              </div>
            </div>
          )}
        </section>
      </Loading>
      <ChapterNav path="/compare" />
    </main>
  );
}
