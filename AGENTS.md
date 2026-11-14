# Horizon Agent Guide

Horizon is a research demo health companion for space travelers. It uses synthetic data only and is not a medical device.

## 🗺️ Project Status & Context Trackers

### 🟢 Currently Built

- **Pattern card simplification (2026-11-14):** Removed the abstract visual pattern-score meter and numeric scale from Home/Trends. The card now shows the plain-language personal-pattern result and a compact “30-day personal comparison” summary; the numeric score remains internal for explanation logic only. Focused PatternCard tests (8) and production build pass.

- **Monthly personal history in Trends (2026-11-14):** Trends now aggregates the available 180-day synthetic observations into UTC monthly summaries with averages, ranges, observed days, personal-pattern direction, data quality, and notable-day counts from the existing alert rules. The newest month is expanded by default; older months are collapsible. Explain this pattern sends only bounded monthly summaries to the Supabase Edge Function/OpenRouter path, never raw readings, notes, symptoms, IDs, or device data. The deterministic fallback also includes monthly context.
- **Monthly-history verification (2026-11-14):** Focused aggregation, explanation-contract, fallback, and UI tests pass; the full frontend suite has 458 passing tests, `npm run build` passes, and `git diff --check` passes. The existing Vite large-chunk warning remains.

- **Movement-to-3D body synchronization (2026-11-14):** Active and Retired Home now separate `Signals` and `Movement` body layers. Active exposes shoulder mobility and reach-and-return; Retired exposes those plus sit-to-stand and single-leg balance; Future remains unchanged. Body markers route to a preselected practice, and `Save and show on body` returns to Home only after Supabase confirms the derived-summary write, opens the mapped region, and restores the newest owner-filtered cloud result after refresh. Historical `standing_posture` data remains readable but the task is no longer offered. Home requests no symptom/note payload and never infers strength, injury, stability, readiness, or diagnosis.
- **Movement awareness linked regions (2026-11-14):** Retired sit-to-stand and Active anchored lower-body flexion map to separate Movement-layer Spine, Hip, Knee, and Legs markers using camera-derived repetitions, joint-angle ranges, left/right difference, pauses, tracking quality, and personal comparison only. A confirmed cloud save returns Home with all four regions focused and one combined movement panel. Active users receive the anchored task with a foot-rest/handrail reminder; Earth-based users retain sit-to-stand. Movement copy emphasizes noticing control and comfort, following approved conditioning, and stopping for pain, dizziness, or unsteadiness; it does not predict injury or measure spine, bone, muscle, or joint health. Future remains unchanged, and no migration was added.
- **Movement synchronization verification (2026-11-14):** 452 frontend tests, 10 backend tests, the bundled-model mesh test, TypeScript/production build, and live owner/cross-user/signed-out `visual_checks` RLS checks pass. Real-webcam and connected-browser visual checks remain pending; Vite retains its existing large-chunk warning.
- **Pattern card remounted (2026-11-14):** Restored the "Pattern across signals" card and its "Explain this pattern" button on both Home and Trends for all three stages, at the user's request (reversing the 2026-11-13/14 removals). The wiring follows the earlier verified version: `useAssessment` over completed days plus `createExplainRepository`/`buildExplainRequest`. The button stays on demand, the deterministic score and drivers are computed before any cloud call, and any cloud failure falls back to the built-in text. `HomeView` and `TrendsView` gained an optional `pattern` slot rendered inside their own layouts (above the Home footer, under the Trends header) so the card keeps the page padding instead of sitting outside it. Two `App.test.tsx` cases that asserted the card's absence now assert it is present: Active has the local 30-day history so it scores the pattern and offers the button, while demo-only Future/Retired profiles show "Pattern view paused" because they have no stored history. Merged with the Movement-to-3D body work; `HomeView` now takes both the `movement*`/`bodyFocus` props and the `pattern` slot. Verification on the merge: 452 tests, `tsc -b`, `npm run build` and `git diff --check` pass. No browser visual check was run.
- **Header wearable connection (2026-11-14):** Moved the Active unpaired-device box above the Usual day indicator in the header. Restored the original outlined Connect wearables switch and dropdown styling; removed the filled cyan override. Prevented duplicate unpaired prompts below the figure. Three targeted pairing/reconnect tests, production build and `git diff --check` pass; connected-browser visual QA remains pending.
- **Restored local UI changes (2026-11-14):** Reconciled saved edits with main through `ddc8ba5`: persistent vertical region chooser below orientation, no rotation buttons or inline anatomy credit line, all signal panels on the right, no PatternCard mounted on Home or Trends in any stage, and a prominent sentence-free unpaired card. Active connection uses the current per-device controls; paired controls remain in the header. Latest Movement/body mappings and monthly history are preserved. Verification: 71 affected tests passed in the combined run; the remaining reconnect test passed after updating its navigation, and all 12 viewer tests passed separately. Production build and `git diff --check` pass. Browser visual QA still needs a connected browser.
- **Body/Home main integration (2026-11-14):** Merged latest main through `d9c2019`, preserving account profiles, stage-aware Movement and wellbeing feedback alongside the body viewer and Home cleanup. Verified 64 App/Home/viewer/domain tests and the actual-model decoding test, then 29 ORBIT/Home/viewer tests after the final main merge; production build and `git diff --check` pass. No integration blocker; browser visual QA remains pending a connected browser.
- **Home cleanup (2026-11-14):** Removed Pattern across signals and Recent activity from Home in all three stages, including unused app-level assessment/explanation wiring. Recovery alerts remain intact. Verification: 49 affected App/Home tests, 8 viewer tests, production build and `git diff --check` pass. No implementation blocker; connected-browser visual QA remains pending.
- **Frontend foundation:** React + Vite + TypeScript scaffold is created.
- **Body signal panel placement (2026-11-14):** Brain, Chest, Back muscle and Spine panels open to the figure's left; Heart, Lungs, Leg muscle and Skin open to its right. Narrow layouts keep panels below the figure. All 8 viewer tests, production build and `git diff --check` pass. Connected-browser visual verification remains the next body-viewer check.
- **Active Home interactive body (2026-11-14):** Large centered full-body model on the page without an enclosing card or rectangular background. Eight green selection markers (heart, brain, lungs, chest, leg muscle, spine, back muscle, skin) project from named meshes and follow rotation/resize; hover/focus labels and click-again/Close/Escape dismissal are implemented. Region signals open beside the figure on desktop and below on narrow screens. Removed the standalone Active signal grid and radiation card; Future/Retired views are unchanged. Existing HR/HRV, SpO2, sleep, skin-temperature and dosimeter data are mapped with explicit limits; muscle/spine measurements are not fabricated. Unpaired/loading/unreliable data withholds numbers; stale and insufficient-baseline states remain explicit. Rotation remains -180 to +180 degrees. Verified 61 UI/domain tests, 1 actual-model decoding/anchor test, production build, HTTP 200 for app/model/credits, and `git diff --check`. Browser visual/GPU checks remain pending: browser inventory is empty. See `docs/body-viewer.md`.
- **Visible Guidance shortcuts (2026-11-14):** Using OrbitWell, Daily habits, and When readings change now use filled accent buttons with bold labels, larger touch targets, and hover/pressed/focus states in both themes. Removed the three shortcut arrows at the user's request; the subsequent production build and diff check pass. Native section-link behavior is preserved. The 3 guide tests, production build, and `git diff --check` pass; desktop/mobile visual preview remains the next UI check when a browser is connected.
- **Guidance/Trends integration (2026-11-13):** Merged the requested UI changes with current main, preserving the newer OrbitWell branding, Home redesign, and explicit wearable pairing. Resolved the shared-view import/Guidance conflict and aligned guide wording with the current daily check-in. All 49 app/guide tests, production build, and `git diff --check` pass.
- **Active guide simplification (2026-11-13):** Removed the three requested boxes and their orphaned medical check-in shortcut. The 3 guide tests, production build, and `git diff --check` pass. Next UI check remains the desktop/mobile preview when a browser is connected.
- **Active mission guide (2026-11-13):** Expanded only Active Guidance with six functional software shortcuts, expandable sleep/exercise/nutrition/crew/environment topics linked to NASA educational sources, a suggested daily routine and changed-reading follow-up. At the user's request, the Mission procedures come first, medical check-in outline, and About and limits boxes and the medical check-in shortcut were removed. Remaining topic guidance explains mission context, data limits, privacy, and no-automatic-notification behavior; the app-wide disclaimer remains. Future/Retired Guidance is unchanged. All 49 app/guide tests, `npm run build`, and `git diff --check` pass; the existing bundle-size warning remains. Browser visual QA is pending because the browser inventory is empty.
- **Trends cleanup (2026-11-13):** Removed the Pattern across signals card from Trends for Future, Active, and Retired users. The 46 app tests, production build, and `git diff --check` pass. The full suite had a generated-document CRLF mismatch and a replay-test timeout; replay passed in the isolated app run. Next frontend follow-up remains the companion visual check below; no blocker for this removal.
- **Supabase dependency:** `@supabase/supabase-js` is installed.
- **Supabase client:** Browser client exists in `src/lib/supabase.ts`.
- **Environment setup:** `.env.example` is committed and `.env.local` is ignored.
- **Supabase boundary:** `src/lib/supabase.ts` keeps the browser client available; UI components use repository adapters and retain a deterministic local fallback when cloud configuration is unavailable.
- **Safety disclaimer:** The placeholder page displays: `Simulated data. Not medical advice. Not diagnostic.`
- **Build verification:** `npm run build` passes.
- **Git:** Initial local commit exists and `origin` points to the HEXARA GitHub repository.
- **Agent guidance:** Supabase, Postgres best practices, and security best practices are installed.
- **Workflow definition:** The active-astronaut workflow and the three-stage product flow have been analyzed and converted into the phased roadmap below.
- **Frontend shell:** Responsive navigation, stage selection, dark visual foundation, and the persistent disclaimer are wired into the app.
- **Frontend mock flow:** Active Home, Trends, Wellbeing, Guidance, and Profile views are connected to typed mock data and LocalStorage state.
- **Frontend data-quality states:** Stale, disconnected, and offline simulation scenarios have distinct Home/Trends messaging and next-step guidance.
- **Stage-aware previews:** Home copy now changes for Future, Active, and Retired stages while the Active flow remains primary.
- **Frontend loading boundary:** Scenario changes show an accessible loading state before the selected simulated signals render.
- **Frontend repository boundary:** UI state reads typed profiles and snapshots through repository adapters; components do not query Supabase directly.
- **Wellbeing support action:** The “Talk to a person” panel opens local crew, mission-support, and family-contact options without sending data.
- **Accessible stage shell:** Workspace labels follow the selected stage, and mobile navigation exposes the active page through `aria-current`.
- **Trend alert explanations:** Trends exposes an expandable plain-language reason for the active mock alert.
- **Simulation replay controls:** Profile persists a local seed and replay count, with an accessible replay action for the mock run.
- **Simulation contract:** `DashboardRepository` accepts typed seed and replay controls so a backend adapter can reproduce the same UI contract.
- **Backend contract import:** Agent 1's verified `src/domain/types.ts`, `src/data/repository.ts`, `src/data/synthetic.ts`, and `docs/backend-contract.md` are now present on the frontend branch for adapter integration.
- **Backend-to-dashboard adapter:** `src/lib/backendDashboardRepository.ts` maps backend records into UI metrics/profiles and preserves repository source/warning metadata; alert decisions remain outside the adapter.
- **Active-flow verification:** A cohesive UI test covers Active Home, recovery alert explanation, Trends, and a local wellbeing check-in.
- **Disconnected fallback verification:** The UI test suite verifies the “Data unavailable” label and reason when the simulated source disconnects.
- **Privacy persistence verification:** The UI test suite verifies that a per-category wellbeing privacy toggle persists locally.
- **Offline fallback verification:** The UI test suite verifies that offline Trends show a recovery path instead of stale charts.
- **Frontend verification:** Browser smoke checks confirmed stage switching and Trends navigation; 21 tests, `npm run build`, and `git diff --check` pass after repository integration, NASA context, Future/Retired coverage, and refresh persistence coverage.
- **Backend adapter wiring:** The usual-day app flow now loads profiles and observations through the typed `HorizonRepository`; explicit demo scenarios remain local fixtures, and Home shows the data source and fallback warning.
- **Explainable alert engine:** `src/domain/alertEngine.ts` now evaluates personal 30-day baselines, single-reading and sustained-shift rules, emits plain-language reasons, and ignores exercise heart-rate readings; 16 tests pass.
- **NASA radiation context:** `src/lib/nasaDonki.ts` fetches optional DONKI CME events with browser caching and a labeled mock fallback; Home displays a non-diagnostic Safe/Caution/High radiation context card.
- **Backend quality integration:** The frontend imports backend commit `9294452` and maps repository quality metadata into current, stale, disconnected, offline, and insufficient-baseline UI states.
- **Verified integration branch:** `codex/integration` includes the frontend flow, backend migration/seed scripts, backend replay/data-quality contract, NASA radiation adapter, and combined test scripts.
- **Final verification:** 21 frontend tests, 9 backend tests, production build, live database parity, `git diff --check`, and a local production-server HTTP smoke check (`HTTP 200`, Horizon entrypoint) pass on this branch.
- **Future/Retired guidance previews:** Guidance now includes a locally saved trainee lesson, a non-certifying practice explanation, long-term follow-up placeholders, and a private post-mission reflection.
- **Retired summary preview:** Retired guidance includes locally persisted, selectable synthetic fields for a non-diagnostic conversation summary.
- **About and limits:** Guidance links NASA NTRS and OSDR and states the synthetic, non-diagnostic research-demo limits.
- **Integration verification:** Backend unit tests (9), backend build, and live publishable-key parity checks (4 profiles, 4,320 observations, 12 events) pass; frontend tests (18), build, and diff checks pass.
- **Dark Tech visual system:** The app now uses a black/radial-glow canvas, Inter/system editorial text, monospace metric values, square controls, pill status chips, white card rings, and responsive high-contrast navigation while preserving the safety banner.
- **Visual refresh verification:** 21 frontend tests, `npm run build`, and `git diff --check` pass after the Dark Tech refresh.
- **Editorial motion treatment:** Home now uses a Horizon-colored poster hero, telemetry straps, ruled data rows, and reduced-motion-safe scroll reveal classes inspired by the supplied editorial landing-page brief.
- **Editorial refresh verification:** 21 frontend tests, `npm run build`, and `git diff --check` pass after the editorial scroll-style treatment.
- **Original Horizon palette restored:** The visual system now uses the screenshot palette: deep navy surfaces, cyan primary accent, blue-grey text, purple accent context, rounded dark panels, and preserved amber/green statuses.
- **Palette refresh verification:** 21 frontend tests, `npm run build`, and `git diff --check` pass after restoring the original Horizon colors.
- **Future persistence foundation:** Stage selection now gates the app, anonymous Supabase sessions are restored or created, Future preparation UI includes baseline, practice, and Days 1–14 adaptation flows, and typed cloud persistence adapters plus an RLS migration are present.
- **Space-health UI redesign:** Replaced the oversized landing page with a compact three-stage picker, locally bundled NASA astronaut photography and credit, glass cards, restrained charcoal/cyan colors, smaller type, and consistent desktop/mobile navigation across all views. Metric cards include synthetic sparklines; connection details are expandable.
- **Redesign verification:** 24 frontend tests, `npm run build`, and `git diff --check` pass. Headless Chrome checks covered all main views, recovery alerts, Future/Retired guidance, and 1440/390/320-pixel layouts with no horizontal overflow or uncaught errors. App and image HTTP checks return 200. Vite retains its existing large-bundle warning.
- **Stage-selection test coverage:** UI tests now enter through the required stage picker and cover Future practices/timeline and local check-in restoration after reselecting a stage.
- **Profile navigation icon:** Desktop and mobile navigation now share the `UserRound` person icon for Profile. `npm run build` and `git diff --check` pass.
- **Light and dark appearance:** Landing and workspace headers include an accessible sun/moon toggle. Appearance starts from the device preference, saves explicit choices in LocalStorage, and restores before first paint. Light mode uses warm ivory, white glass cards, ink text, and subdued teal; dark mode keeps charcoal/cyan. Charts, controls, notices, and status colors adapt across all stages.
- **Theme verification:** 27 frontend tests, production build, and diff checks pass. Chrome checks verified both themes at 1440/390/320 pixels, all workspace views, Future/Retired guidance, saved preferences, pre-React restoration, and no horizontal overflow or page errors. Core text/action contrast exceeds 4.5:1 and chart contrast exceeds 3:1 in both palettes. Chart animation is disabled for immediate, stable rendering.
- **Light-mode refinement:** Removed the blue-grey wash and heavy shadows, simplified card and navigation surfaces, and restyled NASA imagery into circular navy space views. The revised light palette passes the build, 27 tests, diff checks, and 1440/390/320-pixel browser checks; artwork/caption spacing and text/chart contrast are verified.
- **Main UI integration:** Fast-forwarded `main` to include all four verified `codex/space-health-ui` commits, through `a93a83c`, at the user's request. Application files match the tested UI branch; no merge conflicts or code changes were needed.
- **Visual Health Check (non-diagnostic):** A Movement view adds a guided webcam practice flow (privacy/limits screen, consent, lighting/framing check, countdown, local frame-difference capture, context check-in, observation summary) with a labelled synthetic demo mode. `src/domain/visualCheck.ts` holds the typed contract, deterministic feature extraction, same-owner-only comparison, crew-medic escalation for reported pain/severe symptoms, a diagnostic-language guard, and the crew summary composer. Frames are never stored; `src/lib/visualCheckRepository.ts` saves derived summaries locally and to `visual_checks` without reporting false success.
- **Stage-selection UI tests:** `src/App.test.tsx` now mocks the Supabase client to `null`, enters a stage from the required selection screen, verifies the offline "selection will not persist" warning, Future non-certifying copy without false cloud-save success, Movement navigation, and refresh behavior (local check-in restored, stage re-selected offline). 44 frontend tests (stable across 3 runs), 9 backend tests, `npm run build`, and `git diff --check` pass.
- **Visual check + redesign integration:** `codex/visual-check` merges `origin/main` (through `e77a7ff`, the glass UI with light/dark themes) with the Movement view. Movement is a sixth item in desktop/mobile navigation (mobile buttons now share the bar width). `src/App.test.tsx` keeps `origin/main`'s `openWorkspace()` helper, mocks the Supabase client so a local `.env.local` cannot trigger real sign-in, and adds a Movement test. The Future view keeps its no-false-success baseline/timeline messaging plus the redesign's `preparation-hero` and `aria-pressed` attributes. 50 frontend tests and `npm run build` pass after the merge; Movement was not browser-checked at 320/390/1440 px.
- **Simulated wearable (live data):** `src/domain/deviceSimulator.ts` produces readings as a pure function of seed, person, and clock time (night/day rhythm, HRV mirroring heart rate, rare SpO₂ dips, short flagged exercise bumps, slow radiation pass pattern, daily-fixed sleep), so values keep changing but never jump or reset on reload. `src/lib/useDeviceStream.ts` runs a staged connection (searching, pairing, syncing, streaming; signal lost and offline from the demo scenarios; stale stops at an old sync) and live ticks, and feeds `DeviceContext`. Home, Trends, Profile, and Guidance read it for the staged loader, a Live/Last sync/Signal lost badge, live dots, and a Disconnect/Reconnect card. Daily history, baselines, and alert logic are unchanged.
- **Future flow:** Future starts with "No device paired" and a Pair button (paired state saved locally), shows "Pre-mission" instead of a mission day, uses a Future demo profile instead of an Active traveler, and offers "Fill from my wearable" in the baseline form (the user still saves it themselves).
- **Simulated wearable verification:** 71 frontend tests (simulator determinism, bounds, smoothness, rhythm, hook phases, UI loader/pairing/disconnect/lost-signal) pass in UTC, Los Angeles, Yangon, and Auckland timezones; `npm run build` and `git diff --check` pass. Browser check at 1440 and 320 px: loader stages, live values moving every few seconds, pairing surviving a reload, six-item mobile nav fits, no horizontal overflow; Movement renders at 320 px.
- **Pattern model (adds to alerts):** `src/domain/anomalyModel.ts` scores how different a day is from the person's own earlier pattern across signals together (robust median/MAD per signal, clipped and shrunk joint spread, Mahalanobis distance, top-3 drivers with direction and percent, sustained-shift lift; exercise heart rate ignored; HRV carries a rough-estimate caveat). The baseline is the 30 days before the most recent 5, so a lasting shift is not absorbed. Levels are neutral (`usual`, `different`, `notably_different`, `insufficient_baseline`). It never changes alert rules or thresholds. `src/lib/useAssessment.ts` picks what to score (stored history, the Recovery-concern demo day 124 of the seed series, or webhook completed days added to history; completed days only; poor or missing data gives no score) and `src/components/PatternCard.tsx` remains available as a standalone component. The pattern card is removed from Home and Trends for Future, Active, and Retired stages; App no longer mounts the assessment or explanation flow.
- **Pattern model verification:** 198 tests pass in UTC, Asia/Yangon and America/Los_Angeles; `npm run build` and `git diff --check` pass. Browser check: usual day reads "Close to your usual pattern" (30 days, 6 signals); Recovery concern reads "Noticeably different" with heart rate +20.4%, HRV -31.8%, sleep -14.8%; no overflow at 320 px. Part 2 (LLM explanation) and Part 3 (pose) are not started.
- **Explain this pattern:** on-demand button in the Pattern card. `src/domain/explainTypes.ts` builds a de-identified summary (stage, level, score, up to 3 drivers, quality, source `simulated|file|bluetooth|api`), `src/domain/explainTemplate.ts` writes the deterministic built-in explanation, and `src/lib/explainRepository.ts` asks the cloud and ALWAYS falls back to the template on missing config, error, timeout, or text that fails `isSafeExplanation`. The shared strict contract, banned-language guard and prompts live in `supabase/functions/_shared/validate.ts` (a test keeps its not-assumed list identical to `deviceAssumptions.ts`); the Edge Function `supabase/functions/explain-pattern/index.ts` (Claude Haiku via the Anthropic API, key only in Supabase secrets) is written but NOT deployed. Setup commands for the user are in `docs/explain-setup.md`. Raw readings never leave the device. Verified: 223 tests (UTC and Asia/Yangon), build, and a browser run showing the built-in explanation with the honest "cloud unavailable" note. The Recovery-concern pattern uses the first synthetic traveler's series for demo-only profiles such as Maya.
- **Body tracking for Movement (pose):** `src/domain/poseFeatures.ts` turns body landmarks into joint angles, repetition counts (zone transitions, so any start position works), left/right range, balance sway, pauses and tracking quality (pure, tested with fake bodies in `src/test/poseFixtures.ts`). `src/lib/poseLandmarker.ts` loads the MediaPipe tracker from `public/mediapipe/` at run time (not an npm dependency), reports why when it cannot, and Movement then keeps the motion-based check and says so. `useCameraMotion.capturePose` reads frames at about 10 fps and keeps only numbers. `ObservedFeatures` gained optional `method` and `jointAngleRanges`; comparisons of balance and range only use earlier sessions measured the same way. No schema change (`observed_features` is JSON). The Movement line in `deviceAssumptions.ts` and `docs/device-assumptions.md` were updated via `npm run docs:assumptions`. The tracker files are NOT in the repo: `npm run setup:pose` prints the plan and `npm run setup:pose -- --yes` fetches them after user approval (`docs/pose-setup.md`). Not yet tried with a real webcam.
- **Visual check verification:** 22 new tests (`src/domain/visualCheck.test.ts`, `src/components/VisualCheckView.test.tsx`), `tsc -b`, `npm run build`, and `git diff --check` pass. A browser smoke test was not run because the in-app browser could not open localhost.
- **Pose runtime assets installed:** The documented MediaPipe 1.2.3 runtime bundle and 5.8 MB lite pose model are installed under ignored `public/mediapipe/`; no video is persisted or uploaded. Verification after setup: 292 frontend tests, 9 backend tests, production build, and `git diff --check` pass.
- **Device-data ingestion (Horizon analyzes, never measures):** `src/domain/ingest.ts` sanitizes untrusted rows (aliases, unit conversion, plausible ranges, timestamps, duplicates, device poor-contact flags, spike/flatline flags), scores quality (good/limited/poor), aggregates trusted readings to daily observations, and runs the existing `alertEngine.ts`; poor data never produces an alert. `src/lib/adapters/fileImport.ts` parses CSV/JSON locally. The simulated wearable now emits raw rows that pass through the same sanitizer (`useDeviceStream`), Home shows source, quality and counts, and Profile has an Import device data panel (with a built-in messy sample) listing every rejected row with its reason. Raw files and streams are never uploaded or saved.
- **Live device analysis:** When stored history exists (usual scenario, backend profile), the wearable's cleaned readings are analyzed by `alertEngine.ts` through `src/lib/liveAnalysis.ts`: the wearable "syncs" the previous full day, which is sanitized, averaged to a daily value and compared with the 30-day baseline. Only completed days can raise an alert; the current partial day is display-only, because comparing a partial day with daily history mixes time-of-day swings into the result. Demo scenarios and profiles without history keep scenario-driven alerts, and the Home/Trends strip says which applies ("Alerts from: completed days of device readings" or "demo scenario"). Trends now shows source, last sync, quality and counts like Home. Fixed a simulator bug: core temperature was clamped to 34–40 °C regardless of the person's level, which pushed a 33.2 °C person about 9 SD above usual and raised an alert on every check; the clamp is now relative to the person's own usual level. A 24-hour check across 4 travelers and 3 seeds gave 0 of 288 spurious alerts (it was 288 of 288 before the fix).
- **Bluetooth heart-rate source (Phase 4):** `src/lib/adapters/webBluetoothHeartRate.ts` connects a standard Bluetooth Heart Rate device through Web Bluetooth (Chrome/Edge on desktop and Android only; user click and the browser chooser required), parses the Heart Rate Measurement format (8/16-bit rate, sensor-contact flags, RR intervals), estimates HRV as RMSSD, and emits raw rows only. `src/lib/useBluetoothHeartRate.ts` buffers 5 minutes in memory, runs the rows through the shared sanitizer, and replaces only the heart-rate and HRV cards once at least 5 clean readings exist; everything else stays simulated and the source strip names both. Lost contact, impossible values, spikes and stuck (perfectly constant) sensors are rejected or flagged with reasons. Bluetooth readings are display-only for alerts until a full day is collected (completed-day rule). Nothing is saved or uploaded and there is no auto-reconnect; unsupported browsers, a closed chooser, blocked permission, connection failure and signal loss each show a clear message while the simulated wearable keeps working. Profile has a Bluetooth card with all states.
- **Bluetooth verification:** 126 frontend tests (a fake strap covers parsing, every connect outcome, the pipeline and the UI), `tsc -b` and `npm run build` pass. Browser-checked with an injected fake `navigator.bluetooth` in a real browser: connect, live values on Home, signal loss and fallback. Not tested on real Bluetooth hardware.
- **Assumed devices and signals made explicit:** `src/domain/deviceAssumptions.ts` is the single source of truth for what Horizon assumes it receives: six signals (heart rate, HRV, SpO₂, skin temperature, sleep, radiation dose), each with unit, accepted range (taken from the sanitizer), assumed device (crew wearable or chest strap, plus a personal dosimeter for radiation), cadence and note, plus what each source can supply, what the user enters, and what is NOT assumed (blood pressure, glucose, ECG, bone density, anything diagnostic). `docs/device-assumptions.md` is generated from it (`npm run docs:assumptions`) and a test fails if it is stale; Profile shows the same content in an "Assumed data sources" panel, and the Home/Trends strip notes the assumption. The temperature label was corrected from "Core temperature" to "Skin temperature" (the data is skin temperature, about 33 °C) and the demo fixture now matches; the internal id `core_temperature` is unchanged. Real hardware is untested by design.
- **Assumptions verification:** 133 frontend tests, `tsc -b`, `npm run build` and `git diff --check` pass. Browser-checked in the light theme (Home strip, Bluetooth card, assumptions panel) and at 375 px with no horizontal overflow.
- **RLS verification (live project):** With two anonymous sessions and the publishable key only, a scripted check on `traveler_preferences`, `baseline_checkins`, `preparation_sessions`, `adaptation_progress`, `privacy_preferences` and `visual_checks` confirmed for each table: the owner can write and read its own row; another user cannot read, update or delete it and cannot insert a row as the owner; a signed-out visitor can read and write nothing (60/60 checks). All test rows were deleted afterwards. The two anonymous accounts remain, because deleting auth users needs an admin key.
- **Future baseline builds from check-ins:** `src/domain/baselineSummary.ts` summarizes a Future traveler's own saved baseline check-ins (one per date, minimum 3 before anything is called "usual"), and the Guidance > Future view shows a "Your baseline so far" panel (progress, then the person's own resting heart rate and sleep ranges). It is personal context only: never a norm, target or flight clearance. When cloud save is unavailable it says so instead of implying data.
- **Movement layout and motion verification:** The Movement flow (intro, countdown, context, result, crew summary) was browser-checked at 320 px with no horizontal overflow at any step, and a test confirms the countdown pulse is off under reduced motion. Not yet tested with a real webcam. 143 frontend tests, `tsc -b`, `npm run build` and `git diff --check` pass.
- **Movement self-report simplification:** The post-capture context step now asks only comfort, effort, steadiness, and an optional note. These values remain movement-session context: comfort and marked unsteadiness can trigger stop/support wording, while effort and steadiness are included in the derived observation and optional crew summary. No health score, diagnosis, injury prediction, raw-video persistence, or ORBIT/OpenRouter upload is added; older sleep/stress/energy fields remain readable only for compatibility.
- **Ingestion verification:** 103 frontend tests, `tsc -b`, `npm run build` and `git diff --check` pass. Browser-checked at desktop width (live source/quality strip, sample import) and 375 px (no horizontal overflow). Phase 4 (Web Bluetooth adapter) is not started.
- **Local webhook source (dev server only):** `src/server/ingestReceiver.ts` is a pure, unit-tested receiver mounted by `vite.config.ts` (`apply: "serve"`, so production builds never ship it) at `POST /api/ingest`, `GET /api/ingest/status` and `GET /api/ingest/readings`. It requires a bearer token for posts (constant-time check), answers only on localhost hosts, refuses cross-origin requests, caps body/rows/metric names, keeps only known primitive fields, and holds rows in memory for up to 48 h (max 20,000 per metric; nothing on disk or in the cloud). The browser (`src/lib/adapters/webhookSource.ts`, `src/lib/useWebhookSource.ts`) fetches the rows, cleans them with the shared sanitizer as source `api`, and replaces only the dashboard cards for signals actually received (at least 3 trusted readings each); priority is Bluetooth, then webhook, then the simulated wearable. Webhook readings are display-only for alerts; the hook exposes the agreed hand-off shape `{ readings: SanitizeResult, source }` (`completed`) so completed days can be scored by shared analysis. Profile has a "Webhook source (local demo)" card (unavailable in production builds, with a copyable request) and `npm run send:sample` posts synthetic readings (`--bad` mixes in junk rows). `SOURCE_SUPPORT` lists the webhook and docs/device-assumptions.md was regenerated.
- **Webhook verification:** 169 frontend tests, `tsc -b`, `npm run build` and `git diff --check` pass. The receiver was exercised over real HTTP (no/wrong token 401, wrong Host and cross-origin 403, invalid JSON 400, oversized body 413). In a real browser, `npm run send:sample -- --bad` showed live values, the source strip named the four received signals, junk rows were counted as set aside, and the card fit at 320 px. Production bundle contains the small client adapter but not the receiver.
- **Retired wearable summary:** Retired Home now replaces the shared six-metric grid with responsive simulated Apple Health cards for daily activity, sleep duration, walking steadiness, and exercise minutes, plus resting heart rate, HRV, SpO₂, and wrist-temperature change context. The active radiation panel is hidden for Retired, unavailable states remain explicit, and Active/Future cards are unchanged.
- **Retired wearable verification:** 28 frontend tests, `npm run build`, and `git diff --check` pass. Vite retains its existing large-bundle warning.
- **Accessible wellbeing sliders:** Mood, stress, and sleep-quality dropdowns are now keyboard-accessible 1–5 range controls with live value descriptions, endpoint labels, saved-state compatibility for older sleep labels, and LocalStorage persistence.
- **Slider verification:** 28 frontend tests, `npm run build`, and `git diff --check` pass after the wellbeing input update. Vite retains its existing large-bundle warning.
- **Retired guidance workflow:** Replaced passive preview cards with a next-follow-up callout, four expandable health areas, an optional private reflection, and a locally persisted appointment-summary preview with explicit synthetic-data and no-automatic-sharing language.
- **Retired guidance verification:** 28 frontend tests, `npm run build`, and `git diff --check` pass after the workflow redesign. Vite retains its existing large-bundle warning.
- **Synthetic DXA workflow:** Retired Guidance can import a built-in sample DXA report, display its supplied T-scores and clinician interpretation without generating a diagnosis, derive the follow-up date, create a local sample appointment, and persist an optional local reminder. No hospital, calendar, or external service is contacted.
- **Synthetic DXA verification:** 29 frontend tests, `npm run build`, and `git diff --check` pass; coverage includes sample import, non-diagnostic copy, automatic date updates, appointment creation, reminder persistence, and the existing flows. Vite retains its existing large-bundle warning.
- **Independent health-card height:** Retired Guidance health-area cards align to their own content height, so expanding Bone health no longer visually stretches the closed Vision card beside it.
- **Source-backed retired guidance:** Removed unsupported fixed review/due dates from Vision, Heart health, and Sleep & wellbeing. Vision now imports a persisted synthetic eye-exam record with supplied guidance; Heart identifies its simulated wearable source and opens Retired Trends; Sleep identifies locally saved check-ins and opens Wellbeing. The next-follow-up callout now derives only from imported sample records or a locally created appointment.
- **Guidance-action verification:** 30 frontend tests, `npm run build`, and `git diff --check` pass; coverage includes DXA and eye-exam imports, source and safety copy, derived follow-up dates, heart-to-Trends routing, wellbeing routing, reminders, and existing flows. Vite retains its existing large-bundle warning.
- **Retired trend consistency:** Retired Trends now follows the wearable-only post-mission model used on Home and excludes the active-mission radiation-dose chart.
- **Alerts from webhook days (completed, well-covered days only):** `src/lib/dayCoverage.ts` makes an earlier day count only when a signal has readings in at least 18 distinct UTC hours (exercise heart rate and flagged artefacts do not count); the latest, still-open day is kept as the end marker and is never scored. Without this, a source that starts posting a few minutes before midnight would produce a "completed day" whose time-of-day swing looks like a change from the daily baseline (a regression test proves a short unusual burst would have alerted). `useWebhookSource.completed` now applies the rule, so both alerts and the pattern model (`useAssessment`) receive coverage-aware data. `App.tsx` scores a well-covered webhook day with `analyzeLiveReadings` against the stored 30-day history (usual scenario with backend history only); a webhook alert takes priority, otherwise the simulated wearable's or scenario's alert applies, and poor-quality data never alerts. The strip says "Alerts from: completed days of webhook readings, plus the simulated wearable for other signals" when this applies. `npm run send:sample -- --backfill --shift 28` posts yesterday as a full day with heart rate 28 bpm above usual so an alert can be demonstrated; `--backfill` alone is the no-alert control.
- **OpenRouter for explanations:** `supabase/functions/_shared/providers.ts` (pure, tested in `src/domain/explainProviders.test.ts`) chooses the AI service from Supabase secrets: OpenRouter when `OPENROUTER_API_KEY` is set (model from `OPENROUTER_MODEL`, never guessed; `model_missing` / `model_invalid` otherwise), else Anthropic when `ANTHROPIC_API_KEY` is set, else `not_configured`. Keys stay in headers only, replies are read per provider, only the provider's status code is passed on, and every reply still passes `isSafeExplanation` in the function and the browser. `public/mediapipe/` (34 MB, from `npm run setup:pose -- --yes`) is now git-ignored. `OPENROUTER_MODEL` may be `openrouter/free` (free router) or up to three comma-separated ids (sent as a fallback `models` list); the OpenRouter reply budget is 800 tokens because free models can spend part of it reasoning; failed 4xx calls return a short, sanitized `upstreamMessage`. Replies that stop mid-sentence are cut back to the last complete sentence (`completeSentences`), the function waits up to 15 s and the browser up to 18 s because free models can be slow. A live check with `OPENROUTER_MODEL=openrouter/free` returned real text and the app showed "Explanation by Horizon (AI-assisted)"; some attempts were rejected by the wording guard or timed out and fell back to the built-in text. The function now asks once more when a reply fails the wording check or is cut off (`retryWhenUnsafe`, only within the first 8 s of the 15 s budget; key, credit, rate-limit and server errors are never retried). On an OpenRouter 400 the function retries once with the system instructions folded into the user message (some models, such as Gemma, reject a system message). The function must be redeployed after this change. A first live test failed with upstream 400 because the chosen model was an embedding model (`...embed...:free`), which is not a chat model; a working chat model has not been confirmed yet.
- **Movement start screen simplified:** one compact card (task list, camera/demo choice, one consent line, one start button) instead of two text-heavy columns, built on top of the stage-aware task rules. Each task row shows only its name and duration; the how-to line (including the Active "anchor your feet" reminder) appears for the selected task only. Group headings, the stage paragraph and the "recovery context" line were removed. The required camera disclaimer is one line (readable in both themes), the Retired "not a rehab programme" note is one short line, and the five privacy and limits statements sit in a folded "Privacy and limits" disclosure (in the page, closed by default). Result and crew-summary screens are unchanged. 412 tests pass in UTC, Asia/Yangon and America/Los_Angeles on a clean `origin/main` (`a2befb4`) base, build clean; browser-checked for Active in light and dark themes, plus 320 px with no horizontal overflow on the earlier layout.
- **Pose loader dev-server fix:** a real-webcam test in `npm run dev` failed with "Failed to load url /mediapipe/vision_bundle.mjs ... should not be imported from source code": Vite adds `?import` to every dynamic import it can see and refuses files from `/public`. `src/lib/poseLandmarker.ts` now loads the tracker through a native import built with `new Function` (invisible to Vite; kept in production builds), injectable as `poseAssets.importModule` for tests. Reproduced in the page (`...vision_bundle.mjs?import` fetch failure), fixed, and re-checked in the page (real model loaded in about 0.1-0.3 s). Regression tests check that the loader contains no Vite-visible `import()` and that it wraps a supplied tracker module and passes on only the numbers. 416 tests pass in UTC, Asia/Yangon and America/Los_Angeles. Real webcam capture is still to be confirmed by the user after this fix.
- **Wellbeing feedback failure fix:** the summary showed the raw code `upstream_unavailable` and nothing else when the AI call failed, and the "AI-only" change had also removed the crew-medic note, the person's answers and the built-in suggestions (three `App.test.tsx` tests were failing on `main` because of it). Now: the crew-medic note (`summary.talkTo`) always shows, never depending on the AI; when AI feedback is missing or failed the built-in "What you told us" and "What might help" appear (the AI text still replaces them when it arrives); every failure code maps to plain wording (`friendlyFeedbackError`, no raw codes or provider messages); `supabase/functions/wellbeing-feedback` waits up to 40 s (was 15 s, which a slow free model can exceed), retries once without a system message on an OpenRouter 400, and reports `upstream_timeout` separately. The function must be redeployed. 425 tests pass in UTC, Asia/Yangon and America/Los_Angeles; build clean; browser-checked with AI not connected (note, built-in steps, plain message, no raw code).
- **Movement "stuck loading" fix (StrictMode):** in `npm run dev` the quality check ("Checking the camera image...") and body tracking ("Body tracking is loading...") never finished. `src/main.tsx` wraps the app in StrictMode, which mounts, unmounts and mounts again; `VisualCheckView` kept a one-way `cancelled` ref that was set on the simulated unmount and never reset, so every result was discarded. The ref is now reset to false on each mount. Reproduced with new StrictMode tests (red), fixed (green), and checked in a real dev server with a synthetic camera stream (quality "good", tracking ready, Start enabled). Real-webcam capture itself still needs the user's confirmation. Lesson: tests that render without `<StrictMode>` miss this class of dev-only bug, so view components with async work should keep a StrictMode test.
- **Wellbeing AI feedback is on request only:** the wellbeing summary no longer calls the AI when it opens. It shows the crew-medic note (when relevant), "What you told us" and "What might help" from the person's own answers, and a separate optional "ORBIT · AI feedback" section whose **Get AI feedback** button is the only thing that sends the selected check-in themes to the cloud (never the private note). The AI answer appears beside the built-in steps, which never disappear; failures use plain wording with Try again. Tests prove the AI is not called until the button is pressed. 425 tests pass in UTC, Asia/Yangon and America/Los_Angeles; build clean; browser-checked.
- **No-credit failure for wellbeing feedback:** an OpenRouter 402 ("requires more credits, or fewer max_tokens... can only afford 68") used to reach the screen as the provider's long English text. `wellbeing-feedback` now returns only a code and status (`upstream_credit` for 402, `rate_limited` for 429, `upstream_auth` for 401/403, else `upstream_error`) and the app shows one short sentence; the built-in steps stay visible. The same Supabase `OPENROUTER_MODEL` secret serves explain, chat and wellbeing, so a paid model there with a near-empty balance breaks all three; with no credit use `openrouter/free`. Function must be redeployed.
- **Free models only, enforced in code:** `supabase/functions/_shared/providers.ts` allows only `openrouter/free` or ids ending in `:free` (every entry of a fallback list), and refuses Anthropic, with `paid_model_blocked`, before any request is sent, unless the owner sets the secret `ALLOW_PAID_MODELS=true`. `explain-pattern` and `wellbeing-feedback` use the shared chooser and pass the switch; any function that uses the chooser without it is strict by default. The NASA-grounded ORBIT `chat-assistant` has its own single-model route, so it applies the same check itself (`isFreeModel` from `providers.ts`, refusing with `paid_model_blocked` before any request, lifted only by `ALLOW_PAID_MODELS=true`); a test checks both. The ORBIT chat client (`chatRepository.ts`) still shows `result.data.error` as-is, so a misconfigured paid model would show that code there; give it plain wording if that ever happens. The live secret was confirmed (by digest) to be exactly `openrouter/free`. Functions must be redeployed. The ORBIT chat client (`chatRepository.ts`) still shows `result.data.error` as-is; give it the same plain-wording mapping if chat ever returns a function error code.
- **Webhook alerts verification:** 267 frontend tests (rebased onto `main` at `fe7afcd`, three consecutive full runs), `tsc -b`, `npm run build` and `git diff --check` pass. In a real browser: a normal backfilled day gave "Your signals look usual", and an unusual one gave a Watch status with "Resting heart rate was well outside your usual range" and the webhook alert basis. Not covered: webhook alerts without stored history (demo scenarios and profiles with no history still use the scenario alert).
- **Profile-synced monthly history:** Trends now filters monthly personal history using the saved account journey window. Active profiles use launch-to-return dates, or a visible 180-day assumption when one date is missing; Retired profiles use a visible 180-day window ending at last landing. No readings are fabricated outside the available synthetic data. Focused monthly tests (459 total), build, and diff checks pass.
- **ORBIT FAQ and voice layer:** Added stage-aware FAQ categories and starter cards, conservative question classification, plain-language provider error mapping, voice input state handling through the optional Vapi browser SDK, and explicit emergency guidance labels. Original urgent messages remain local; only confirmed sanitized research questions can reach cloud chat. Chat messages now carry category and text/voice metadata. Focused ORBIT tests (10) and production build pass. Vapi remains visibly unavailable until `VITE_VAPI_PUBLIC_KEY` and `VITE_VAPI_ASSISTANT_ID` are configured, and the chat metadata migration still needs deployment.
- **Pattern explanation wording:** The pattern card now explains that it compares recent readings with the same traveler’s earlier readings, names the available signals, states how many were included, and replaces vague wording with a plain-English result.

