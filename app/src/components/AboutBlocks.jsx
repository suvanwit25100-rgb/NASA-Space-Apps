import { Reveal } from "./Reveal";

export function DataAndAI() {
  return (
    <div className="grid-2">
      <Reveal className="panel">
        <h2>NASA data used</h2>
        <ul className="caveats">
          <li><b>NASA FIRMS</b> (Fire Information for Resource Management System): MODIS Collection 6.1 active fire from the Terra and Aqua satellites, and VIIRS 375 m active fire from Suomi NPP, for every country in the FIRMS annual archive.</li>
          <li><b>NASA MCD64A1</b> (MODIS burned area, Collection 6.1), read through the Microsoft Planetary Computer, as an independent validation of the seasonal cycle.</li>
          <li><b>Also compared:</b> GFED4.1s burned area, a third-party dataset built on MCD64A1.</li>
        </ul>
      </Reveal>
      <Reveal className="panel" delay={120}>
        <h2>AI disclosure</h2>
        <ul className="caveats">
          <li>The team set the goal and made the design decisions. Claude (Anthropic) was used as a tool to help plan, and <b>Claude Code</b> (Anthropic) to write the data pipeline, the web app and the documentation.</li>
          <li>The front-page hero is a real photograph. The page backgrounds and the glowing-tree picture were generated with ChatGPT and carry a visible SI-generated label. The charts are plots of real data and the architecture diagram is hand-coded.</li>
          <li>This site uses no NASA logos or mission identifiers.</li>
        </ul>
      </Reveal>
    </div>
  );
}
