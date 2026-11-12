-- Horizon Visual Check: derived, non-diagnostic movement-practice summaries.
-- No video, image, or frame columns exist by design.
create table if not exists public.visual_checks (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  owner_key text not null,
  check_type text not null check (check_type in ('standing_posture','shoulder_mobility','sit_to_stand','single_leg_balance','reach_and_return')),
  started_at timestamptz not null,
  completed_at timestamptz,
  completion_status text not null check (completion_status in ('completed','partial','not_assessable')),
  observed_features jsonb not null default '{}'::jsonb,
  user_reported_context jsonb not null default '{}'::jsonb,
  comparison_summary jsonb not null default '{}'::jsonb,
  support_recommendation text not null,
  camera_quality text not null check (camera_quality in ('good','limited','poor')),
  is_synthetic boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists visual_checks_user_type_started_idx on public.visual_checks (user_id, check_type, started_at desc);

alter table public.visual_checks enable row level security;

create policy "own visual checks" on public.visual_checks for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.visual_checks to authenticated;
