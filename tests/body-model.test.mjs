import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { Box3, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { bodyRegions } from '../src/domain/bodyRegions.ts';

test('bundled full-body model decodes with local meshopt and preserves anatomy names', async () => {
  const data = await readFile(new URL('../public/models/human/body.glb', import.meta.url));
  assert.equal(createHash('sha256').update(data).digest('hex'), '25248bef02f0ca43eedbd25231f8b6f9681865a57016f9d5e352d407407336c7');
  const gltf = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder)
    .parseAsync(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength), '');
  gltf.scene.updateMatrixWorld(true);
  for (const name of ['skin', 'skeleton', 'heart', 'lung_l', 'lung_r', 'vessels']) assert.ok(gltf.scene.getObjectByName(name), name);
  for (const region of bodyRegions) assert.ok(gltf.scene.getObjectByName(region.mesh), `anchor mesh for ${region.label}`);
  const bounds = new Box3().setFromObject(gltf.scene);
  const size = bounds.getSize(new Vector3());
  assert.ok(Math.abs(bounds.min.y) < 0.001, 'feet on ground');
  assert.ok(size.y > 1.6 && size.y < 2, 'complete adult body in meters');
  assert.ok(size.x > 0.5 && size.x < 1, 'full width present');
  gltf.scene.traverse(object => {
    if (object.isMesh) { object.geometry.dispose(); (Array.isArray(object.material) ? object.material : [object.material]).forEach(m => m.dispose()); }
  });
});
