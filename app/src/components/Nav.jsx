import { useEffect, useState } from "react";
import { CHAPTERS, Link, startTour } from "../lib/router";
import { CloseIcon, Logo, MenuIcon } from "./Icons";

export default function Nav({ route }) {
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [route]);
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <header className={`nav ${route === "/" ? "on-hero" : ""}`}>
      <Link to="/" className="brand" aria-label="Global Burn Log home">
        <Logo />
        <span>Global Burn Log</span>
      </Link>
      <nav className="nav-links" aria-label="Pages">
        {CHAPTERS.map((c, i) => (
          <span key={c.path} className="nav-item">
            {i > 0 && <i aria-hidden="true" />}
            <Link to={c.path} aria-current={route === c.path ? "page" : undefined}>
              {c.title.replace("The ", "")}
            </Link>
          </span>
        ))}
      </nav>
      <div className="nav-right">
        <button className="nav-tour" onClick={startTour}>Guided tour</button>
        <button className="icon-btn menu" onClick={() => setOpen((o) => !o)} aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open}>
          {open ? <CloseIcon /> : <MenuIcon />}
        </button>
      </div>
      {open && (
        <div className="sheet" role="dialog" aria-label="Menu">
          <Link to="/" aria-current={route === "/" ? "page" : undefined}>Home</Link>
          {CHAPTERS.map((c) => (
            <Link key={c.path} to={c.path} aria-current={route === c.path ? "page" : undefined}>
              <b>{c.n}</b> {c.title}
            </Link>
          ))}
          <button onClick={() => { setOpen(false); startTour(); }}>Take the guided tour</button>
        </div>
      )}
    </header>
  );
}
