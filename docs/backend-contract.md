# OrbitWell backend foundation

Synthetic research-demo data only.

## Database

Project: `chfvsmbsgdwauqbwnamv`. The migration in `supabase/migrations/` matches the
remote migration version. Apply migrations before running `supabase/seed.sql` on
a fresh project. Seed SQL is transactional, deterministic, and rerunnable via
`ON CONFLICT (id) DO NOTHING`; it does not overwrite existing records. Schema
constraints reject non-synthetic records, invalid metric/unit combinations,
nonfinite values, and invalid ranges. Foreign keys have covering indexes.

Tables:

| Table | Contract |
| --- | --- |
| `sample_people` | Four fictional profiles; text ID, name, life stage, mission day, synthetic flag |
| `health_observations` | One row per traveler/date/metric/seed; six metrics; date in UTC; numeric value with unit and rest/exercise context |
| `demo_events` | Traveler, kind, inclusive start/end dates, explanation, seed, synthetic flag |

Default seed is 42. Dates are fixed at 2026-01-01 through 2026-06-29, independent
of today's date. Each traveler has 1,080 readings (180 days × 6 metrics). Event
offsets are zero-based: radiation days 100–102, illness-like days 120–124, sleep
disruption days 150–154. These are demonstration scenarios, not medical claims.

RLS is enabled on every table. `anon` and `authenticated` have SELECT only, with
`is_synthetic` policies. No client write grants or write policies exist.
Privileged seeding happens through management access, never a browser secret.

## TypeScript contract for frontend review

Shared types are in `src/domain/types.ts`. Database and domain field names use
snake_case. Types and function signatures are ready for frontend-owner review;
agreement and UI integration are still pending.

```ts
import { createHorizonRepository } from '../data/repository';
import { supabase } from '../lib/supabase';
const repository = createHorizonRepository(supabase);
const profiles = await repository.listPeople();
const observations = await repository.listObservations('traveler-01', {
  from: '2026-01-01', to: '2026-06-29',
});
const events = await repository.listEvents('traveler-01');
```

Every method returns `{ data, source: 'supabase' | 'local', warning? }`.
Display the source/warning so fallback is visible. Cloud reads validate runtime
rows, use stable ID ordering and 500-row pages, and have a 15-second timeout per
page. Observation date filters are inclusive. Do not infer chronological order
from IDs: sort observations by `observed_on` for charts. Empty successful cloud
results stay empty; failures discard partial results and use the complete
deterministic local result. Unknown traveler IDs return empty arrays.

For explicit local mode use `createHorizonRepository(null, seed)`. Seed must be
an integer from 0 through 1,000,000. Cloud data currently contains seed 42 only;
use local mode for other seeds. The repository does not upload or mutate data.
Check-ins and personal interactions remain local to the frontend.

The existing connection-test App still directly queries Supabase; replacing it
with this repository belongs to frontend integration. No layout or navigation
was changed in this backend milestone.

## Verification and remaining work

- `npm test`: generator, event durations, seed validation, repository filtering,
  cloud pagination, invalid responses, failures, and explicit fallback.
- `npm run test:db`: reads ignored `.env.local` using only its publishable key;
  verifies all cloud rows match the generator and exercises date filters. It
  fails if fallback is used. Requires network access to the configured project.
- Run `supabase/verify.sql` through authenticated management access to assert
  RLS flags and read-only grants, test denied writes, and roll back probes.
- `npm run seed:generate`: regenerate `supabase/seed.sql` from TypeScript fixtures.
- `npm run build` and `git diff --check`.

Next backend task: rolling 30-day baselines and explainable alert engine, with
the existing strict >3 SD and >2 SD on 3 of 5 days rules. Replay controls,
data-quality handling, and NASA DONKI remain pending. An `Alert` type is a
contract only; no alert calculations exist in this milestone. Fixed seed dates
must be interpreted using a simulation date when stale-data logic is added.
