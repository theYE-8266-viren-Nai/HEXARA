-- Radiation observations are daily accumulated dose totals, not dose rates.
alter table public.health_observations
  drop constraint if exists health_observations_check;

update public.health_observations
set unit = 'mSv'
where metric = 'radiation_dose' and unit = 'mSv/day';

alter table public.health_observations
  add constraint health_observations_metric_unit_value_check check (
    (metric='heart_rate' and unit='bpm' and value between 20 and 250) or
    (metric='hrv' and unit='ms' and value between 0 and 300) or
    (metric='sleep_hours' and unit='h' and value between 0 and 24) or
    (metric='skin_temperature' and unit='degC' and value between 20 and 45) or
    (metric='spo2' and unit='%' and value between 0 and 100) or
    (metric='radiation_dose' and unit='mSv' and value between 0 and 100)
  );
