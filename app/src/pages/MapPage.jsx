import { lazy, Suspense } from "react";
import AreaBar from "../components/AreaBar";
import Loading from "../components/Loading";
import { ChapterNav, PageHead } from "../components/PageHead";
import { rectName, useExplorer } from "../state/Explorer";

const FireMap = lazy(() => import("../components/FireMap"));

export default function MapPage() {
  const e = useExplorer();
  return (
    <main className="page">
      <PageHead path="/map" />
      <AreaBar>
        <div className="actions">
          <button className="btn-sm" aria-pressed={e.drawing} onClick={e.toggleDrawing}>{e.drawing ? "Cancel drawing" : "Draw an area on the map"}</button>
          <button className="btn-sm" onClick={() => e.fileRef.current?.click()}>Upload a GeoJSON outline</button>
          <input ref={e.fileRef} type="file" accept=".geojson,.json,application/geo+json,application/json" hidden onChange={e.onFile} />
        </div>
      </AreaBar>
      <Loading>
        <section className="panel" data-tour="map">
          <div className="panel-top">
            <div>
              <h2>Where it burned</h2>
              <p className="hint">
                {e.coarse
                  ? "Cells with satellite-detected fire. Pick a month on the timeline, press play, or draw your own area with one finger."
                  : "Cells with satellite-detected fire. Pick a month on the timeline, press play to watch the year unfold, or draw your own area and see its calendar."}
              </p>
            </div>
          </div>
          <Suspense fallback={<div className="map-wrap"><div className="map-badge">Loading map…</div></div>}>
            <FireMap
              cells4={e.cells4}
              mapYear={e.mapYear}
              aoi={e.aoi}
              year={e.year}
              month={e.mapMonth}
              setMonth={e.setMapMonth}
              onToggleDraw={e.toggleDrawing}
              drawing={e.drawing}
              onDrawn={(bbox) => e.startCustom({ bbox, source: "rect", name: rectName(bbox) })}
            />
          </Suspense>
          <p className="map-note">
            Map cells come from whichever sensor was flying that month, so MODIS-era maps are sparser than VIIRS-era ones by design. The calendar and
            season charts are the harmonised, comparable view.
          </p>
        </section>
      </Loading>
      <ChapterNav path="/map" />
    </main>
  );
}
