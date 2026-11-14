const lerp = (a, b, t) => a + (b - a) * t;
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

const FIRE = ["#0b1a30", "#3d2433", "#a93a12", "#ff7a14", "#ffc760", "#fff1d0"].map(hex);
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

const DIV = ["#4b9bff", "#1d4f91", "#0f1c33", "#8a3a14", "#ff8a1f"].map(hex);
const DIV_STOPS = [0, 0.25, 0.5, 0.75, 1];

export function anomalyColor(z) {
  if (z == null || Number.isNaN(z)) return null;
  return ramp(DIV_STOPS, DIV, (Math.max(-3, Math.min(3, z)) + 3) / 6);
}

export const rgb = (c) => `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;

export const FIRE_CSS = "linear-gradient(90deg,#0b1a30,#3d2433 18%,#a93a12 42%,#ff7a14 68%,#ffc760 88%,#fff1d0)";
export const ANOM_CSS = "linear-gradient(90deg,#4b9bff,#1d4f91 25%,#0f1c33 50%,#8a3a14 75%,#ff8a1f)";
