// How often a satellite looks at a place. All three are sun-synchronous polar orbiters whose ground tracks sit about one
// orbit-spacing apart at the equator and converge toward the poles, so a place at latitude phi falls inside the swath
// roughly (swath / (spacing * cos phi)) times per ascending pass and as often per descending pass. VIIRS's swath is wider
// than the spacing (about 1.1 looks each way at the equator), MODIS's is narrower (about 0.85, so it leaves gaps at the
// equator), and both look more often the nearer the poles. This is an analytic approximation, not a measured count.
const EARTH_CIRC_KM = 40075;
const SENSORS = {
  viirs: { swath: 3060, orbitsPerDay: 14.19 }, // Suomi NPP
  modis: { swath: 2330, orbitsPerDay: 14.56 }, // Terra and Aqua
};
const MAX_LAT = 75;

export function looksPerDay(latDeg, sensor = "viirs") {
  const { swath, orbitsPerDay } = SENSORS[sensor];
  const lat = Math.min(Math.abs(latDeg), MAX_LAT) * (Math.PI / 180);
  const spacing = (EARTH_CIRC_KM / orbitsPerDay) * Math.cos(lat);
  return (2 * swath) / spacing; // day pass plus night pass
}

// Looks relative to the equator: 1 at the equator, about 2 at 60 degrees. Capped so the edge of the model cannot run away.
export const coverageFactor = (latDeg, sensor = "viirs") => Math.min(looksPerDay(latDeg, sensor) / looksPerDay(0, sensor), 3);
