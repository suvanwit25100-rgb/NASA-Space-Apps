const base = import.meta.env.BASE_URL;

export async function loadAois() {
  const res = await fetch(`${base}data/aois.json`);
  if (!res.ok) throw new Error("Could not load AOI data");
  return res.json();
}

export async function loadCells() {
  const res = await fetch(`${base}data/cells.json`);
  if (!res.ok) throw new Error("Could not load cell index");
  return res.json();
}

// packed records: uint16 cell, uint16 year-month index (months since Jan 2000), uint8 burning days
export async function loadCellMonths() {
  const res = await fetch(`${base}data/cell_months.bin`);
  if (!res.ok) throw new Error("Could not load map data");
  const buf = await res.arrayBuffer();
  const view = new DataView(buf);
  const n = buf.byteLength / 5;
  const cell = new Uint16Array(n);
  const month = new Uint16Array(n);
  const days = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    cell[i] = view.getUint16(i * 5, true);
    month[i] = view.getUint16(i * 5 + 2, true);
    days[i] = view.getUint8(i * 5 + 4);
  }
  return { cell, month, days, n };
}
