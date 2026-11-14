import { useEffect, useState } from "react";
import { prefersReducedMotion, useInView } from "../lib/hooks";

export default function CountUp({ to, suffix = "", duration = 1600 }) {
  const [ref, seen] = useInView(0.4);
  const [v, setV] = useState(prefersReducedMotion() ? to : 0);
  useEffect(() => {
    if (!seen || prefersReducedMotion()) {
      if (seen) setV(to);
      return undefined;
    }
    let raf;
    const t0 = performance.now();
    const tick = (t) => {
      const k = Math.min(1, (t - t0) / duration);
      setV(Math.round(to * (1 - (1 - k) ** 3)));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [seen, to, duration]);
  return <span ref={ref} className="num">{v.toLocaleString()}{suffix}</span>;
}
