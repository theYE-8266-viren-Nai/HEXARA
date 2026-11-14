-- Allow anchored_lower_body_flexion (Active Movement task) in visual_checks.check_type
-- The existing constraint visual_checks_check_type_check did not list this value,
-- so Active movement checks could not be saved to cloud.
do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'visual_checks_check_type_check'
    and conrelid = 'public.visual_checks'::regclass
  ) then
    alter table public.visual_checks drop constraint visual_checks_check_type_check;
  end if;
end $$;

alter table public.visual_checks
add constraint visual_checks_check_type_check
check (check_type in ('standing_posture','shoulder_mobility','sit_to_stand','single_leg_balance','reach_and_return','anchored_lower_body_flexion'));