### 🟢 Currently Built — Chat Assistant

- **Floating NASA assistant:** `ChatWidget` is mounted on every selected-stage page, keeps the existing accessible floating robot, and presents NASA-focused starter questions in a mobile-friendly sheet.
- **NASA-only contract:** Dashboard-context sharing and general symptom-first cloud chat were removed. ORBIT answers only from retrieved official NASA passages and displays the exact no-evidence message when the index cannot support an answer.
- **Retired private companion:** Retired Home starts with one wearable pairing action. After pairing it shows a Mental friend card and wearable information. ORBIT starts in a private built-in conversation for Retired astronauts; switching to NASA research is explicit. Private messages stay in browser session memory and are never uploaded. A local warm reply is a fixed prompt, not clinical support.
- **Brief replies:** Visible guidance is capped at 30 words and longer fixed guidance sits under “More guidance”. The NASA cloud prompt requests up to 30 words, with server and browser checks enforcing 250 characters and three lines. The Edge Function edit requires deployment before the new prompt is live.
- **Ground team preview:** A synthetic ongoing-mission roster is selectable from the stage picker. Crew names and roles use compact horizontal buttons; each crew member has individual trends, and the handoff can be opened or hidden. No real NASA crew, telemetry, contact, or medical action is connected.
- **Citations:** Successful replies are labelled `NASA-grounded AI response`, contain numbered citation markers, and render immutable NASA source cards with title, collection, date when available, excerpt, and direct URL.
- **Server-only NASA index:** The live project has `nasa_documents` and `nasa_chunks` with full-text plus 384-dimensional vector indexes. RLS is enabled, browser grants are revoked, and ingestion/search RPCs are service-role-only.
- **Hybrid retrieval:** `search_nasa_chunks` merges top lexical and semantic matches with reciprocal-rank fusion and requires lexical evidence or semantic similarity of at least `0.70` before OpenRouter is called.
- **Free AI route:** The deployed `chat-assistant` uses the free `google/gemma-4-31b-it:free` model to avoid the shared `openrouter/free` router quota. Gemma is requested in JSON mode (not JSON-Schema mode), while Horizon still validates retrieved source IDs/citation markers, rejects unsupported URLs and unsafe wording, and reports unavailable/invalid output honestly.
- **Urgent privacy boundary:** Clear urgent personal statements receive immediate deterministic local guidance and are never persisted or uploaded. A separately confirmed, neutral NASA research query can be sent afterward; only that sanitized query reaches the cloud.
- **Corpus operations:** `nasa-corpus-ingest`, the 26-source official NASA registry, manual sync command, and weekly GitHub Action are deployed/configured. The bootstrap index contains 26 documents, 26 compact chunks, and 15 collections.
- **ORBIT verification:** The live retrieval benchmark passed 24/24 representative questions (100% relevant official source in the top five). A live `openrouter/free` smoke test returned a cited ISS control-moment-gyroscope answer. Browser-role checks confirm the index/search are inaccessible and chat ownership RLS blocks cross-user reads/writes. On the combined wellbeing + ORBIT branch, 422 frontend tests, 9 backend tests, the production build, `git diff --check`, and the live NASA RLS check pass. The existing large-bundle warning remains. Final visual QA at 320/390/1440 px was attempted but the desktop browser bridge reported `Local browser access is unavailable for this chat`.
- **Movement is for astronauts in space and retired astronauts, not Future travelers:** Active offers only shoulder mobility and reach-and-return with the in-flight anchoring reminder. Retired offers exactly four Earth-based practices: shoulder mobility, reach-and-return, sit-to-stand, and single-leg balance. Future has no Movement navigation or camera flow. Historical standing-posture records remain labelled for compatibility but cannot start a new session; no database migration was needed.
- **Movement stage-rule verification:** Active sees exactly two tasks; Retired sees exactly four; Future has no Movement item. The Retired flow keeps the practice-tracking-not-rehab wording and the balance safety line. Selected task and camera-mode cards remain readable in both themes.

