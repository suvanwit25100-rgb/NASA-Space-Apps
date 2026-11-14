import { useEffect, useState } from "react";
import { GithubIcon, PlayIcon } from "../components/Icons";
import { CHAPTERS, Link, startTour } from "../lib/router";

const DWELL_MS = 7000;
const REPO = "https://github.com/suvanwit25100-rgb/NASA-Space-Apps";

export default function Home({ nCountries = 209 }) {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const c = CHAPTERS[i];

  useEffect(() => {
    if (paused || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return undefined;
    const t = setTimeout(() => setI((n) => (n + 1) % CHAPTERS.length), DWELL_MS);
    return () => clearTimeout(t);
  }, [i, paused]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "ArrowRight") setI((n) => (n + 1) % CHAPTERS.length);
      if (e.key === "ArrowLeft") setI((n) => (n - 1 + CHAPTERS.length) % CHAPTERS.length);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <main className="home" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      <img className="hero-img" src="/img/hero.webp" alt="A volcanic crater glowing with molten lava under a dusk sky" fetchpriority="high" />
      <div className="hero-shade" aria-hidden="true" />
      <div className="hero-glow" aria-hidden="true" />

      <p className="side-label" aria-hidden="true"><i /> NASA FIRMS · MODIS · VIIRS</p>

      <div className="hero-title">
        <h1>
          <span className="the">The</span>
          <span className="big">Burn Log</span>
        </h1>
        <div className="rule" aria-hidden="true" />
      </div>

      <div className="hero-caption" aria-live="polite">
        <h2 key={c.n}>{c.n}. {c.title}</h2>
        <p key={`${c.n}p`}>{c.teaser}</p>
        <small>25 years · {nCountries} countries · 3 satellite sensors</small>
      </div>

      <Link to={c.path} className="orb" aria-label={`Open ${c.title}`}>
        <svg viewBox="0 0 160 160" aria-hidden="true">
          <circle cx="80" cy="80" r="78" className="orb-track" />
          <circle cx="80" cy="80" r="78" className="orb-arc" key={`${i}-${paused}`} style={{ animationPlayState: paused ? "paused" : "running" }} />
          <line x1="22" y1="138" x2="138" y2="22" className="orb-slash" />
        </svg>
        <span>Open</span>
      </Link>

      <div className="pager" role="tablist" aria-label="Chapters">
        <button role="tab" aria-selected={i === 0} onClick={() => setI(0)} aria-label={`${CHAPTERS[0].n}: ${CHAPTERS[0].title}`}>{CHAPTERS[0].n}</button>
        <div className="pager-line" aria-hidden="true">
          {CHAPTERS.map((ch, k) => (
            <button key={ch.n} role="tab" tabIndex={-1} aria-selected={k === i} className={k === i ? "dot on" : "dot"} onClick={() => setI(k)} aria-label={`${ch.n}: ${ch.title}`} />
          ))}
        </div>
        <button role="tab" aria-selected={i === CHAPTERS.length - 1} onClick={() => setI(CHAPTERS.length - 1)} aria-label={`${CHAPTERS[5].n}: ${CHAPTERS[5].title}`}>{CHAPTERS[CHAPTERS.length - 1].n}</button>
      </div>

      <div className="social" aria-label="Links">
        <a href={REPO} target="_blank" rel="noreferrer" aria-label="Source code on GitHub"><GithubIcon width="20" height="20" /></a>
        <button onClick={startTour} aria-label="Take the guided tour"><PlayIcon width="18" height="18" /></button>
      </div>
    </main>
  );
}
