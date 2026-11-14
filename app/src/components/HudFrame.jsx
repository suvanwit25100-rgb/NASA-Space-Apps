import { useSize } from "../lib/hooks";

export default function HudFrame({ children, className = "" }) {
  const [ref, { w, h }] = useSize();
  const c = 28;
  const path =
    w && h
      ? `M${c},0 L${w - 170},0 L${w - 146},18 L${w - 18},18 L${w},36 L${w},${h - c} L${w - c},${h} L190,${h} L166,${h - 16} L18,${h - 16} L0,${h - 34} L0,${c} Z`
      : "";
  return (
    <div ref={ref} className={`hud ${className}`}>
      {path && <div className="hud-fill" style={{ clipPath: `path("${path}")` }} />}
      {path && (
        <svg viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
          <path d={path} fill="none" stroke="#4a7aa8" strokeWidth="2.4" strokeLinejoin="round" />
          <path d={`M${c + 8},-1 L${w - 176},-1`} stroke="#9fd0ff" strokeWidth="1" opacity="0.5" />
          <polygon points={`34,${h - 13} 58,${h - 13} 46,${h - 1} 22,${h - 1}`} fill="#4a7aa8" />
          <polygon points={`66,${h - 13} 90,${h - 13} 78,${h - 1} 54,${h - 1}`} fill="#ff8a1f" />
          <polygon points={`${w - 52},${h - 6} ${w - 20},${h - 6} ${w - 20},${h - 30}`} fill="none" stroke="#4a7aa8" strokeWidth="1.4" opacity="0.7" />
        </svg>
      )}
      <div className="hud-body">{children}</div>
    </div>
  );
}
