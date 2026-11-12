// Regenerates docs/device-assumptions.md from src/domain/deviceAssumptions.ts.
import { writeFileSync } from 'node:fs';
import { renderAssumptionsMarkdown } from '../src/domain/deviceAssumptions.ts';

writeFileSync(new URL('../docs/device-assumptions.md', import.meta.url), renderAssumptionsMarkdown());
console.log('Wrote docs/device-assumptions.md');