### 🟡 Active Focus

### 🟢 Wellbeing AI Feedback

- **Check-in feedback:** The wellbeing summary now keeps its deterministic suggestions as a fallback and offers an on-demand `Get AI feedback` action after the user completes questions.
- **OpenRouter boundary:** `supabase/functions/wellbeing-feedback` sends only the selected summary themes, never the private note or raw readings; output is bounded and passed through the shared non-diagnostic safety guard.
- **Verification:** The live Edge Function returned tailored next steps for sleep/workload themes; focused repository tests pass and the production build passes. The full branch suite still has unrelated Movement/retired-flow failures.

> **AGENT NOTE:** The user explicitly authorized frontend work with typed mock data while the backend contract is pending. Do not connect live Supabase data until Agent 1 publishes the shared repository contract.

- **Immediate task:** Try Movement with a real webcam (good and poor light, phone held upright) using the installed pose runtime. Decide whether the real-camera results justify further tuning.
- **Active guide follow-up:** Preview the expanded Active Guidance on desktop/mobile in both themes when a browser connection is available. The implementation and interaction checks are complete; no database changes are needed.
- **Next body-viewer task:** Visually verify all Signals/Movement marker positions, desktop side panel, mobile stacked panel, save-return focus, touch, reduced motion, and WebGL fallback in a connected browser. Region interaction is implemented; direct muscle/spine sensors remain unavailable.
- **Remounted pattern card check:** Confirm the restored card and its "Explain this pattern" button read correctly on Home and Trends at 320/390/1440 px in both themes, including the "Pattern view paused" state for Future and Retired.
- **Companion follow-up:** Visually check the NASA source cards and urgent-query confirmation flow at 320/390/1440 px in both themes. The database migration, corpus, Edge Functions, free-model configuration, retrieval benchmark, live grounded answer, and RLS checks are complete.
- **Required tables:** `sample_people`, `health_observations`, and `demo_events`.
- **Required seed:** Four synthetic travelers with 180 days of observations.
- **Security requirement:** Enable RLS on every exposed table and allow only the intended synthetic-data reads.
- **Current blocker:** None for deployment. Cross-user RLS is verified for all six user-owned tables. Movement has had no real-camera check, and real Bluetooth hardware is untested by design.

