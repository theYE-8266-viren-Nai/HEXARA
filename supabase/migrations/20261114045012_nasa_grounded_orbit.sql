-- Server-only NASA document index for grounded ORBIT answers.
create extension if not exists vector with schema extensions;

create table public.nasa_documents (
  id uuid primary key default gen_random_uuid(),
  source_id text not null unique check (char_length(source_id) between 1 and 240),
  title text not null check (char_length(title) between 1 and 500),
  url text not null check (url ~ '^https://([a-z0-9-]+\.)*(nasa\.gov|nasa\.mil)/'),
  collection text not null check (char_length(collection) between 1 and 120),
  published_at date,
  revised_at date,
  checksum text not null check (char_length(checksum) between 16 and 128),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.nasa_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.nasa_documents(id) on delete cascade,
  chunk_index integer not null check (chunk_index >= 0),
  section_title text,
  content text not null check (char_length(content) between 40 and 12000),
  fts tsvector generated always as (to_tsvector('english', coalesce(section_title, '') || ' ' || content)) stored,
  embedding extensions.vector(384) not null,
  created_at timestamptz not null default now(),
  unique (document_id, chunk_index)
);

create index nasa_chunks_fts_idx on public.nasa_chunks using gin (fts);
create index nasa_chunks_embedding_idx on public.nasa_chunks using hnsw (embedding extensions.vector_cosine_ops);
create index nasa_documents_active_collection_idx on public.nasa_documents (active, collection);

alter table public.nasa_documents enable row level security;
alter table public.nasa_chunks enable row level security;
revoke all on public.nasa_documents from anon, authenticated;
revoke all on public.nasa_chunks from anon, authenticated;
grant select, insert, update, delete on public.nasa_documents to service_role;
grant select, insert, update, delete on public.nasa_chunks to service_role;

alter table public.chat_messages
  add column if not exists answer_kind text not null default 'unavailable'
    check (answer_kind in ('nasa_grounded', 'no_evidence', 'urgent_warning', 'unavailable')),
  add column if not exists citations jsonb not null default '[]'::jsonb
    check (jsonb_typeof(citations) = 'array'),
  add column if not exists sanitized_query text;

create or replace function public.search_nasa_chunks(
  query_text text,
  query_embedding extensions.vector(384),
  match_count integer default 8
)
returns table (
  chunk_id uuid,
  document_id uuid,
  source_id text,
  title text,
  url text,
  collection text,
  published_at date,
  section_title text,
  content text,
  semantic_similarity double precision,
  combined_score double precision
)
language sql
stable
security invoker
set search_path = ''
as $$
  with lexical as (
    select c.id,
      row_number() over (order by ts_rank_cd(c.fts, websearch_to_tsquery('english', query_text)) desc) as rank
    from public.nasa_chunks c
    join public.nasa_documents d on d.id = c.document_id
    where d.active and c.fts @@ websearch_to_tsquery('english', query_text)
    order by rank
    limit 20
  ),
  semantic as (
    select c.id,
      row_number() over (order by c.embedding operator(extensions.<=>) query_embedding) as rank,
      1 - (c.embedding operator(extensions.<=>) query_embedding) as similarity
    from public.nasa_chunks c
    join public.nasa_documents d on d.id = c.document_id
    where d.active
    order by c.embedding operator(extensions.<=>) query_embedding
    limit 20
  ),
  fused as (
    select coalesce(l.id, s.id) as id,
      s.similarity,
      coalesce(1.0 / (50 + l.rank), 0) + coalesce(1.0 / (50 + s.rank), 0) as score,
      l.rank as lexical_rank
    from lexical l
    full outer join semantic s on s.id = l.id
  )
  select c.id, d.id, d.source_id, d.title, d.url, d.collection, d.published_at,
    c.section_title, c.content, coalesce(f.similarity, 0), f.score
  from fused f
  join public.nasa_chunks c on c.id = f.id
  join public.nasa_documents d on d.id = c.document_id
  where f.lexical_rank is not null or f.similarity >= 0.70
  order by f.score desc
  limit greatest(1, least(match_count, 8));
$$;

revoke all on function public.search_nasa_chunks(text, extensions.vector, integer) from public, anon, authenticated;
grant execute on function public.search_nasa_chunks(text, extensions.vector, integer) to service_role;

create or replace function public.replace_nasa_document(p_document jsonb, p_chunks jsonb)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_document_id uuid;
begin
  if jsonb_typeof(p_document) <> 'object' or jsonb_typeof(p_chunks) <> 'array' or jsonb_array_length(p_chunks) = 0 then
    raise exception 'invalid_nasa_document_payload';
  end if;

  insert into public.nasa_documents (source_id, title, url, collection, published_at, revised_at, checksum, metadata, active, updated_at)
  values (
    p_document->>'source_id', p_document->>'title', p_document->>'url', p_document->>'collection',
    nullif(p_document->>'published_at', '')::date, nullif(p_document->>'revised_at', '')::date,
    p_document->>'checksum', coalesce(p_document->'metadata', '{}'::jsonb), true, now()
  )
  on conflict (source_id) do update set
    title = excluded.title, url = excluded.url, collection = excluded.collection,
    published_at = excluded.published_at, revised_at = excluded.revised_at,
    checksum = excluded.checksum, metadata = excluded.metadata, active = true, updated_at = now()
  returning id into v_document_id;

  delete from public.nasa_chunks where document_id = v_document_id;
  insert into public.nasa_chunks (document_id, chunk_index, section_title, content, embedding)
  select v_document_id, (item->>'chunk_index')::integer, nullif(item->>'section_title', ''),
    item->>'content', (item->>'embedding')::extensions.vector
  from jsonb_array_elements(p_chunks) item;

  return v_document_id;
end;
$$;

revoke all on function public.replace_nasa_document(jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.replace_nasa_document(jsonb, jsonb) to service_role;
