# Body tracking for the Movement check

Simulated data only. Not medical advice. Not diagnostic.

Movement works without anything below: it uses a motion-based check. Adding the tracker lets Horizon measure joint
angles, count repetitions more reliably, and report left/right range of movement. All of it runs in your browser.
Video frames are turned into numbers on your device and discarded. Nothing is recorded, uploaded or saved.

## What gets added (needs your approval first)

| What | Source | Size |
| --- | --- | --- |
| `vision_bundle.mjs` and `wasm/` files | npm package `@mediapipe/tasks-vision` 1.2.3 (registry.npmjs.org) | package is about 31 MB unpacked; only these files are copied |
| `pose_landmarker_lite.task` (model) | `https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task` | 5,777,746 bytes (about 5.8 MB) |

The package is fetched into a temporary folder and is **not** added to `node_modules` or `package.json`. The model size was
read from the server's headers; the other file names and sizes could not be checked without downloading, so the script
stops with a clear message if the package layout is not what it expects.

## Steps (you run these)

1. See the plan; this downloads nothing:

```bash
npm run setup:pose
```

2. If you approve the sources and sizes above:

```bash
npm run setup:pose -- --yes
```

3. Start the app (`npm run dev`), open Movement, choose your camera, and continue. You should see
   "Body tracking is ready". If you see "Body tracking is not available here", the files are missing or could not load
   and the motion-based check is used instead.

Decide whether to commit `public/mediapipe/`. It is needed for any deployed copy of the app to use body tracking.

## Webcam trial checklist

Good light, about 2 metres from the camera, whole body in frame:

- Sit-to-stand: do 5 slow ones. The repetition count should be 5, plus or minus 1.
- Single-leg balance (hold a chair): it should report sway and nothing medical.
- Turn the light off: quality should read poor.
- Hold a phone upright: it should warn that your arms or legs may be cropped.
- Turn on "Show body points on the preview": the points should follow you.
- DevTools, Network tab: no video or image requests should leave your computer.
