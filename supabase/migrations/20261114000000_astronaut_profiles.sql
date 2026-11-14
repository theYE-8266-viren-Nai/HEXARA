-- Astronaut accounts: one personal profile per signed-up (non-anonymous) user.
-- Personal, mission/training/career and care-team details live in `details` (a JSON object)
-- so each stage can keep its own fields without schema changes. Only the owner can read or change it.

create table if not exists public.astronaut_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  stage text not null check (stage in ('future', 'active', 'retired')),
  full_name text not null check (char_length(btrim(full_name)) between 1 and 120),
  call_sign text not null default '' check (char_length(call_sign) <= 40),
  agency text not null default '' check (char_length(agency) <= 120),
  details jsonb not null default '{}'::jsonb
    check (jsonb_typeof(details) = 'object' and pg_column_size(details) <= 16384),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.astronaut_profiles_touch_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists astronaut_profiles_updated_at on public.astronaut_profiles;
create trigger astronaut_profiles_updated_at
  before update on public.astronaut_profiles
  for each row execute function public.astronaut_profiles_touch_updated_at();

alter table public.astronaut_profiles enable row level security;

-- Anonymous visitors also carry the `authenticated` role, so every policy also requires a real
-- (non-anonymous) account. `is_anonymous` is set by Supabase Auth, not by the user.
drop policy if exists "read own astronaut profile" on public.astronaut_profiles;
create policy "read own astronaut profile" on public.astronaut_profiles
  for select to authenticated
  using ((select auth.uid()) = user_id and coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) = false);

drop policy if exists "create own astronaut profile" on public.astronaut_profiles;
create policy "create own astronaut profile" on public.astronaut_profiles
  for insert to authenticated
  with check ((select auth.uid()) = user_id and coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) = false);

drop policy if exists "update own astronaut profile" on public.astronaut_profiles;
create policy "update own astronaut profile" on public.astronaut_profiles
  for update to authenticated
  using ((select auth.uid()) = user_id and coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) = false)
  with check ((select auth.uid()) = user_id and coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) = false);

drop policy if exists "delete own astronaut profile" on public.astronaut_profiles;
create policy "delete own astronaut profile" on public.astronaut_profiles
  for delete to authenticated
  using ((select auth.uid()) = user_id and coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) = false);

revoke all on public.astronaut_profiles from anon;
grant select, insert, update, delete on public.astronaut_profiles to authenticated;
