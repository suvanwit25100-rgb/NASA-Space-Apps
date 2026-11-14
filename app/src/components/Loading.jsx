import { useExplorer } from "../state/Explorer";

export default function Loading({ children }) {
  const e = useExplorer();
  if (!e.model) return e.loadError ? <div className="error">Could not load the data: {e.loadError}</div> : <div className="skeleton">Loading the fire record…</div>;
  return children;
}
