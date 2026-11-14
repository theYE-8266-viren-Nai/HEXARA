alter table public.chat_messages
  add column if not exists category text,
  add column if not exists input_mode text not null default 'text';

alter table public.chat_messages
  drop constraint if exists chat_messages_input_mode_check;
alter table public.chat_messages
  add constraint chat_messages_input_mode_check check (input_mode in ('text', 'voice'));

create index if not exists chat_messages_category_idx on public.chat_messages(user_id, category, created_at desc);
