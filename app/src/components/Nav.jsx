import { Logo } from "./Icons";

export default function Nav() {
  return (
    <header className="nav">
      <a className="brand" href="#top" aria-label="Global Burn Log home">
        <Logo />
        <span>Global Burn Log</span>
      </a>
      <nav aria-label="Primary">
        <ul className="nav-links">
          <li><a href="#top">Home</a></li>
          <li><a href="#explore">Explore</a></li>
          <li><a href="#method">Method</a></li>
          <li><a href="#about">About</a></li>
        </ul>
      </nav>
    </header>
  );
}
