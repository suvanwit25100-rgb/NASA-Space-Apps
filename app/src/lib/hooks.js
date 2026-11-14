import { useEffect, useRef, useState } from "react";

export function useSize() {
  const ref = useRef(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(([e]) => {
      const { width, height } = e.contentRect;
      setSize({ w: Math.round(width), h: Math.round(height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, size];
}

export function useInView(threshold = 0.5) {
  const ref = useRef(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setSeen(true), { threshold });
    io.observe(el);
    return () => io.disconnect();
  }, [threshold]);
  return [ref, seen];
}

// true on touch-first devices (no hover); used to say "tap" instead of "hover"
export function useCoarse() {
  const q = typeof window !== "undefined" && window.matchMedia ? window.matchMedia("(hover: none)") : null;
  const [coarse, setCoarse] = useState(!!q?.matches);
  useEffect(() => {
    if (!q) return undefined;
    const on = () => setCoarse(q.matches);
    q.addEventListener("change", on);
    return () => q.removeEventListener("change", on);
  }, [q]);
  return coarse;
}
