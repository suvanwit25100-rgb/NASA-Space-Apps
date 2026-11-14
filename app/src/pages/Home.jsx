import { useEffect, useRef, useState } from "react";
import { DataAndAI } from "../components/AboutBlocks";
import CountUp from "../components/CountUp";
import { ArrowRight, GithubIcon, PlayIcon } from "../components/Icons";
import { Reveal } from "../components/Reveal";
import { prefersReducedMotion } from "../lib/hooks";
import { CHAPTERS, Link, startTour } from "../lib/router";

const DWELL_MS = 7000;
const REPO = "https://github.com/suvanwit25100-rgb/NASA-Space-Apps";

export default function Home({ nCountries = 209 }) {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const heroRef = useRef(null);
  const c = CHAPTERS[i];

  // chapter carousel: advance on a timer, pause while the pointer is over the hero
  useEffect(() => {
    if (paused || prefersReducedMotion()) return undefined;
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

  // parallax: the photo drifts slower than the page, and the title fades as you leave the hero
  useEffect(() => {
    const el = heroRef.current;
    if (!el || prefersReducedMotion()) return undefined;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const y = Math.min(window.scrollY, window.innerHeight);
        el.style.setProperty("--scroll", y.toFixed(0));
        el.style.setProperty("--fade", String(Math.max(0, 1 - y / (window.innerHeight * 0.7))));
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <main className="home">
      <section className="hero" ref={heroRef} onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} aria-label="Introduction">
        <div className="hero-media">
          <img className="hero-img" src="/img/hero.webp" alt="A volcanic crater glowing with molten lava under a dusk sky" fetchpriority="high" />
        </div>
        <div className="hero-shade" aria-hidden="true" />
        <div className="hero-glow" aria-hidden="true" />
        <div className="embers" aria-hidden="true">
          {Array.from({ length: 14 }, (_, k) => <i key={k} style={{ "--x": `${(k * 73) % 100}%`, "--s": `${6 + ((k * 5) % 9)}s`, "--dl": `${(k * 0.7) % 6}s`, "--z": 2 + (k % 3) }} />)}
        </div>

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

        <button className="scroll-cue" onClick={() => document.getElementById("about-front")?.scrollIntoView({ behavior: "smooth" })} aria-label="Scroll down to learn more">
          <span>Scroll</span><i />
        </button>
      </section>

      <div className="front-scroll">
        <section id="about-front" className="front-section about-bg" aria-label="About">
          <Reveal as="p" className="eyebrow caps">About the project</Reveal>
          <Reveal as="h2" className="front-h" delay={80}>Twenty-five years of fire,<br /><em>one consistent record.</em></Reveal>
          <Reveal as="p" className="front-lead" delay={160}>
            Satellites have watched Earth burn since 2000, but the record is split across sensors that cannot be compared directly: the newer VIIRS sees
            roughly six times more fire detections than the older MODIS, so a naive count jumps in 2012. Global Burn Log calibrates the sensors against each
            other, so early-warning teams, land managers and scientists can see when a region's fire season starts, when it peaks, and how this year compares.
          </Reveal>
          <div className="stat-row">
            <Reveal className="stat"><b><CountUp to={25} /></b><span className="caps">Years of record</span></Reveal>
            <Reveal className="stat" delay={100}><b><CountUp to={nCountries} /></b><span className="caps">Countries</span></Reveal>
            <Reveal className="stat" delay={200}><b><CountUp to={100} suffix=" M" /></b><span className="caps">Burning cell-days</span></Reveal>
            <Reveal className="stat" delay={300}><b><CountUp to={3} /></b><span className="caps">Satellite sensors</span></Reveal>
          </div>
        </section>

        <section className="front-section" aria-label="Chapters">
          <Reveal as="p" className="eyebrow caps">Explore</Reveal>
          <Reveal as="h2" className="front-h" delay={80}>Six ways in</Reveal>
          <div className="chapter-grid">
            {CHAPTERS.map((ch, k) => (
              <Reveal key={ch.n} delay={k * 90}>
                <Link to={ch.path} className="chapter-card">
                  <span className="n">{ch.n}</span>
                  <h3>{ch.title}</h3>
                  <p>{ch.teaser}</p>
                  <span className="go" aria-hidden="true"><ArrowRight width="20" height="20" /></span>
                </Link>
              </Reveal>
            ))}
          </div>
        </section>

        <Reveal className="smoke-band">
          <div className="smoke-art" aria-hidden="true" />
          <div className="smoke-copy">
            <p className="eyebrow caps">The demo question</p>
            <h2 className="front-h">When does <em>your</em> region burn?</h2>
            <p className="front-lead">Pick Punjab and Haryana to see two separate fire seasons, spring wheat residue and autumn paddy stubble, and how this year compares with the last twenty-five.</p>
            <Link to="/seasons" className="btn primary">See fire seasons <ArrowRight width="16" height="16" /></Link>
          </div>
        </Reveal>

        <section className="front-section" aria-label="Data and honesty">
          <Reveal as="p" className="eyebrow caps">Where it comes from</Reveal>
          <Reveal as="h2" className="front-h" delay={80}>Built on NASA data, <em>openly.</em></Reveal>
          <DataAndAI />
          <Reveal className="cta-row">
            <button className="btn primary" onClick={startTour}><PlayIcon width="16" height="16" /> Take the guided tour</button>
            <Link to="/method" className="btn">How we checked it <ArrowRight width="16" height="16" /></Link>
            <a className="btn" href={REPO} target="_blank" rel="noreferrer"><GithubIcon width="16" height="16" /> Source code</a>
          </Reveal>
        </section>
      </div>
    </main>
  );
}
