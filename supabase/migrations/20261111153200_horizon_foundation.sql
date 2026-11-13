-- Synthetic demo data only. No personal interactions belong in these tables.
create table public.sample_people (
 id text primary key,
 name text not null,
 life_stage text not null check (life_stage in ('future','active','retired')),
 mission_day integer not null check (mission_day >= 0),
 is_synthetic boolean not null default true check (is_synthetic)
);
create table public.health_observations (
 id text primary key,
 person_id text not null references public.sample_people(id),
 observed_on date not null,
 metric text not null,
 value double precision not null check (value > '-Infinity'::float8 and value < 'Infinity'::float8),
 unit text not null,
 context text not null default 'rest' check (context in ('rest','exercise')),
 seed integer not null check (seed between 0 and 1000000),
 is_synthetic boolean not null default true check (is_synthetic),
 unique(person_id, observed_on, metric, seed),
 check (
 (metric='heart_rate' and unit='bpm' and value between 20 and 250) or
 (metric='hrv' and unit='ms' and value between 0 and 300) or
 (metric='sleep_hours' and unit='h' and value between 0 and 24) or
 (metric='skin_temperature' and unit='degC' and value between 20 and 45) or
 (metric='spo2' and unit='%' and value between 0 and 100) or
 (metric='radiation_dose' and unit='mSv' and value between 0 and 100)
 )
);
create table public.demo_events (
 id text primary key,
 person_id text not null references public.sample_people(id),
 kind text not null check (kind in ('radiation_spike','illness_like','sleep_disruption')),
 starts_on date not null,
 ends_on date not null check (ends_on >= starts_on),
 description text not null,
 seed integer not null check (seed between 0 and 1000000),
 is_synthetic boolean not null default true check (is_synthetic),
 unique(person_id, kind, seed)
);
create index health_observations_person_date_idx on public.health_observations(person_id, seed, observed_on, metric);
create index demo_events_person_date_idx on public.demo_events(person_id, seed, starts_on);
alter table public.sample_people enable row level security;
alter table public.health_observations enable row level security;
alter table public.demo_events enable row level security;
revoke all on public.sample_people, public.health_observations, public.demo_events from public, anon, authenticated;
grant usage on schema public to anon, authenticated;
grant select on public.sample_people, public.health_observations, public.demo_events to anon, authenticated;
create policy synthetic_read on public.sample_people for select to anon, authenticated using (is_synthetic);
create policy synthetic_read on public.health_observations for select to anon, authenticated using (is_synthetic);
create policy synthetic_read on public.demo_events for select to anon, authenticated using (is_synthetic);
