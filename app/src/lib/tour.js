import { fmtDate, MONTHS, monthOfDoy, yearSummary } from "./analytics";

const HOME = "punjab-haryana";
const COMPARE = "southern-africa-savanna";

const median = (a) => {
  const s = [...a].sort((x, y) => x - y);
  return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : NaN;
};

// the autumn (paddy-stubble) season: the detected season whose peak falls between mid-September and mid-December
export function autumnSeason(model, y) {
  return (model.seasons[y] || []).find((s) => s.peak >= 255 && s.peak <= 350) || null;
}

function autumnStats(model, year) {
  const cur = autumnSeason(model, year);
  if (!cur) return null;
  const others = model.completeYears.filter((y) => y !== year).map((y) => autumnSeason(model, y)).filter(Boolean);
  const totals = model.completeYears.map((y) => autumnSeason(model, y)?.total ?? 0);
  const medTotal = median(others.map((s) => s.total));
  return {
    cur,
    medStart: median(others.map((s) => s.start)),
    pct: (cur.total / medTotal - 1) * 100,
    rank: totals.filter((t) => t > cur.total).length + 1,
    n: model.completeYears.length,
  };
}

const signed = (n) => `${n >= 0 ? "+" : "−"}${Math.abs(n).toFixed(0)}%`;
const days = (d) => {
  const r = Math.round(d);
  return r === 0 ? "right on the typical date" : `${Math.abs(r)} day${Math.abs(r) === 1 ? "" : "s"} ${r > 0 ? "later" : "earlier"} than usual`;
};

// Each step: where to look (target), what state to put the explorer in (apply), and text computed from the data (body)
export const TOUR = [
  {
    id: "calendar",
    title: "A 25-year fire calendar",
    target: "calendar",
    apply: ({ maxYear }) => ({ aoi: HOME, year: maxYear, mode: "activity", month: null, cmp: "" }),
    body: () =>
      "Every row is a year and every column is a day. In Punjab and Haryana the same two bright bands come back each year: one in April and May, and one in October and November, the well-known season of burning crop residue.",
  },
  {
    id: "autumn",
    title: "When does the autumn burn start?",
    target: "climatology",
    apply: ({ maxYear }) => ({ aoi: HOME, year: maxYear, mode: "activity", month: null, cmp: "" }),
    body: ({ models, year }) => {
      const m = models[HOME];
      const a = m && autumnStats(m, year);
      if (!a) return "The orange line is this year; the blue line is the typical year, with its normal range shaded.";
      return `In ${year} the autumn burn began around ${fmtDate(year, a.cur.start)}, peaked the week of ${fmtDate(year, a.cur.peakWeek)} and was over by ${fmtDate(year, a.cur.end)}. That start is ${days(a.cur.start - a.medStart)}. The orange line is ${year}; the blue line is the typical year.`;
    },
  },
  {
    id: "anomaly",
    title: "Was this year unusual?",
    target: "calendar",
    apply: ({ maxYear }) => ({ aoi: HOME, year: maxYear, mode: "anomaly", month: null, cmp: "" }),
    body: ({ models, year }) => {
      const m = models[HOME];
      const a = m && autumnStats(m, year);
      const s = m && yearSummary(m, year);
      if (!a || !s) return "Anomaly view colours each day by how unusual it is compared with the same week in other years: orange is more fire than usual, blue is less.";
      return `Anomaly view colours each day against the same week in other years: orange is more fire than usual, blue is less. ${year}'s autumn burning was ${signed(a.pct)} against the typical autumn (rank ${a.rank} of ${a.n} years), and the whole year was ${signed(s.vsMedian * 100)} against the median year.`;
    },
  },
  {
    id: "map",
    title: "Where did it burn?",
    target: "map",
    apply: ({ models, year, maxYear }) => {
      const m = models[HOME];
      const a = m && autumnSeason(m, year ?? maxYear);
      return { aoi: HOME, year: maxYear, mode: "activity", month: a ? monthOfDoy(maxYear, a.peakWeek) : 10, cmp: "" };
    },
    body: ({ models, year }) => {
      const m = models[HOME];
      const a = m && autumnSeason(m, year);
      const mon = MONTHS[a ? monthOfDoy(year, a.peakWeek) : 10];
      return `Each hexagon is a patch of land (about 1,800 km²) where satellites detected fire in ${mon} ${year}, the peak month. Brighter cells burned on more days. Use the month buttons to watch the season move.`;
    },
  },
  {
    id: "compare",
    title: "Compare with another part of the world",
    target: "compare",
    apply: ({ maxYear }) => ({ aoi: HOME, year: maxYear, mode: "activity", month: null, cmp: COMPARE }),
    body: ({ models, year }) => {
      const a = models[HOME] && yearSummary(models[HOME], year);
      const b = models[COMPARE] && yearSummary(models[COMPARE], year);
      if (!a || !b) return "Fire seasons depend on climate and land use, so different regions peak at very different times of year.";
      return `Fire seasons depend on climate and land use. In ${year}, southern African savanna burned hardest the week of ${fmtDate(year, b.main.peakWeek)}, while Punjab and Haryana's main peak came the week of ${fmtDate(year, a.main.peakWeek)}.`;
    },
  },
  {
    id: "yours",
    title: "Now make it yours",
    target: "controls",
    apply: ({ maxYear }) => ({ aoi: HOME, year: maxYear, mode: "activity", month: null, cmp: "" }),
    body: () =>
      "Search any of 209 countries, draw an area on the map, or upload a GeoJSON outline. Copy the link to share this exact view, or download the data as a CSV and the calendar as an image.",
  },
];
