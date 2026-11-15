import { ChapterNav, PageHead } from "../components/PageHead";
import { DataAndAI } from "../components/AboutBlocks";
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
      <DataAndAI />
      <section className="panel">
        <h2>Try these views</h2>
        <p className="hint">Direct links to views worth a look. Each one opens with the area and year already chosen.</p>
        <div className="pill-row">
          {[
            ["Punjab stubble burning, 2025", "/seasons?aoi=punjab-haryana&y=2025"],
            ["Australia Black Summer", "/calendar?aoi=southeast-australia&y=2019"],
            ["Canada 2023", "/seasons?aoi=boreal-canada&y=2023"],
            ["Amazon 2019", "/calendar?aoi=amazon-arc&y=2019&mode=anomaly"],
            ["Indonesia 2015", "/seasons?aoi=maritime-sea&y=2015"],
            ["World map, 2020", "/map?aoi=world&y=2020"],
          ].map(([t, h]) => <a key={h} className="chip" href={h}>{t}</a>)}
        </div>
      </section>
      <section className="panel link-row">
        <a className="btn" href={REPO} target="_blank" rel="noreferrer"><GithubIcon width="18" height="18" /> Source on GitHub</a>
        <a className="btn" href="/calendar?tour=1">Take the guided tour</a>
        <a className="btn" href="/data">Use the data</a>
      </section>
      <ChapterNav path="/about" />
    </main>
  );
}