## 🧭 Implementation Roadmap

Complete phases in order. Do not mark a phase complete until its verification checks pass.

### Phase 0 — Foundation and project safety

- [x] Create the React/Vite/TypeScript project.
- [x] Configure the Supabase browser client.
- [x] Add environment-variable examples and ignore local secrets.
- [x] Add the persistent synthetic-data disclaimer.
- [x] Add the living `AGENTS.md` roadmap.
- [x] Verify the production build.
- [x] Verify the initial scaffold is pushed to the shared GitHub repository.

**Exit check:** A teammate can clone the repository, install dependencies, configure `.env.local`, and run the app.

### Phase 1 — Synthetic data and Supabase foundation

- [x] Confirm access to the configured Supabase project.
- [x] Create migrations for `sample_people`, `health_observations`, and `demo_events`.
- [x] Enable RLS on every exposed table.
- [x] Add read-only policies for public synthetic demo data.
- [x] Seed four traveler profiles.
- [x] Generate 180 days of deterministic observations per traveler.
- [x] Add the 3-day radiation spike, 5-day illness-like episode, and 5-day sleep disruption.
- [x] Add seed control and replay-event behavior in the frontend simulation controls; backend replay contract remains pending.
- [x] Verify row counts, metric units, dates, and RLS behavior.

