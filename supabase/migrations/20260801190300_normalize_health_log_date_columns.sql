-- Normalize the Edge Function's date column contract to PostgreSQL's
-- conventional snake_case names. This is idempotent for deployments that
-- already have start_date/end_date.
do $$
begin
  if to_regclass('public.health_logs') is null then
    raise exception 'public.health_logs does not exist; apply the health_data migrations first';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'health_logs'
      and column_name = 'startDate'
  ) and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'health_logs'
      and column_name = 'start_date'
  ) then
    alter table public.health_logs rename column "startDate" to start_date;
  elsif exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'health_logs'
      and column_name = 'startDate'
  ) then
    raise exception 'Both public.health_logs.startDate and public.health_logs.start_date exist';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'health_logs'
      and column_name = 'endDate'
  ) and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'health_logs'
      and column_name = 'end_date'
  ) then
    alter table public.health_logs rename column "endDate" to end_date;
  elsif exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'health_logs'
      and column_name = 'endDate'
  ) then
    raise exception 'Both public.health_logs.endDate and public.health_logs.end_date exist';
  end if;
end $$;
