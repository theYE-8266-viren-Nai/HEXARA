# Home interactive body viewer

Future, Active, and Retired Home present a large generic full-body model directly on the page,
without an enclosing card or rectangular canvas background. It remains visible
before the wearable connection gate. Each stage exposes its stage-appropriate
Movement layer.
The standalone Future and Active signal grids are removed; readings open
only after selecting a region, in a panel beside the figure on desktop and below
it on narrower screens. All body-region signal panels open to the right. Existing alert
decisions and thresholds are unchanged.

## Region selection

Green glowing markers follow named anatomical meshes through rotation and
resize using 3D-to-screen projection. Hover or focus shows a label. Select a dot
to open its panel; select it again, press Escape, or use Close to dismiss it.
Only one panel opens at a time. A secondary region chooser supports touch,
keyboard, and browsers without WebGL. Green denotes interactivity, never health.

The `Signals` and `Movement` controls keep two separate marker layers. Active
Movement exposes shoulder mobility and reach-and-return only. Retired Movement
exposes exactly four practices: shoulder mobility, reach-and-return,
sit-to-stand, and single-leg balance. Historical standing-posture records remain
readable but cannot start a new session.

| Region | Content |
| --- | --- |
| Heart | Current heart rate and HRV |
| Brain | Sleep context, explicitly not brain activity |
| Lungs | SpO2 context, explicitly not a lung-function measurement |
| Chest | Heart rate and SpO2 context, no direct chest assessment |
| Leg muscle | No direct sensor; optional Movement route |
| Spine | No direct sensor; optional Movement route |
| Back muscle | No direct sensor; optional Movement route |
| Skin | Skin temperature and whole-body dosimeter context |

| Movement region | Practice | Model mesh |
| --- | --- | --- |
| Shoulder | Shoulder mobility | `shoulder_muscles_l` |
| Arm | Reach-and-return | `upper_arm_muscles_l` |
| Spine | Sit-to-stand (Earth) / Anchored lower-body flexion (Active) | `back_muscles_r` |
| Hip | Sit-to-stand (Earth) / Anchored lower-body flexion (Active) | `pelvis` |
| Knee | Sit-to-stand (Earth) / Anchored lower-body flexion (Active) | `patella_l` |
| Legs | Sit-to-stand (Earth) / Anchored lower-body flexion (Active) | `quadriceps_l` |
| Ankle | Single-leg balance | `foot_l` |

Selecting a Movement marker shows the newest cloud-saved derived summary for
that task, or opens Movement with the task preselected. `Save and show on body`
returns to Home only after Supabase confirms the write, then opens the mapped
region. A saved sit-to-stand result focuses the Spine, Hip, Knee, and Legs
markers together and shows one combined observation panel. Failed writes remain
on the result screen for retry. The panel never shows symptom notes and never
interprets movement as strength, spinal health, injury risk, stability, readiness,
or diagnosis. Cyan means saved context exists; amber means partial capture or
limited tracking quality, not a health warning.

Spine/back-muscle dots appear on the back; rotate to either 180-degree limit to
reach them. Front-only markers hide on the back to avoid showing through the body.
No values are fabricated for regions with no corresponding sensor. Paired/loading,
offline/disconnected, and poor-quality states withhold readings; stale values are
labelled, and insufficient-baseline readings omit the personal comparison.

## Controls and rendering

- Drag horizontally (mouse, touch, pen); vertical touch scrolling remains enabled.
- Use the -180 to +180 slider below the figure. The filled Choose a body region button sits below the view indicator and opens a vertical list beside the figure. The list stays open through selection and is hidden only by toggling the chooser button. Keyboard arrows rotate in 15-degree steps; Home resets to front. Rotation buttons and the inline anatomy credit line are removed; attribution remains bundled in the model credit files.
- Focus the viewer and press Left/Right or Home. Rotation is clamped at both limits.
- The Three.js scene loads only on Active and Retired Home. It renders on load, rotation,
  and resize; there is no continuous animation loop or idle auto-rotation.
- Pixel ratio is capped at 1.75. An orthographic camera fits the full body even
  in narrow containers. Geometry/materials, resize observers, canvas and WebGL
  context are released on unmount. Late model loads are disposed.
- WebGL2, load, or context-loss failures show an explicit retry state; they do
  not block the existing signal cards. The model and decoder are served locally.

## Asset and credits

Reference for the interaction: https://humanome.co/about (the user's showcase
link could not be fetched directly). No Humanome source code or assets were copied.

`public/models/human/body.glb` is the unmodified male model from npm package
`open-anatomy-3d@0.1.0`, downloaded using `npm pack` from the official npm registry.
Source: https://github.com/MervinR07/open-anatomy-3d

SHA-256: `25248bef02f0ca43eedbd25231f8b6f9681865a57016f9d5e352d407407336c7`.
It contains 128 named meshes and uses local Meshopt decoding. The original
attribution and license files are bundled alongside the model and linked in the UI.
BodyParts3D copyright DBCLS; adapted by open-anatomy-3d, CC BY 4.0.
The model file is unchanged. OrbitWell adjusts runtime display colors, transparency,
and layer visibility to show skin, skeleton, organs and vessels. This illustration
is not the user's body scan or a diagnostic view. Named structures (including
`heart`) are retained for future click-to-signal integration.

## Verification

- Viewer tests cover pointer rotation, keyboard/slider controls, bounds, reset,
  cleanup, unsupported-WebGL retry, stage-specific Movement regions, task
  routing, and saved-result rendering using a mocked renderer.
- `node --import ./tests/register.mjs --test tests/body-model.test.mjs` decodes the actual bundled asset and
  verifies integrity, full-body bounds, and all signal and Movement anchor mesh names.
- App tests check existing stage navigation; `npm run build` type-checks and bundles.
- Real browser visual checks of materials, desktop/mobile framing, and GPU
  rendering are still needed when a browser connection is available.
