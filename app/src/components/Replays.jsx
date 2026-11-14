import { useExplorer } from "../state/Explorer";

// Well-known fire events: jump to the area and year, then the verdict card says how unusual it was in this record.
export const REPLAYS = [
  { id: "australia", label: "Australia 2019–20", aoi: "southeast-australia", year: 2019, note: "Black Summer in the southeast" },
  { id: "canada", label: "Canada 2023", aoi: "boreal-canada", year: 2023, note: "A record boreal season" },
  { id: "amazon", label: "Amazon 2019", aoi: "amazon-arc", year: 2019, note: "The August fires" },
  { id: "indonesia", label: "Indonesia 2015", aoi: "maritime-sea", year: 2015, note: "El Niño peat fires" },
  { id: "california", label: "California 2020", aoi: "california", year: 2020, note: "The August complex fires" },
  { id: "punjab", label: "Punjab stubble burning", aoi: "punjab-haryana", year: 2025, note: "Autumn paddy residue" },
];

export default function Replays() {
  const { aoiId, year, setAoiId, select, setMode } = useExplorer();
  return (
    <section className="panel replays" aria-label="Replay a known fire event">
      <div className="panel-top">
        <div>
          <h2>Replay a known event</h2>
          <p className="hint">Jump to an event you may remember and see how unusual it looks in the harmonised record.</p>
        </div>
      </div>
      <div className="pill-row">
        {REPLAYS.map((r) => (
          <button
            key={r.id}
            className="chip"
            title={r.note}
            aria-pressed={aoiId === r.aoi && year === r.year}
            onClick={() => {
              setAoiId(r.aoi);
              select(r.year, null);
              setMode("activity");
            }}
          >
            {r.label}
          </button>
        ))}
      </div>
    </section>
  );
}
