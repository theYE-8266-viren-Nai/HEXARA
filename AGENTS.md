# Horizon Agent Guide

Horizon is a research demo health companion for space travelers. It uses synthetic data only and is not a medical device.

## 🗺️ Project Status & Context Trackers

### 🟢 Currently Built

- **Frontend foundation:** React + Vite + TypeScript scaffold is created.
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
- **Visual check verification:** 22 new tests (`src/domain/visualCheck.test.ts`, `src/components/VisualCheckView.test.tsx`), `tsc -b`, `npm run build`, and `git diff --check` pass. A browser smoke test was not run because the in-app browser could not open localhost.
- **Device-data ingestion (Horizon analyzes, never measures):** `src/domain/ingest.ts` sanitizes untrusted rows (aliases, unit conversion, plausible ranges, timestamps, duplicates, device poor-contact flags, spike/flatline flags), scores quality (good/limited/poor), aggregates trusted readings to daily observations, and runs the existing `alertEngine.ts`; poor data never produces an alert. `src/lib/adapters/fileImport.ts` parses CSV/JSON locally. The simulated wearable now emits raw rows that pass through the same sanitizer (`useDeviceStream`), Home shows source, quality and counts, and Profile has an Import device data panel (with a built-in messy sample) listing every rejected row with its reason. Raw files and streams are never uploaded or saved.
- **Live device analysis:** When stored history exists (usual scenario, backend profile), the wearable's cleaned readings are analyzed by `alertEngine.ts` through `src/lib/liveAnalysis.ts`: the wearable "syncs" the previous full day, which is sanitized, averaged to a daily value and compared with the 30-day baseline. Only completed days can raise an alert; the current partial day is display-only, because comparing a partial day with daily history mixes time-of-day swings into the result. Demo scenarios and profiles without history keep scenario-driven alerts, and the Home/Trends strip says which applies ("Alerts from: completed days of device readings" or "demo scenario"). Trends now shows source, last sync, quality and counts like Home. Fixed a simulator bug: core temperature was clamped to 34–40 °C regardless of the person's level, which pushed a 33.2 °C person about 9 SD above usual and raised an alert on every check; the clamp is now relative to the person's own usual level. A 24-hour check across 4 travelers and 3 seeds gave 0 of 288 spurious alerts (it was 288 of 288 before the fix).
- **Ingestion verification:** 103 frontend tests, `tsc -b`, `npm run build` and `git diff --check` pass. Browser-checked at desktop width (live source/quality strip, sample import) and 375 px (no horizontal overflow). Phase 4 (Web Bluetooth adapter) is not started.

### 🟡 Active Focus

> **AGENT NOTE:** The user explicitly authorized frontend work with typed mock data while the backend contract is pending. Do not connect live Supabase data until Agent 1 publishes the shared repository contract.

- **Immediate task:** Verify cross-user RLS denial for the Future preparation and `visual_checks` tables with two anonymous sessions, then smoke-test Movement in a browser with a real camera.
- **Required tables:** `sample_people`, `health_observations`, and `demo_events`.
- **Required seed:** Four synthetic travelers with 180 days of observations.
- **Security requirement:** Enable RLS on every exposed table and allow only the intended synthetic-data reads.
- **Current blocker:** None for deployment: both migrations are applied (user-confirmed; all six tables respond via the publishable key and return no rows to an unauthenticated request). Not yet verified: that one anonymous user cannot read another's rows, and Movement has had no browser or real-camera check.

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
- [ ] Verify cross-user RLS denial with two anonymous sessions.
- [ ] Browser smoke test on desktop and mobile layouts with a real camera.
- [ ] Optional: browser pose-landmark library for joint-angle ranges (after the deterministic flow is validated).

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

### Next Coordination Point

`main` includes the integration branch, the space-health UI with light/dark appearance, and the Visual Health Check. Next: verify cross-user RLS denial on the Future preparation and `visual_checks` tables, then browser and real-camera checks of Movement.

## 📈 Delegated Progress Rules

- Each agent updates only its owned checklist after verified work.
- Completed tasks move into Currently Built when the behavior is verified.
- Incomplete tasks stay unchecked.
- Every blocker must include the exact error or missing dependency.
- No feature implementation starts from this section alone; each agent should receive one specific task prompt.
