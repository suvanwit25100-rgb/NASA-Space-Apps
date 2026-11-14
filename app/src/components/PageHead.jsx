import { CHAPTERS, Link } from "../lib/router";
import { ArrowLeft, ArrowRight } from "./Icons";

export function PageHead({ path, children }) {
  const c = CHAPTERS.find((x) => x.path === path);
  return (
    <header className="page-head">
      <span className="numeral" aria-hidden="true">{c.n}</span>
      <h1>{c.title}</h1>
      <p>{children || c.teaser}</p>
    </header>
  );
}

export function ChapterNav({ path }) {
  const i = CHAPTERS.findIndex((c) => c.path === path);
  const prev = CHAPTERS[i - 1];
  const next = CHAPTERS[i + 1];
  return (
    <nav className="chapter-nav" aria-label="Next and previous page">
      {prev ? (
        <Link to={prev.path} className="pill-link"><ArrowLeft width="16" height="16" /> <span><small>{prev.n}</small>{prev.title}</span></Link>
      ) : (
        <Link to="/" className="pill-link"><ArrowLeft width="16" height="16" /> <span><small>Front page</small>Home</span></Link>
      )}
      {next ? (
        <Link to={next.path} className="pill-link next"><span><small>{next.n}</small>{next.title}</span> <ArrowRight width="16" height="16" /></Link>
      ) : (
        <Link to="/" className="pill-link next"><span><small>Back to</small>Front page</span> <ArrowRight width="16" height="16" /></Link>
      )}
    </nav>
  );
}