**Exit check:** The browser can load synthetic profiles and observations from Supabase, and the app has a deterministic local fallback.

### Phase 2 — Monitoring engine and data quality

- [x] Add typed domain types and a Supabase repository layer.
- [x] Implement the rolling 30-day personal baseline in the frontend domain adapter.
- [x] Implement the `>3 SD` single-reading alert rule with tests.
- [x] Implement the `>2 SD on 3 of the last 5 days` sustained-shift rule with tests.
- [x] Include a plain-language reason with every generated alert.
- [x] Add usual, recovery-concern, and sensor-disconnected scenarios in the frontend flow.
- [x] Add stale-data and offline UI states; backend insufficient-baseline and missing-data contracts remain pending.
- [x] Ensure exercise-related heart-rate changes do not trigger recovery alerts by themselves.

**Exit check:** Alert decisions are deterministic, explainable, unit-tested, and independent from the UI.

### Phase 3 — Active astronaut flow

- [x] Add profile selection and Active stage setup.
- [x] Add simulated data controls.
- [x] Build the Home dashboard with current signals and next action.
- [x] Build Trends with personal baseline overlays and alert markers.
- [x] Build the optional wellbeing check-in.
- [x] Build next-action guidance with data limitations.
- [x] Build the follow-up timeline.

**Exit check:** The complete active flow works from simulated data through alert explanation, check-in, action, and follow-up.

