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
      <section className="panel link-row">
        <a className="btn" href={REPO} target="_blank" rel="noreferrer"><GithubIcon width="18" height="18" /> Source on GitHub</a>
        <a className="btn" href="/calendar?tour=1">Take the guided tour</a>
      </section>
      <ChapterNav path="/about" />
    </main>
  );
}
