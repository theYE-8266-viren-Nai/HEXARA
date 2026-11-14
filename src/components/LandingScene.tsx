import { useEffect, useRef } from "react";
import { HeartPulse, Moon, Radiation } from "lucide-react";

/**
 * Full-page space backdrop for the start page: a drifting star field (canvas), a glowing Earth horizon,
 * orbit rings with moving satellites, a floating NASA astronaut, occasional shooting stars and a few example
 * readouts that show what OrbitWell does. Decorative only; all motion stops for people who prefer reduced motion.
 */
export function LandingScene() {
  const root = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);

  // Star field: three depth layers that drift slowly and twinkle.
  useEffect(() => {
    const element = canvas.current;
    const context = element?.getContext?.("2d");
    if (!element || !context) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    let width = 0, height = 0, frame = 0;
    let stars: Array<{ x: number; y: number; r: number; depth: number; phase: number; speed: number }> = [];
    const seed = (() => { let value = 7; return () => { value = (value * 16807) % 2147483647; return value / 2147483647; }; })();
    const resize = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      width = element.clientWidth; height = element.clientHeight;
      element.width = width * ratio; element.height = height * ratio;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      const count = Math.round((width * height) / 5200);
      stars = Array.from({ length: count }, () => {
        const depth = seed() < 0.7 ? 0.25 : seed() < 0.85 ? 0.55 : 1;
        return { x: seed() * width, y: seed() * height, r: 0.35 + depth * 1.05, depth, phase: seed() * Math.PI * 2, speed: 0.4 + seed() * 1.2 };
      });
    };
    const draw = (time: number) => {
      context.clearRect(0, 0, width, height);
      for (const star of stars) {
        const drift = reduce ? 0 : time * 0.004 * star.depth;
        const x = (star.x - drift) % width;
        const alpha = reduce ? 0.7 : 0.35 + 0.55 * (0.5 + 0.5 * Math.sin(time * 0.001 * star.speed + star.phase));
        context.globalAlpha = alpha * (0.45 + star.depth * 0.55);
        context.fillStyle = star.depth === 1 ? "#dff8ff" : "#b9d9ee";
        context.beginPath();
        context.arc(x < 0 ? x + width : x, star.y, star.r, 0, Math.PI * 2);
        context.fill();
      }
      context.globalAlpha = 1;
      if (!reduce) frame = requestAnimationFrame(draw);
    };
    resize();
    draw(0);
    if (!reduce) frame = requestAnimationFrame(draw);
    window.addEventListener("resize", resize);
    return () => { cancelAnimationFrame(frame); window.removeEventListener("resize", resize); };
  }, []);

  // Gentle mouse parallax for the scene layers.
  useEffect(() => {
    const element = root.current;
    if (!element || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const move = (event: PointerEvent) => {
      const x = event.clientX / window.innerWidth - 0.5;
      const y = event.clientY / window.innerHeight - 0.5;
      element.style.setProperty("--px", x.toFixed(3));
      element.style.setProperty("--py", y.toFixed(3));
    };
    window.addEventListener("pointermove", move);
    return () => window.removeEventListener("pointermove", move);
  }, []);

  return <div ref={root} className="landing-scene" aria-hidden="true">
    <canvas ref={canvas} className="landing-stars" />
    <div className="landing-nebula" />
    <span className="landing-shooting landing-shooting-one" />
    <span className="landing-shooting landing-shooting-two" />
    <div className="landing-earth" />
    {/* Separate layer so the photo's black sky blends into the star field (screen blend). */}
    <div className="landing-astronaut-layer"><div className="landing-astronaut-wrap"><div className="landing-astronaut" /></div></div>
    <div className="landing-orbit-system">
      <div className="landing-orbit landing-orbit-a"><span className="landing-satellite" /></div>
      <div className="landing-orbit landing-orbit-b"><span className="landing-satellite landing-satellite-small" /></div>
      <div className="landing-readout landing-readout-heart">
        <span className="landing-readout-icon"><HeartPulse size={16} /></span>
        <div><p className="landing-readout-label">Heart rate</p><p className="landing-readout-value">72 <small>bpm</small></p><p className="landing-readout-note is-good">Within your usual 64–74</p></div>
        <svg className="landing-ecg" viewBox="0 0 120 32"><path d="M0 18h28l6-12 8 24 7-30 7 22 5-4h59" /></svg>
      </div>
      <div className="landing-readout landing-readout-sleep">
        <span className="landing-readout-icon"><Moon size={16} /></span>
        <div><p className="landing-readout-label">Sleep · this week</p><p className="landing-readout-value">5.8 <small>h</small></p><p className="landing-readout-note is-watch">Below your usual 3 nights in a row</p></div>
        <span className="landing-bars"><i /><i /><i /><i /><i className="is-low" /><i className="is-low" /><i className="is-low" /></span>
      </div>
      <div className="landing-readout landing-readout-rad">
        <span className="landing-readout-icon"><Radiation size={16} /></span>
        <div><p className="landing-readout-label">Radiation dose</p><p className="landing-readout-value">0.42 <small>mSv/day</small></p><p className="landing-readout-note is-good">Within usual range</p></div>
      </div>
      <p className="landing-example-tag">Example readings · synthetic data</p>
    </div>
  </div>;
}
