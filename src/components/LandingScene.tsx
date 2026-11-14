import { useEffect, useRef } from "react";

/**
 * Full-page space backdrop for the start page: a drifting star field (canvas), a glowing Earth horizon,
 * orbit rings with moving satellites, a floating NASA astronaut and occasional shooting stars. Decorative only; all motion stops for people who prefer reduced motion.
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
    <div className="landing-ship-path">
      <svg className="landing-ship" viewBox="0 0 140 48" width="140" height="48">
        <defs>
          <linearGradient id="ship-flame" x1="1" x2="0"><stop offset="0" stopColor="#ffffff" /><stop offset=".25" stopColor="#7ff0e4" /><stop offset="1" stopColor="#7ff0e4" stopOpacity="0" /></linearGradient>
          <linearGradient id="ship-hull" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#f4fbff" /><stop offset="1" stopColor="#9fb7c6" /></linearGradient>
        </defs>
        <path className="landing-ship-flame" d="M0 24 Q30 17 52 21 L52 27 Q30 31 0 24 Z" fill="url(#ship-flame)" />
        <path d="M60 14 L66 4 L80 14 Z M60 34 L66 44 L80 34 Z" fill="#5fc9c0" />
        <path d="M52 16 L104 14 Q132 18 138 24 Q132 30 104 34 L52 32 Q48 24 52 16 Z" fill="url(#ship-hull)" />
        <path d="M104 14 Q132 18 138 24 L104 24 Z" fill="#ffffff" fillOpacity=".55" />
        <ellipse cx="114" cy="22" rx="8" ry="4.5" fill="#123247" />
        <ellipse cx="116" cy="21" rx="3" ry="1.4" fill="#7ff0e4" fillOpacity=".8" />
        <rect x="52" y="18" width="4" height="12" rx="1.5" fill="#5f7a8a" />
      </svg>
    </div>
    <div className="landing-earth" />
    {/* Separate layer so the photo's black sky blends into the star field (screen blend). */}
    <div className="landing-astronaut-layer"><div className="landing-astronaut-wrap"><div className="landing-astronaut" /></div></div>
    <div className="landing-orbit-system">
      <div className="landing-orbit landing-orbit-a"><span className="landing-satellite" /></div>
      <div className="landing-orbit landing-orbit-b"><span className="landing-satellite landing-satellite-small" /></div>
    </div>
  </div>;
}
