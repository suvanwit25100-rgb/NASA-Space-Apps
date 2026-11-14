import { useEffect, useMemo, useRef } from "react";
import { cellToLatLng } from "h3-js";
import HudFrame from "./HudFrame";
import { ArrowDown } from "./Icons";
import { useSize } from "../lib/hooks";

function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function useFirePoints(cells, cm) {
  return useMemo(() => {
    if (!cells || !cm) return null;
    const total = new Float32Array(cells.length);
    for (let i = 0; i < cm.n; i++) if (cm.month[i] >= 144) total[cm.cell[i]] += cm.days[i];
    const sorted = Array.from(total).filter((v) => v > 0).sort((a, b) => a - b);
    const ref = sorted[Math.floor(sorted.length * 0.995)] || 1;
    const pts = [];
    for (let i = 0; i < cells.length; i++) {
      if (total[i] <= 0) continue;
      const [lat, lon] = cellToLatLng(cells[i]);
      pts.push({ lat, lon, k: Math.min(1, (total[i] / ref) ** 1.25) });
    }
    return pts;
  }, [cells, cm]);
}

function drawSky(canvas, w, h, pts) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const rand = rng(7);

  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, "#01030a");
  bg.addColorStop(0.5, "#040b18");
  bg.addColorStop(1, "#03070f");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  const R = Math.max(w * 1.7, h * 1.9);
  const cx = w * 0.5;
  const limbY = h * 0.17;
  const cy = limbY + R;

  for (let i = 0; i < 220; i++) {
    const y = rand() * limbY * 1.15;
    ctx.fillStyle = `rgba(200,225,255,${0.12 + rand() * 0.5})`;
    ctx.fillRect(rand() * w, y, rand() < 0.1 ? 1.6 : 1, rand() < 0.1 ? 1.6 : 1);
  }

  const body = ctx.createRadialGradient(cx, cy, R * 0.55, cx, cy, R);
  body.addColorStop(0, "#030914");
  body.addColorStop(0.85, "#05122a");
  body.addColorStop(1, "#0a2748");
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, R - 1, 0, Math.PI * 2);
  ctx.clip();
  for (let i = 0; i < 2600; i++) {
    const x = rand() * w;
    const y = limbY + rand() * rand() * (h - limbY);
    ctx.fillStyle = `rgba(190,215,255,${0.03 + rand() * 0.07})`;
    ctx.fillRect(x, y, 1.2, 1.2);
  }
  ctx.restore();

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const glow = ctx.createRadialGradient(cx, cy, R - R * 0.02, cx, cy, R + R * 0.1);
  glow.addColorStop(0, "rgba(120,190,255,0.0)");
  glow.addColorStop(0.18, "rgba(150,210,255,0.95)");
  glow.addColorStop(0.32, "rgba(60,130,230,0.45)");
  glow.addColorStop(1, "rgba(30,80,170,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, limbY + R * 0.2);
  const haze = ctx.createRadialGradient(cx, cy, R * 0.9, cx, cy, R);
  haze.addColorStop(0, "rgba(40,110,200,0)");
  haze.addColorStop(1, "rgba(60,140,230,0.30)");
  ctx.fillStyle = haze;
  ctx.fillRect(0, limbY, w, h);
  ctx.restore();

  if (!pts) return;
  const lat0 = (-30 * Math.PI) / 180;
  const lon0 = 82;
  const roll = (-8 * Math.PI) / 180;
  const pivotX = cx;
  const pivotY = h * 0.7;
  const project = (lat, lon) => {
    const phi = (lat * Math.PI) / 180;
    const dl = ((lon - lon0) * Math.PI) / 180;
    const cosc = Math.sin(lat0) * Math.sin(phi) + Math.cos(lat0) * Math.cos(phi) * Math.cos(dl);
    if (cosc <= 0.02) return null;
    const x = R * Math.cos(phi) * Math.sin(dl);
    const y = R * (Math.cos(lat0) * Math.sin(phi) - Math.sin(lat0) * Math.cos(phi) * Math.cos(dl));
    let px = cx + x;
    let py = cy - y;
    const rx = px - pivotX;
    const ry = py - pivotY;
    px = pivotX + rx * Math.cos(roll) - ry * Math.sin(roll);
    py = pivotY + rx * Math.sin(roll) + ry * Math.cos(roll);
    return [px, py, Math.max(0.35, cosc)];
  };

  const sprite = document.createElement("canvas");
  sprite.width = sprite.height = 64;
  const sg = sprite.getContext("2d");
  const grad = sg.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, "rgba(255,190,110,0.9)");
  grad.addColorStop(0.3, "rgba(255,120,20,0.45)");
  grad.addColorStop(1, "rgba(255,90,0,0)");
  sg.fillStyle = grad;
  sg.fillRect(0, 0, 64, 64);

  ctx.globalCompositeOperation = "lighter";
  const cellPx = R * 0.0016;
  for (const p of pts) {
    const q = project(p.lat, p.lon);
    if (!q) continue;
    const [x, y, s] = q;
    if (x < -40 || x > w + 40 || y < limbY - 10 || y > h + 40) continue;
    const r = cellPx * (1.1 + p.k * 1.7) * (0.6 + s * 0.4);
    ctx.globalAlpha = 0.03 + p.k * 0.3;
    ctx.drawImage(sprite, x - r, y - r, r * 2, r * 2);
    const n = Math.round(p.k * 4);
    for (let i = 0; i < n; i++) {
      const jx = x + (rand() - 0.5) * cellPx * 5.5;
      const jy = y + (rand() - 0.5) * cellPx * 3.2;
      ctx.globalAlpha = 0.2 + rand() * 0.45;
      ctx.fillStyle = rand() < 0.18 ? "#ffd592" : "#ff7a14";
      ctx.fillRect(jx, jy, 1.2, 1.2);
    }
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
}

export default function Hero({ cells, cm, stats }) {
  const [ref, size] = useSize();
  const canvasRef = useRef(null);
  const pts = useFirePoints(cells, cm);

  useEffect(() => {
    if (canvasRef.current && size.w && size.h) drawSky(canvasRef.current, size.w, size.h, pts);
  }, [size, pts]);

  return (
    <section id="top" className="hero" ref={ref} aria-label="Introduction">
      <canvas ref={canvasRef} className="sky" role="img" aria-label="Night-side Earth seen from orbit, glowing orange where satellites have detected fire across India" />
      <div className="hero-inner">
        <HudFrame>
          <h1>
            BURN LOG<span className="dot">.</span>
          </h1>
          <p className="sub">GLOBAL BURNING ACTIVITY CALENDAR</p>
        </HudFrame>
        <p className="lede">
          Twenty-five years of satellite fire detections, stitched across sensors that never agreed with each other. See when a
          region's fire season starts, when it peaks, and how this year compares.
        </p>
        <div className="cta-row">
          <a className="btn primary" href="#explore">Explore the calendar</a>
          <a className="btn" href="#method">How it works</a>
        </div>
        {stats && (
          <div className="hero-stats">
            {stats.map((s) => (
              <div key={s.label}>
                <b className="num">{s.value}</b>
                <span className="caps">{s.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="page-foot">
        <span className="caps">PAGE 1</span>
        <span className="center">globalburnlog.earth</span>
        <a className="round-btn right" href="#explore" aria-label="Scroll to the explorer">
          <ArrowDown />
        </a>
      </div>
    </section>
  );
}
