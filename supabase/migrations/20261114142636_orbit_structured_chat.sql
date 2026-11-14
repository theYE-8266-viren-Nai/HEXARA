-- Structured, EcoLink-style answer metadata for ORBIT.
-- These fields are snapshots of validated educational output; raw readings and private notes remain excluded.
alter table public.chat_messages
  add column if not exists key_points jsonb not null default '[]'::jsonb,
  add column if not exists next_steps jsonb not null default '[]'::jsonb,
  add column if not exists warnings jsonb not null default '[]'::jsonb,
  add column if not exists questions_to_explore jsonb not null default '[]'::jsonb,
  add column if not exists confidence text not null default 'medium';

alter table public.chat_messages
  drop constraint if exists chat_messages_structured_arrays_check;
alter table public.chat_messages
  add constraint chat_messages_structured_arrays_check check (
    jsonb_typeof(key_points) = 'array' and
    jsonb_typeof(next_steps) = 'array' and
    jsonb_typeof(warnings) = 'array' and
    jsonb_typeof(questions_to_explore) = 'array'
  );

alter table public.chat_messages
  drop constraint if exists chat_messages_confidence_check;
alter table public.chat_messages
  add constraint chat_messages_confidence_check check (confidence in ('high', 'medium', 'low'));