### Phase 4 — Candidate / trainee preview

- [x] Add Future/Trainee stage content.
- [x] Add one short metric or sensor lesson.
- [x] Add one practice scenario with feedback.
- [x] Store learning progress locally.
- [x] Explicitly avoid presenting learning progress as flight clearance or certification.

**Exit check:** One trainee lesson is demonstrable without expanding into a separate game product.

### Phase 5 — Post-mission / retired preview

- [x] Add Retired/Post-mission stage content.
- [x] Add long-term trend preview.
- [x] Add mood, stress, sleep, and journal check-in preview.
- [x] Add reminder UI without medical claims.
- [x] Add a clinician-summary preview with selectable fields only.

**Exit check:** Retired users can review trends and prepare a non-diagnostic summary without requiring historical mission data.

### Phase 6 — Radiation and public NASA context

- [x] Add radiation dose versus personal synthetic baseline.
- [x] Add Safe/Caution/High display with a clear explanation.
- [x] Add optional NASA DONKI solar-event lookup.
- [x] Cache DONKI responses and handle rate limits.
- [x] Fall back to labeled mock events when DONKI is unavailable.
- [x] Link NASA OSDR and NTRS references from About and Limits.

**Exit check:** NASA services enrich the demo but are never required for core monitoring or alert behavior.

