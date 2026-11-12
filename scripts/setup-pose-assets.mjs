#!/usr/bin/env node
/**
 * Adds the MediaPipe pose tracker files to public/mediapipe/ so Movement can measure joint angles.
 *
 * NOTHING is downloaded unless you pass --yes. Without it, this prints exactly what would be fetched and stops.
 *   npm run setup:pose           (shows the plan)
 *   npm run setup:pose -- --yes  (downloads, after you have approved the sources and sizes below)
 */
import { execFileSync } from "node:child_process";
import { copyFileSync, cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const PACKAGE = "@mediapipe/tasks-vision@1.2.3";
const MODEL_URL = "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task";
const MODEL_BYTES = 5_777_746;
const target = resolve("public/mediapipe");

if (!process.argv.includes("--yes")) {
  console.log(`Plan (nothing downloaded yet):
  1. npm pack ${PACKAGE}  -> about 31 MB unpacked, in a temporary folder (not added to node_modules or package.json)
     copy only vision_bundle.mjs and the wasm/ folder into public/mediapipe/
  2. download ${MODEL_URL}
     -> pose_landmarker_lite.task, ${MODEL_BYTES.toLocaleString()} bytes (about 5.8 MB)
Files go to ${target}. Decide whether to commit them; the app works without them (motion-based fallback).
Run again with --yes to approve.`);
  process.exit(0);
}

const work = mkdtempSync(join(tmpdir(), "pose-assets-"));
try {
  console.log(`Fetching ${PACKAGE} ...`);
  execFileSync("npm", ["pack", PACKAGE, "--silent"], { cwd: work, stdio: ["ignore", "pipe", "inherit"] });
  const tarball = readdirSync(work).find((name) => name.endsWith(".tgz"));
  if (!tarball) throw new Error("npm pack produced no tarball.");
  execFileSync("tar", ["-xzf", tarball], { cwd: work });
  const pkg = join(work, "package");
  if (!existsSync(join(pkg, "vision_bundle.mjs")) || !existsSync(join(pkg, "wasm"))) throw new Error("Unexpected package layout: vision_bundle.mjs or wasm/ not found. Nothing was copied.");
  mkdirSync(target, { recursive: true });
  copyFileSync(join(pkg, "vision_bundle.mjs"), join(target, "vision_bundle.mjs"));
  cpSync(join(pkg, "wasm"), join(target, "wasm"), { recursive: true });

  console.log("Downloading the pose model ...");
  const response = await fetch(MODEL_URL);
  if (!response.ok) throw new Error(`Model download failed: HTTP ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length !== MODEL_BYTES) throw new Error(`Model size ${bytes.length} did not match the expected ${MODEL_BYTES}. Not saved.`);
  writeFileSync(join(target, "pose_landmarker_lite.task"), bytes);
  console.log(`Done. Files in ${target}:`);
  for (const name of readdirSync(target)) console.log(`  ${name}${statSync(join(target, name)).isFile() ? ` (${statSync(join(target, name)).size} bytes)` : "/"}`);
} catch (error) {
  console.error(`Setup stopped: ${error.message}`);
  process.exitCode = 1;
} finally {
  rmSync(work, { recursive: true, force: true });
}
