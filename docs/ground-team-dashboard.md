# Ground health team preview

The **Ground health team** entry on the start page opens a synthetic training console. It groups crew by mission and shows only profiles with all three conditions: `stage = active`, `assignment = onboard`, and a mission marked ongoing whose dates include today. The demo includes invented missions, people, readings, and one crew-reported urgent concern. Planned missions, returned crew, Future travelers, and retired astronauts are excluded.

The dashboard supports mission selection, compact crew selectors, and six synthetic trends for every onboard astronaut with source and data-quality context. A crew member with a data gap still has historical charts, but their latest readings are explicitly unavailable.

This public preview does **not** read astronaut accounts or live health data, and it does not provide ground-team authorization. Real team access would require administrator-assigned mission membership, authenticated team roles, mission-scoped row-level security, and an approved telemetry ingestion path with source timestamps and quality. Do not expose existing owner-only `astronaut_profiles` or private check-ins to this preview. The demo provides no treatment instructions or emergency dispatch capability.