### Phase 7 — Quality, privacy, and presentation

- [x] Add responsive dark space-themed styling.
- [x] Add LocalStorage persistence for check-ins, preferences, replay state, and seed.
- [x] Add per-category privacy controls.
- [x] Add unit tests for alert logic; backend synthetic-data tests are on Agent 1's branch.
- [x] Add UI tests for stage switching, fallback states, persistence, and Future/Retired previews.
- [x] Test offline operation and refresh behavior in the frontend simulation and UI suite.
- [x] Audit all current frontend copy for diagnosis, clinical certainty, and medical-device implications.
- [x] Run the production build and smoke-test the complete demo flow through the automated Active-flow UI suite and production-server HTTP check.

**Exit check:** The demo is stable, responsive, clearly synthetic, and safe to present to judges.

### Phase 8 — Visual Health Check (non-diagnostic webcam practice)

- [x] Define the `VisualCheck` contract, allowed features, and mandatory camera disclaimer.
- [x] Build the guided movement check with permission, quality, countdown, capture, and summary steps.
- [x] Add the labelled synthetic demo mode for browsers without a camera.
- [x] Compare only with the same stage/profile's prior sessions of the same task.
- [x] Combine sleep, stress, and energy context with neutral pattern language.
- [x] Add the user-controlled crew-medic summary (never sent automatically).
- [x] Add the `visual_checks` migration with owner-only RLS and no media columns.
- [x] Apply the `visual_checks` migration (user-confirmed).
- [x] Verify cross-user RLS denial with two anonymous sessions (2026-11-12: 60/60 checks passed against the live project using the publishable key).
- [ ] Browser smoke test on desktop and mobile layouts with a real camera.
- [x] Install the optional MediaPipe pose-landmark runtime and lite model using `npm run setup:pose -- --yes`.

**Exit check:** A Future traveler can complete a movement check, see a personal comparison, save the derived summary, and prepare a crew summary without any raw video persisted.

## 🔴 Current Backlog Summary

- **Highest priority:** Supabase project access, schema, RLS, and synthetic seed data.
- **Next:** Typed repository, baseline calculations, alert engine, and data-quality states.
- **Then:** Complete Active Astronaut flow.
- **After core demo:** Trainee and Retired previews, NASA context, styling, privacy, and tests.

## 📌 Progress Update Rules

- Keep the roadmap as the single source of truth for implementation status.
- After every completed task, update the checkbox and move the item into Currently Built when appropriate.
- Update Active Focus to the next smallest task, not an entire phase.
- Record the exact blocker when progress stops.
- Record verification performed, such as `npm run build`, unit tests, RLS checks, or a browser smoke test.
- Never mark work complete because files were created alone; verify the behavior.

## 🧱 Technical Rules

- Use React, TypeScript, Vite, Tailwind CSS, Recharts, and Supabase.
- Use only the Supabase publishable key in browser code.
- Never expose or commit a Supabase service-role or secret key.
- Keep user check-ins and personal interactions in LocalStorage unless cloud persistence is explicitly requested.
- Use synthetic data only.
- Keep all alert logic in one small, well-commented module.
- Every alert must include a plain-language reason.
- Do not present diagnoses or clinical conclusions.
- Preserve the persistent disclaimer: `Simulated data. Not medical advice. Not diagnostic.`

## 🤖 Agent Workflow Rules

