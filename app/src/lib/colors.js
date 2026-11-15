const lerp = (a, b, t) => a + (b - a) * t;
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

const FIRE_STOPS = [0, 0.18, 0.42, 0.68, 0.88, 1];
const DIV_STOPS = [0, 0.25, 0.5, 0.75, 1];

// "fire" is the default look. "safe" avoids red against green and uses a dark-to-yellow ramp (blue, teal, yellow) for activity and
// blue against yellow for above and below usual, which stay distinct for the common kinds of colour-vision difference.
const PALETTES = {
  fire: {
    fire: ["#1a141a", "#3d1f14", "#a43c0e", "#ff7a2f", "#ffb869", "#ffe6c2"],
    div: ["#6fb3ff", "#2a5a9a", "#1a141a", "#8a3a14", "#ff8a1f"],
  },
  safe: {
    fire: ["#14122b", "#2b2d7a", "#1f6f9a", "#2fb593", "#d8e24a", "#fffdd0"],
    div: ["#5aa9ff", "#2a5a9a", "#1a141a", "#8a7415", "#ffd84a"],
  },
};

export const PALETTE_NAMES = { fire: "Fire colours", safe: "Colour-blind safe" };

const cssRamp = (cols, stops) => `linear-gradient(90deg,${cols.map((c, i) => `${c} ${Math.round(stops[i] * 100)}%`).join(",")})`;

let current = "fire";
let FIRE = PALETTES.fire.fire.map(hex);
let DIV = PALETTES.fire.div.map(hex);
// live bindings: read these at render time
export let FIRE_CSS = cssRamp(PALETTES.fire.fire, FIRE_STOPS);
export let ANOM_CSS = cssRamp(PALETTES.fire.div, DIV_STOPS);

export function setPalette(name) {
  if (!PALETTES[name]) return;
  current = name;
  FIRE = PALETTES[name].fire.map(hex);
  DIV = PALETTES[name].div.map(hex);
  FIRE_CSS = cssRamp(PALETTES[name].fire, FIRE_STOPS);
  ANOM_CSS = cssRamp(PALETTES[name].div, DIV_STOPS);
}
export const getPalette = () => current;

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

export function anomalyColor(z) {
  if (z == null || Number.isNaN(z)) return null;
  return ramp(DIV_STOPS, DIV, (Math.max(-3, Math.min(3, z)) + 3) / 6);
}

export const rgb = (c) => `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;
