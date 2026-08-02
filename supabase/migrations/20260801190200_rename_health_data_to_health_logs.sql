-- The Edge Function's canonical ingestion table is health_logs.
-- Keep the existing normalized columns and sample_id deduplication contract,
-- while retaining the sanitized Shortcuts payload in data for audit/replay.
do $$
begin
  if to_regclass('public.health_data') is not null
     and to_regclass('public.health_logs') is null then
    alter table public.health_data rename to health_logs;
  elsif to_regclass('public.health_data') is not null
        and to_regclass('public.health_logs') is not null then
    raise exception 'Both public.health_data and public.health_logs exist; resolve the duplicate tables before migrating';
  elsif to_regclass('public.health_data') is null
        and to_regclass('public.health_logs') is null then
    raise exception 'Neither public.health_data nor public.health_logs exists; apply the health_data migrations first';
  end if;
end $$;

-- Constraint names are not part of the runtime contract, but matching names
-- make future schema inspection and troubleshooting much clearer.
do $$
begin
  if exists (
    select 1 from pg_constraint
    where conrelid = 'public.health_logs'::regclass
      and conname = 'health_data_pkey'
  ) then
    alter table public.health_logs
      rename constraint health_data_pkey to health_logs_pkey;
  end if;

  if exists (
    select 1 from pg_constraint
    where conrelid = 'public.health_logs'::regclass
      and conname = 'health_data_id_key'
  ) then
    alter table public.health_logs
      rename constraint health_data_id_key to health_logs_id_key;
  end if;

  if exists (
    select 1 from pg_constraint
    where conrelid = 'public.health_logs'::regclass
      and conname = 'health_data_sample_id_key'
  ) then
    alter table public.health_logs
      rename constraint health_data_sample_id_key to health_logs_sample_id_key;
  end if;
end $$;

alter table public.health_logs
  add column if not exists data jsonb not null default '{}'::jsonb;

comment on column public.health_logs.data is
  'Sanitized JSON payload received from Health Auto Export or Shortcuts.';

-- RLS remains enabled from the original health_data migration. No public
-- policies are added; the Edge Function writes with the server-only service
-- role key after validating APPLE_HEALTH_SYNC_TOKEN.
