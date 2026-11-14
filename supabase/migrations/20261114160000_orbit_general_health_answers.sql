-- Allow ORBIT to store clearly labelled general health information when the NASA index has no supporting source.
-- Replaces the answer_kind check constraint (whatever its generated name) with one that adds 'general_health'.
do $$
declare constraint_name text;
begin
  for constraint_name in
    select conname from pg_constraint
    where conrelid = 'public.chat_messages'::regclass and contype = 'c' and pg_get_constraintdef(oid) ilike '%answer_kind%'
  loop
    execute format('alter table public.chat_messages drop constraint %I', constraint_name);
  end loop;
end $$;

alter table public.chat_messages
  add constraint chat_messages_answer_kind_check
  check (answer_kind in ('nasa_grounded', 'general_health', 'no_evidence', 'urgent_warning', 'unavailable'));
