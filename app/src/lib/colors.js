const lerp = (a, b, t) => a + (b - a) * t;
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

const FIRE = ["#1a141a", "#3d1f14", "#a43c0e", "#ff7a2f", "#ffb869", "#ffe6c2"].map(hex);
const FIRE_STOPS = [0, 0.18, 0.42, 0.68, 0.88, 1];

function ramp(stops, colors, t) {
  const c = Math.min(1, Math.max(0, t));
  for (let i = 1; i < stops.length; i++) {
    if (c <= stops[i]) {
      const k = (c - stops[i - 1]) / (stops[i] - stops[i - 1]);
      return colors[i - 1].map((v, j) => lerp(v, colors[i][j], k));
    }
  }
  return colors[colors.length - 1];
}

export function fireColor(v, vmax) {
  if (!(v >= 0)) return null;
  return ramp(FIRE_STOPS, FIRE, Math.sqrt(v / vmax));
}

const DIV = ["#6fb3ff", "#2a5a9a", "#1a141a", "#8a3a14", "#ff8a1f"].map(hex);
const DIV_STOPS = [0, 0.25, 0.5, 0.75, 1];

export function anomalyColor(z) {
  if (z == null || Number.isNaN(z)) return null;
  return ramp(DIV_STOPS, DIV, (Math.max(-3, Math.min(3, z)) + 3) / 6);
}

export const rgb = (c) => `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;

export const FIRE_CSS = "linear-gradient(90deg,#1a141a,#3d1f14 18%,#a43c0e 42%,#ff7a2f 68%,#ffb869 88%,#ffe6c2)";
export const ANOM_CSS = "linear-gradient(90deg,#6fb3ff,#2a5a9a 25%,#1a141a 50%,#8a3a14 75%,#ff8a1f)";
