import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { bodyRegions, regionFacesCamera, type BodyHotspot } from '../domain/bodyRegions';

export interface BodyScene { rotate: (degrees: number) => void; dispose: () => void }

/** Local, generic anatomy. Named meshes are retained for future raycast selection. */
export function createBodyScene(host: HTMLElement, onReady: () => void, onError: () => void, onHotspots?: (points: BodyHotspot[]) => void): BodyScene {
  if (!('WebGL2RenderingContext' in window)) throw new Error('WebGL2 is unavailable.');
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.domElement.setAttribute('aria-hidden', 'true');
  host.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1.2, 1.2, 1.2, -1.2, 0.01, 50);
  camera.position.set(0, 0, 6);
  const pivot = new THREE.Group();
  scene.add(pivot);
  scene.add(new THREE.HemisphereLight(0xcaf5ff, 0x17314c, 2.2));
  const key = new THREE.DirectionalLight(0xd2f6ff, 2.8);
  key.position.set(-3, 4, 6); scene.add(key);
  const rim = new THREE.DirectionalLight(0x47c9ff, 2.2);
  rim.position.set(3, 1, -4); scene.add(rim);
  let disposed = false;
  let lost = false;
  let modelWidth = 1;
  let angle = 0;
  const anchors: { region: typeof bodyRegions[number]; point: THREE.Vector3 }[] = [];
  const materials = new Set<THREE.Material>();
  const geometries = new Set<THREE.BufferGeometry>();
  const draw = () => {
    if (disposed || lost) return;
    pivot.updateMatrixWorld(true);
    renderer.render(scene, camera);
    onHotspots?.(anchors.map(({ region, point }) => {
      const screen = point.clone().applyMatrix4(pivot.matrixWorld).project(camera);
      return { id: region.id, x: (screen.x + 1) * 50, y: (1 - screen.y) * 50,
        visible: regionFacesCamera(region.face, angle) && Math.abs(screen.x) < 0.96 && Math.abs(screen.y) < 0.98 };
    }));
  };
  const resize = () => {
    if (disposed) return;
    const width = Math.max(1, host.clientWidth), height = Math.max(1, host.clientHeight);
    const aspect = width / height;
    const halfHeight = Math.max(1.055, modelWidth * 0.55 / aspect);
    camera.left = -halfHeight * aspect; camera.right = halfHeight * aspect;
    camera.top = halfHeight; camera.bottom = -halfHeight;
    camera.updateProjectionMatrix(); renderer.setSize(width, height); draw();
  };
  const observer = new ResizeObserver(resize); observer.observe(host);
  const contextLost = (event: Event) => { event.preventDefault(); lost = true; if (!disposed) onError(); };
  renderer.domElement.addEventListener('webglcontextlost', contextLost);
  const disposeModel = (root: THREE.Object3D) => root.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    object.geometry.dispose();
    (Array.isArray(object.material) ? object.material : [object.material]).forEach(material => material.dispose());
  });
  new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).load(
    `${import.meta.env.BASE_URL}models/human/body.glb`,
    gltf => {
      if (disposed || lost) { disposeModel(gltf.scene); return; }
      const model = gltf.scene;
      model.updateMatrixWorld(true);
      const bounds = new THREE.Box3().setFromObject(model);
      const size = bounds.getSize(new THREE.Vector3());
      const center = bounds.getCenter(new THREE.Vector3());
      // Anchor in the model's original coordinates, then center with the figure.
      // CSS positions are projected from this 3D point after every rotation/resize.
      for (const region of bodyRegions) {
        const mesh = model.getObjectByName(region.mesh);
        if (!mesh) continue;
        const point = new THREE.Box3().setFromObject(mesh).getCenter(new THREE.Vector3());
        point.add(new THREE.Vector3(...region.offset)).sub(center);
        anchors.push({ region, point });
      }
      model.position.sub(center);
      const scale = 2 / size.y;
      pivot.scale.setScalar(scale); modelWidth = Math.max(size.x, size.z) * scale;
      model.traverse(object => {
        if (!(object instanceof THREE.Mesh)) return;
        geometries.add(object.geometry);
        const oldMaterials = Array.isArray(object.material) ? object.material : [object.material];
        oldMaterials.forEach(material => material.dispose());
        // Use a restrained x-ray palette; this is an illustration, never a health-state color map.
        let system = object.parent;
        while (system?.parent && !['skin','skeleton','muscles','organs','vessels','nerves'].includes(system.name)) system = system.parent;
        const layer = system?.name ?? '';
        const name = object.name.toLowerCase();
        object.visible = !['muscles','nerves'].includes(layer)
          && !/testis|penis|prostate|scrot|seminal|bladder|urethra/.test(name);
        const skin = layer === 'skin';
        const bone = layer === 'skeleton';
        const vessel = layer === 'vessels';
        const heart = name === 'heart';
        const lung = name.startsWith('lung');
        const vein = /vein|vena/.test(name);
        const opacity = skin ? 0.13 : bone ? 0.35 : vessel || heart ? 1 : lung ? 0.5 : 0.35;
        const color = skin ? 0x65c6ed : bone ? 0x93d3e8 : heart ? 0xf26f6c
          : vessel ? (vein ? 0x4c9df7 : 0xe97078) : lung ? 0xaea3d9 : 0x7799b8;
        const material = new THREE.MeshPhongMaterial({ color, transparent: opacity < 1,
          opacity, shininess: 55, depthWrite: opacity === 1,
          emissive: heart ? 0x411514 : 0x05121e, side: THREE.DoubleSide });
        materials.add(material); object.material = material;
        object.renderOrder = skin ? 3 : bone ? 1 : 0;
      });
      pivot.add(model); resize(); onReady();
    }, undefined, () => { if (!disposed) onError(); },
  );
  resize();
  return {
    rotate(degrees) { angle = degrees; pivot.rotation.y = THREE.MathUtils.degToRad(degrees); draw(); },
    dispose() {
      disposed = true; observer.disconnect();
      renderer.domElement.removeEventListener('webglcontextlost', contextLost);
      geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose());
      renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove();
    },
  };
}