1. At the start of every task, read this file and inspect the current repository state.
2. Treat the Active Focus section as the immediate default task.
3. Do not expand scope without explicit user direction.
4. Before changing Supabase tables, migrations, RLS, indexes, or database functions, read the Supabase and Postgres best-practice instructions.
5. After each successful implementation task, move completed work into Currently Built, update Active Focus, check off completed backlog items, and record new blockers.
6. Never claim a task is complete without running the relevant build, test, or verification command.
7. Preserve existing user changes and do not overwrite unrelated work.
8. Keep this roadmap concise and factual; never record secrets or private data.

## 👥 Team Task Delegation

Device Agent 2 owns frontend and UX work. Device Agent 1 owns backend and data work. This section is documentation only until each agent receives a specific task prompt.

### Agent 2 — Frontend and UX Owner

Owns:

- app shell and navigation;
- dark responsive design system;
- Active Home screen;
- Trends screen;
- Wellbeing screen;
- Profile and simulation controls;
- LocalStorage state;
- accessibility and UI tests.

Agent 2 must use mocked or typed placeholder data until Agent 1's contract is available, avoid changing Supabase schema or alert thresholds, keep UI components independent from direct Supabase queries, update this file after completed frontend milestones, and run `npm run build` before reporting completion.

Suggested prompt:

```text
Read AGENTS.md first. You are Device Agent 2, the frontend owner.

Implement only the current frontend task from the Agent 2 section:
[insert one specific frontend task]

Do not modify Supabase schema, RLS, seed data, or alert thresholds.
Use typed mock data when backend data is not ready.
Run npm run build and relevant tests.
Update AGENTS.md with completed work, remaining work, and the next frontend task.
```

### Agent 1 — Backend and Data Owner

Owns:

- Supabase migrations;
- RLS policies;
- synthetic data generation;
- seeded sample profiles and observations;
- typed repository functions;
- baseline and alert logic;
- simulation scenarios;
- NASA DONKI integration and fallback;
- backend and data tests.

Agent 1 must read the Supabase and Postgres best-practice skills before schema work, keep all data synthetic, never expose service-role credentials, define shared TypeScript types before frontend integration, document schema and query contracts, run database checks and `npm run build`, and update this file with completed work, remaining work, blockers, and the next backend task.

Suggested prompt:

```text
Read AGENTS.md first. You are Device Agent 1, the backend and data owner.

Implement only the current backend task from the Agent 1 section:
[insert one specific backend task]

Do not redesign the frontend.
Use synthetic data only.
Read the Supabase and Postgres best-practice instructions before database changes.
Run verification queries, tests, and npm run build.
Update AGENTS.md with completed work, remaining work, blockers, and the next backend task.
```

### Shared Contracts

- Shared types live in one agreed location and must be reviewed by both agents.
- Frontend components do not query Supabase directly.
- Backend exposes typed repository functions.
- Alert thresholds belong to backend/domain logic, not UI logic.
- Schema changes require a migration and RLS verification.
- Changes to shared types require coordination and a build check.

Initial shared types:

- `LifeStage`
- `MetricName`
- `Observation`
- `Alert`
- `SimulationScenario`
- `DataQualityState`

### Step-by-Step Integration Workflow

1. Agent 1 creates the schema, seed data, domain types, repository, and alert module.
2. Agent 1 verifies the database, tests, and build.
3. Agent 1 pushes backend work to a dedicated branch and opens a pull request.
4. Agent 2 continues UI work using the shared types or temporary mock data.
5. Agent 2 pulls or merges the backend branch after the contract is stable.
6. Agent 2 replaces mock repository calls with the typed backend repository.
7. Both agents run `npm install`, `npm run build`, unit tests, database/RLS checks, and a manual active-flow smoke test.
8. Database and data conflicts are resolved by Agent 1, layout and interaction conflicts by Agent 2, and shared-type conflicts together.
9. Both agents update this file with the integrated status.
10. Merge the verified pull request into `main`.

### Branch Ownership

- Agent 1 branch: `codex/backend-data`
- Agent 2 branch: `codex/frontend-flow`
- Optional integration branch: `codex/integration`
- `main` remains the stable branch.
- Neither agent pushes unfinished work directly to `main`.

## 📋 Team Progress Checklists

### Agent 2 — Frontend Checklist

- [x] Build the app shell and responsive navigation.
- [x] Add the dark, high-contrast Horizon design system.
- [x] Build Active Home with mocked typed data.
- [x] Build Trends with baseline and alert placeholders.
- [x] Build Wellbeing and LocalStorage check-ins.
- [x] Build Profile and simulation controls.
- [x] Add Future and Retired preview states.
- [x] Add initial accessibility and UI smoke tests.
- [x] Add stale, disconnected, and offline frontend state messaging.
- [x] Add UI coverage for recovery alerts, stale-data messaging, navigation, and LocalStorage check-ins.
- [x] Add accessible loading feedback for simulated scenario changes.
- [x] Isolate UI data access behind a typed mock repository adapter.
- [x] Make the local “Talk to a person” support action functional.
- [x] Make shell labels and mobile active navigation stage-aware and accessible.
- [x] Add an expandable plain-language explanation for trend alert markers.
- [x] Add LocalStorage-backed simulation seed and replay controls.
- [x] Pass typed seed and replay controls through the frontend repository boundary.
- [x] Import Agent 1's verified shared domain and repository contract files.
- [x] Add the typed backend-to-dashboard mapping adapter and source/warning preservation.
- [x] Verify the complete mock Active Astronaut flow from alert to local check-in.
- [x] Verify the disconnected-source fallback and “Data unavailable” copy.
- [x] Verify wellbeing privacy choices persist in LocalStorage.
- [x] Verify offline Trends fallback and recovery guidance.
- [x] Integrate Agent 1's repository contract for the usual-day flow, with deterministic local fallback.
- [x] Import Agent 1's replay/data-quality contract and map its quality warnings into the UI.
- [x] Redesign the complete UI with compact typography, glass cards, NASA space imagery, responsive navigation, and stage-selection coverage.
- [x] Add persistent light/dark appearance across landing, workspaces, charts, and forms; verify desktop/mobile layouts and contrast.

### Agent 1 — Backend Checklist

- [x] Confirm access to the configured Supabase project.
- [x] Create migrations for `sample_people`, `health_observations`, and `demo_events`.
- [x] Enable RLS and verify read-only synthetic-data policies.
- [x] Seed four profiles and 180 days of observations.
- [x] Add the radiation, illness-like, and sleep-disruption events.
- [x] Add typed domain models and repository functions.
- [x] Implement baseline and explainable alert rules.
- [x] Add simulation scenarios and deterministic replay.
- [x] Add NASA DONKI caching and mock fallback through the shared frontend adapter.
- [x] Add backend/data tests and integration documentation.

### Shared Integration Checklist

- [x] Agree on the shared TypeScript types.
- [x] Confirm repository function names and return shapes.
- [x] Confirm alert severity and explanation fields for the current frontend adapter.
- [x] Import the verified backend contract into the frontend branch.
- [x] Replace the usual-day frontend mock with repository calls and retain local fallback.
- [x] Run the combined build, unit tests, RLS checks, and active-flow smoke test after branch integration.
- [x] Review synthetic-data labels and safety copy for the frontend flow.
- [x] Merge the verified integration work into `main` (`codex/integration` is an ancestor of `main`; the UI redesign and Visual Health Check followed).
- [x] Integrate the verified space-health UI, Profile icon, and light/dark appearance into `main`.

### Current Blockers

- The Future preparation migration still needs live Supabase verification; this checkout has no `.env.local`. UI browser checks are available through headless Chrome; interactive computer-use helpers fail with `failed to write kernel assets: The system cannot find the path specified. (os error 3)`.
- Chat cloud persistence is code-complete but live until migration/function deployment: run the chat migration, deploy `chat-assistant`, and set a chat-capable `OPENROUTER_MODEL` secret in Supabase.

### Next Coordination Point

`main` includes the ingestion pipeline (simulated wearable, file import, Bluetooth), live-device analysis on completed days, the assumed-devices contract, the Visual Health Check, and the floating stage-aware chat UI. Next: apply and live-test the chat migration/function, then run a real-webcam check of Movement.

## 📈 Delegated Progress Rules

- Each agent updates only its owned checklist after verified work.
- Completed tasks move into Currently Built when the behavior is verified.
- Incomplete tasks stay unchecked.
- Every blocker must include the exact error or missing dependency.
- No feature implementation starts from this section alone; each agent should receive one specific task prompt.
