const base = import.meta.env.BASE_URL;
const cache = new Map();

async function fetchBuffer(path) {
  const res = await fetch(`${base}data/${path}`);
  if (!res.ok) throw new Error(`Could not load ${path}`);
  let buf = await res.arrayBuffer();
  const magic = new Uint8Array(buf.slice(0, 2));
  // some hosts decompress .gz transparently; only decompress if the gzip header is still there
  if (magic[0] === 0x1f && magic[1] === 0x8b) {
    if (typeof DecompressionStream === "undefined") throw new Error("This browser is too old to open the data files.");
    buf = await new Response(new Blob([buf]).stream().pipeThrough(new DecompressionStream("gzip"))).arrayBuffer();
  }
  return buf;
}

function once(key, make) {
  if (!cache.has(key)) {
    cache.set(
      key,
      make().catch((e) => {
        cache.delete(key);
        throw e;
      }),
    );
  }
  return cache.get(key);
}

export const loadBuffer = (path) => once(`buf:${path}`, () => fetchBuffer(path));

export const loadRegions = () => once("regions", async () => JSON.parse(new TextDecoder().decode(await fetchBuffer("regions.json"))));

export const loadSeries = (id) =>
  once(`series:${id}`, async () => JSON.parse(new TextDecoder().decode(await fetchBuffer(`series/${id}.json.gz`))));

// H3 res-4 cell ids as hex strings, sorted
export const loadCells4 = () =>
  once("cells4", async () => {
    const buf = await fetchBuffer("map/cells4.bin.gz");
    return Array.from(new BigUint64Array(buf), (v) => v.toString(16));
  });

// uint8 intensity per res-4 cell (VIIRS era), used for the hero art
export const loadSky = () => once("sky", async () => new Uint8Array(await fetchBuffer("map/sky.bin.gz")));

// columnar records: uint32 cell index, uint8 month (0-11), uint8 burning days
export const loadMapYear = (year) =>
  once(`map:${year}`, async () => {
    const buf = await fetchBuffer(`map/${year}.bin.gz`);
    const n = buf.byteLength / 6;
    return { n, cell: new Uint32Array(buf, 0, n), month: new Uint8Array(buf, 4 * n, n), days: new Uint8Array(buf, 5 * n, n) };
  });
