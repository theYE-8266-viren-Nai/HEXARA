import { useRef, useState, type PointerEvent } from "react";
import { Activity, ArrowUpRight, Pause, Play } from "lucide-react";

const motionProperties = ["--orbital-shift-x", "--orbital-shift-y", "--orbital-light-x", "--orbital-light-y"];

export function OrbitalVisual() {
  const visualRef = useRef<HTMLElement>(null);
  const [paused, setPaused] = useState(false);

  const resetMotion = () => {
    const style = visualRef.current?.style;
    if (style) motionProperties.forEach((property) => style.removeProperty(property));
  };

  const moveScene = (event: PointerEvent<HTMLElement>) => {
    if (paused || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    const x = Math.min(1, Math.max(0, (event.clientX - bounds.left) / bounds.width));
    const y = Math.min(1, Math.max(0, (event.clientY - bounds.top) / bounds.height));
    const style = event.currentTarget.style;
    style.setProperty("--orbital-shift-x", `${((x - .5) * 24).toFixed(1)}px`);
    style.setProperty("--orbital-shift-y", `${((y - .5) * 18).toFixed(1)}px`);
    style.setProperty("--orbital-light-x", `${Math.round(x * 100)}%`);
    style.setProperty("--orbital-light-y", `${Math.round(y * 100)}%`);
  };

  return <figure ref={visualRef} className={`orbital-visual${paused ? " is-paused" : ""}`} onPointerMove={moveScene} onPointerLeave={resetMotion} onPointerCancel={resetMotion}>
    <img className="orbital-photo" src="/images/nasa-spacewalk.jpg" alt="NASA astronaut Bruce McCandless floating above the blue curve of Earth" fetchPriority="high" />
    <div className="orbital-shade" />
    <div className="orbital-topline"><span><span className="status-dot" /> THE HUMAN SIDE OF EXPLORATION</span><span className="orbital-top-actions"><span className="orbital-hint">MOVE TO EXPLORE</span><button type="button" className="orbital-motion-toggle" aria-label={paused ? "Resume orbital motion" : "Pause orbital motion"} title={paused ? "Resume orbital motion" : "Pause orbital motion"} onClick={() => { if (!paused) resetMotion(); setPaused(!paused); }}>{paused ? <Play size={14} aria-hidden="true" /> : <Pause size={14} aria-hidden="true" />}</button></span></div>
    <div className="orbit-path orbit-path-one" aria-hidden="true" /><div className="orbit-path orbit-path-two" aria-hidden="true" />
    <span className="orbital-marker" aria-hidden="true"><span /> A LITTLE PERSPECTIVE</span>
    <div className="orbital-caption"><p>Far from ordinary.<br /><span>Closer to yourself.</span></p><div className="visual-health-card"><span className="health-card-icon"><Activity size={21} aria-hidden="true" /></span><div><span>HUMAN, FIRST.</span><p>Small signals. Meaningful context.</p></div><svg viewBox="0 0 82 28" fill="none" aria-hidden="true"><path d="M1 17h17l5-7 6 15L38 2l8 22 5-9 5 2h25" stroke="currentColor" strokeWidth="1.5" /></svg></div></div>
    <figcaption>STS-41B · Earth orbit <a href="https://www.nasa.gov/image-article/astronaut-bruce-mccandless-performs-the-first-untethered-spacewalk/" target="_blank" rel="noreferrer">Photography: NASA <ArrowUpRight size={11} aria-hidden="true" /></a></figcaption>
  </figure>;
}
