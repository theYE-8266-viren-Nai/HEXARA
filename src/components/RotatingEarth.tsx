import { useEffect, useRef } from "react";

const FULL_TURN_SECONDS = 120;

export type EarthTextureMode = "navy" | "nasa";

export function RotatingEarth({ mode }: { mode: EarthTextureMode }) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let disposed = false;
    let frame = 0;
    let resizeObserver: ResizeObserver | undefined;
    let renderer: import("three").WebGLRenderer | undefined;
    let geometry: import("three").SphereGeometry | undefined;
    let material: import("three").MeshBasicMaterial | undefined;
    let texture: import("three").Texture | undefined;

    void import("three").then((THREE) => {
      if (disposed) return;
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
      camera.position.z = 3.45;
      try {
        renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "low-power" });
      } catch {
        return;
      }
      renderer.setClearColor(0x000000, 0);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      host.appendChild(renderer.domElement);

      const textureUrl = mode === "nasa" ? "/images/nasa-blue-marble-texture.png?v=1" : "/images/orbitwell-earth-texture-natural.png?v=2";
      texture = new THREE.TextureLoader().load(textureUrl);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
      geometry = new THREE.SphereGeometry(1, 72, 72);
      material = new THREE.MeshBasicMaterial({ map: texture });
      const earth = new THREE.Mesh(geometry, material);
      earth.rotation.y = -0.8;
      const axis = new THREE.Group();
      axis.rotation.z = 0;
      axis.add(earth);
      scene.add(axis);

      const resize = () => {
        const size = Math.max(1, host.clientWidth);
        renderer?.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer?.setSize(size, size, false);
        camera.aspect = 1;
        camera.updateProjectionMatrix();
      };
      resizeObserver = new ResizeObserver(resize);
      resizeObserver.observe(host);
      resize();

      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const startedAt = performance.now();
      const render = (now: number) => {
        if (disposed) return;
        if (!reduceMotion) earth.rotation.y = -0.8 + ((now - startedAt) / (FULL_TURN_SECONDS * 1000)) * Math.PI * 2;
        renderer?.render(scene, camera);
        frame = requestAnimationFrame(render);
      };
      frame = requestAnimationFrame(render);
    });

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      resizeObserver?.disconnect();
      geometry?.dispose();
      material?.dispose();
      texture?.dispose();
      renderer?.dispose();
      renderer?.domElement.remove();
    };
  }, [mode]);

  return <div ref={hostRef} className="journal-earth-globe" aria-hidden="true" />;
}
