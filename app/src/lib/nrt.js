const base = import.meta.env.BASE_URL;
// The scheduled GitHub Action commits a fresh nrt.json every day. The site reads it straight from the repository so a
// redeploy is not needed; the copy bundled with the site is the fallback and the baseline.
const LIVE = "https://raw.githubusercontent.com/suvanwit25100-rgb/NASA-Space-Apps/main/app/public/data/nrt.json";

let cache = null;
const get = (url, ms) =>
  Promise.race([
    fetch(url).then((r) => (r.ok ? r.json() : null)),
    new Promise((res) => setTimeout(() => res(null), ms)),
  ]).catch(() => null);

export const loadNrt = () =>
  (cache ||= Promise.all([get(`${base}data/nrt.json`, 8000), get(LIVE, 4000)]).then(([bundled, live]) => {
    if (live?.end && (!bundled || live.end > bundled.end)) return { ...live, live: true };
    return bundled;
  }));

const KEY = "burnlog:watch";
export function readWatch() {
  try {
    const v = JSON.parse(window.localStorage.getItem(KEY) || "[]");
    return Array.isArray(v) ? v.filter((x) => x && typeof x.id === "string" && Number.isFinite(x.z)) : [];
  } catch {
    return [];
  }
}
export function writeWatch(list) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* private mode: the watchlist just won't persist */
  }
}
