create table if not exists public.chat_conversations (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  stage text not null check (stage in ('future', 'active', 'retired')), title text not null default 'Horizon chat',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(), conversation_id uuid not null references public.chat_conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade, role text not null check (role in ('user', 'assistant')),
  content text not null check (char_length(content) between 1 and 8000), status text not null default 'complete' check (status in ('complete', 'failed')),
  context_snapshot jsonb, request_id text, created_at timestamptz not null default now()
);
create index if not exists chat_conversations_owner_stage_idx on public.chat_conversations(user_id, stage, updated_at desc);
create index if not exists chat_messages_conversation_idx on public.chat_messages(conversation_id, created_at);
create index if not exists chat_messages_owner_time_idx on public.chat_messages(user_id, role, created_at desc);
create unique index if not exists chat_messages_owner_request_idx on public.chat_messages(user_id, request_id) where request_id is not null;
alter table public.chat_conversations enable row level security;
alter table public.chat_messages enable row level security;
drop policy if exists "chat conversations owner select" on public.chat_conversations;
drop policy if exists "chat conversations owner insert" on public.chat_conversations;
drop policy if exists "chat conversations owner update" on public.chat_conversations;
drop policy if exists "chat conversations owner delete" on public.chat_conversations;
create policy "chat conversations owner select" on public.chat_conversations for select to authenticated using ((select auth.uid()) = user_id);
create policy "chat conversations owner insert" on public.chat_conversations for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "chat conversations owner update" on public.chat_conversations for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "chat conversations owner delete" on public.chat_conversations for delete to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "chat messages owner select" on public.chat_messages;
drop policy if exists "chat messages owner insert" on public.chat_messages;
drop policy if exists "chat messages owner update" on public.chat_messages;
drop policy if exists "chat messages owner delete" on public.chat_messages;
create policy "chat messages owner select" on public.chat_messages for select to authenticated using ((select auth.uid()) = user_id);
create policy "chat messages owner insert" on public.chat_messages for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "chat messages owner update" on public.chat_messages for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "chat messages owner delete" on public.chat_messages for delete to authenticated using ((select auth.uid()) = user_id);
grant select, insert, update, delete on public.chat_conversations to authenticated;
grant select, insert, update, delete on public.chat_messages to authenticated;
