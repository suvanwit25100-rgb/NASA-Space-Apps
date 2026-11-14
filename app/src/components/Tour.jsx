import { useEffect, useState } from "react";

export default function Tour({ index, steps, onBack, onNext, onClose }) {
  const step = steps[index];
  const last = index === steps.length - 1;
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    if (!playing || last) {
      if (last) setPlaying(false);
      return undefined;
    }
    const t = setTimeout(onNext, 9000);
    return () => clearTimeout(t);
  }, [playing, index]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <aside className="tour" role="dialog" aria-label="Guided tour" aria-live="polite">
      <div className="tour-top">
        <span className="caps">Guided tour · {index + 1} of {steps.length}</span>
        <button className="tour-x" onClick={onClose} aria-label="Close the tour">×</button>
      </div>
      <h3>{step.title}</h3>
      <p>{step.body}</p>
      <div className="tour-dots" aria-hidden="true">
        {steps.map((s, i) => <i key={s.id} className={i === index ? "on" : ""} />)}
      </div>
      <div className="tour-actions">
        <button className="btn-sm" onClick={onBack} disabled={index === 0}>Back</button>
        <button className="btn-sm" onClick={() => setPlaying((p) => !p)} aria-pressed={playing}>{playing ? "Pause" : "Auto-play"}</button>
        <button className="btn-sm primary" onClick={last ? onClose : onNext}>{last ? "Finish" : "Next"}</button>
      </div>
    </aside>
  );
}
