-- Direct Health Auto Export records for PostgREST ingestion.
-- Camel-case column names are quoted so PostgREST JSON keys remain startDate/endDate.
create table if not exists public.health_data (
  id text primary key,
  name text,
  "startDate" timestamptz,
  "endDate" timestamptz,
  qty numeric,
  units text,
  metadata jsonb not null default '{}'::jsonb
);

-- The primary key is already unique; keep a named UNIQUE constraint as an
-- explicit PostgREST/on_conflict contract for direct deduplication requests.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'health_data_id_key'
      and conrelid = 'public.health_data'::regclass
  ) then
    alter table public.health_data
      add constraint health_data_id_key unique (id);
  end if;
end $$;

alter table public.health_data enable row level security;

-- No public policies are created. Direct PostgREST ingestion must use a
-- server-side/service-role credential; that key bypasses RLS and must never be
-- embedded in Health Auto Export configuration or browser code.
