export default function About() {
  return (
    <section id="about" className="section" aria-label="About">
      <div className="section-head">
        <div className="eyebrow caps">04 · About</div>
        <h2>Built for responders<span className="dot">.</span></h2>
        <p>
          For early-warning teams, land managers and scientists who need to know when fire season usually starts, how unusual a
          given week is, and whether today's pattern has precedent. Built for the NASA Space Apps Challenge 2026.
        </p>
      </div>
      <div className="wrap grid-2">
        <div className="panel">
          <h3>NASA data used</h3>
          <ul className="caveats">
            <li><b>NASA FIRMS</b> (Fire Information for Resource Management System): MODIS Collection 6.1 active fire from the Terra and Aqua satellites, and VIIRS 375 m active fire from Suomi NPP.</li>
            <li><b>NASA MCD64A1</b> (MODIS burned area, Collection 6.1), read through the Microsoft Planetary Computer, as an independent validation of the seasonal cycle.</li>
            <li><b>Also compared:</b> GFED4.1s burned area, a third-party dataset built on MCD64A1.</li>
          </ul>
        </div>
        <div className="panel">
          <h3>AI disclosure</h3>
          <ul className="caveats">
            <li>The idea, the approach and the scientific method were set by the team. <b>Claude Code</b> (Anthropic) was used as a tool to help write the data pipeline, this web app and the documentation.</li>
            <li>No generative AI was used to create imagery. The hero sky is drawn in code from the real fire detections.</li>
            <li>This site uses no NASA logos or mission identifiers.</li>
          </ul>
        </div>
      </div>
      <div className="section-foot">
        <span className="caps">PAGE 4</span>
        <span className="center">globalburnlog.earth</span>
        <a className="round-btn right" href="#top" aria-label="Back to top" style={{ transform: "rotate(180deg)" }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="18" height="18"><path d="M12 5v14M6 13l6 6 6-6" /></svg>
        </a>
      </div>
    </section>
  );
}
