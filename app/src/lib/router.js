import { createElement, useEffect, useState } from "react";

export const CHAPTERS = [
  { n: "I", path: "/calendar", title: "The Calendar", teaser: "Every day since 2000 as a calendar, with the story of the year in a sentence." },
  { n: "II", path: "/seasons", title: "Fire Seasons", teaser: "When a region's fire season starts, peaks and ends, and how every year compares." },
  { n: "III", path: "/map", title: "The Map", teaser: "Where it burned, month by month, anywhere on Earth. Draw your own area." },
  { n: "IV", path: "/compare", title: "Compare", teaser: "Do two places burn at the same time of year? Set them side by side." },
  { n: "V", path: "/method", title: "The Method", teaser: "How two decades of mismatched sensors become one record, and how we checked it." },
  { n: "VI", path: "/about", title: "About", teaser: "The NASA data behind it, how AI was used, and what the limits are." },
];

const ROUTES = ["/", ...CHAPTERS.map((c) => c.path)];

export function routeOf(pathname) {
  const clean = pathname.replace(/\/+$/, "") || "/";
  return ROUTES.includes(clean) ? clean : "/";
}

// state that should follow the visitor from page to page lives in the query string
export function carryQuery() {
  const sp = new URLSearchParams(window.location.search);
  sp.delete("tour");
  const q = sp.toString();
  return q ? `?${q}` : "";
}

export function navigate(to, { replace = false, query = true } = {}) {
  const [path, ownQuery = ""] = to.split("?");
  const target = path + (ownQuery ? `?${ownQuery}` : query ? carryQuery() : "");
  if (target === window.location.pathname + window.location.search) return;
  window.history[replace ? "replaceState" : "pushState"](null, "", target);
  window.dispatchEvent(new Event("burnlog:navigate"));
  window.scrollTo({ top: 0, behavior: "instant" });
}

export function useRoute() {
  const [route, setRoute] = useState(() => routeOf(window.location.pathname));
  useEffect(() => {
    const on = () => setRoute(routeOf(window.location.pathname));
    window.addEventListener("popstate", on);
    window.addEventListener("burnlog:navigate", on);
    return () => {
      window.removeEventListener("popstate", on);
      window.removeEventListener("burnlog:navigate", on);
    };
  }, []);
  return route;
}

export function Link({ to, children, onClick, ...rest }) {
  const handle = (e) => {
    onClick?.(e);
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
    navigate(to);
  };
  return createElement("a", { href: to + carryQuery(), onClick: handle, ...rest }, children);
}

// the tour lives in the explorer state; from the front page there is none yet, so open it on its first page
export function startTour() {
  if (window.__burnlogExplorer) window.dispatchEvent(new Event("burnlog:tour"));
  else navigate("/calendar?tour=1", { query: false });
}
