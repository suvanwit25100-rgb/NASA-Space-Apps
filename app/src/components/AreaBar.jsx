import { useExplorer } from "../state/Explorer";
import { t } from "../lib/i18n";

export default function AreaBar({ children }) {
  const e = useExplorer();
  const { aoiId, setAoiId, year, select, minYear, maxYear, world, featured, countries, custom, customModel, aoi, search, onSearch, removeCustom } = e;
  return (
    <section className="panel area-bar" data-tour="area" aria-label="Choose an area and a year">
      <div className="area-row">
        <label className="field grow">
          <span className="label caps">{t("Area")}</span>
          <select value={aoiId} aria-label="Region or country" onChange={(ev) => (ev.target.value !== "custom" || custom?.status === "ready") && setAoiId(ev.target.value)}>
            {custom?.status === "ready" && <option value="custom">{custom.name}</option>}
            <optgroup label="Regions">{[world, ...featured].filter(Boolean).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</optgroup>
            <optgroup label="Countries">{countries.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</optgroup>
          </select>
        </label>
        <label className="field">
          <span className="label caps">{t("Search a country")}</span>
          <input list="country-list" className="search" placeholder={t("Type a country…")} value={search} onChange={(ev) => onSearch(ev.target.value)} aria-label="Search for a country" />
          <datalist id="country-list">{countries.map((c) => <option key={c.id} value={c.name} />)}</datalist>
        </label>
        <div className="field year-field">
          <span className="label caps">{t("Year")}</span>
          <div className="year-row">
            <button className="step" aria-label="Previous year" disabled={year <= minYear} onClick={() => select(year - 1)}>‹</button>
            <input type="range" min={minYear} max={maxYear} value={year} onChange={(ev) => select(Number(ev.target.value))} aria-label="Year" />
            <button className="step" aria-label="Next year" disabled={year >= maxYear} onClick={() => select(year + 1)}>›</button>
            <span className="year-big num">{year}</span>
          </div>
        </div>
      </div>

      <div className="pill-row" role="group" aria-label="Featured regions">
        {custom && (
          <span className="chip-group">
            <button className="chip" aria-pressed={aoiId === "custom"} onClick={() => custom.status === "ready" && setAoiId("custom")}>
              {custom.status === "loading" ? "Calibrating…" : custom.name}
            </button>
            <button className="chip-x" aria-label="Remove custom area" onClick={removeCustom}>×</button>
          </span>
        )}
        {[world, ...featured].filter(Boolean).map((a) => (
          <button key={a.id} className="chip" aria-pressed={a.id === aoiId} onClick={() => setAoiId(a.id)}>{a.name}</button>
        ))}
      </div>

      {children}
      {aoi?.lowData && <p className="warn">Few detections here, so the calibration is noisy. Treat estimates before 2012 with caution.</p>}
      <p className="hint">
        {aoi ? `${aoi.cells.toLocaleString()} map cells with fire detections` : "Loading"} · {year >= 2012 ? "measured directly by VIIRS (375 m)" : "estimated from MODIS and calibrated to VIIRS"} · {countries.length} countries with data
      </p>
    </section>
  );
}
