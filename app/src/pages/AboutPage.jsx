import { ChapterNav, PageHead } from "../components/PageHead";
import { GithubIcon } from "../components/Icons";

const REPO = "https://github.com/suvanwit25100-rgb/NASA-Space-Apps";

export default function AboutPage() {
  return (
    <main className="page">
      <PageHead path="/about" />
      <section className="panel">
        <h2>Built for responders, land managers and scientists</h2>
        <p className="lead-text">
          For early-warning teams who need to know when fire season usually starts, for land managers comparing their region with others, and for scientists
          who want a reproducible cross-sensor record with its uncertainty. Built for the NASA Space Apps Challenge 2026.
        </p>
      </section>
      <div className="grid-2">
        <section className="panel">
          <h2>NASA data used</h2>
          <ul className="caveats">
            <li><b>NASA FIRMS</b> (Fire Information for Resource Management System): MODIS Collection 6.1 active fire from the Terra and Aqua satellites, and VIIRS 375 m active fire from Suomi NPP, for every country in the FIRMS annual archive.</li>
            <li><b>NASA MCD64A1</b> (MODIS burned area, Collection 6.1), read through the Microsoft Planetary Computer, as an independent validation of the seasonal cycle.</li>
            <li><b>Also compared:</b> GFED4.1s burned area, a third-party dataset built on MCD64A1.</li>
          </ul>
        </section>
        <section className="panel">
          <h2>AI disclosure</h2>
          <ul className="caveats">
            <li>The team set the goal and made the design decisions. Claude (Anthropic) was used as a tool to help plan, and <b>Claude Code</b> (Anthropic) to write the data pipeline, the web app and the documentation.</li>
            <li>No generative AI was used to create imagery. The hero photo is a real photograph, the charts are plots of real data and the architecture diagram is hand-coded.</li>
            <li>This site uses no NASA logos or mission identifiers.</li>
          </ul>
        </section>
      </div>
      <section className="panel link-row">
        <a className="btn" href={REPO} target="_blank" rel="noreferrer"><GithubIcon width="18" height="18" /> Source on GitHub</a>
        <a className="btn" href="/calendar?tour=1">Take the guided tour</a>
      </section>
      <ChapterNav path="/about" />
    </main>
  );
}
