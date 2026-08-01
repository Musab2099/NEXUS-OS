-- Apple Health workout metrics received by the iOS Shortcut endpoint.
-- The Vercel function uses SUPABASE_SERVICE_ROLE_KEY for inserts.
create table if not exists public.apple_health_logs (
  id uuid primary key default gen_random_uuid(),
  user_id text,
  external_id text,
  workout_date date not null,
  workout_type text not null check (char_length(workout_type) between 1 and 120),
  active_calories numeric(10, 2) not null check (active_calories >= 0),
  avg_heart_rate numeric(6, 2) check (avg_heart_rate is null or (avg_heart_rate >= 0 and avg_heart_rate <= 300)),
  duration_minutes numeric(8, 2) not null check (duration_minutes >= 0),
  source text not null default 'apple_health',
  -- Preserve the original Health Auto Export workout/metric fields after
  -- recursively sanitizing quantity-shaped values into JSON-safe primitives.
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.apple_health_logs
  add column if not exists external_id text;

alter table public.apple_health_logs
  add column if not exists metadata jsonb;

-- Repair older installations where the column existed without the current
-- default or nullability guarantees.
update public.apple_health_logs
set metadata = '{}'::jsonb
where metadata is null;

alter table public.apple_health_logs
  alter column metadata set default '{}'::jsonb,
  alter column metadata set not null;

drop index if exists public.apple_health_logs_external_id_uidx;

-- A normal UNIQUE constraint allows multiple NULL external_id values while
-- remaining discoverable by PostgREST's on_conflict=external_id upsert.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'apple_health_logs_external_id_key'
      and conrelid = 'public.apple_health_logs'::regclass
  ) then
    alter table public.apple_health_logs
      add constraint apple_health_logs_external_id_key unique (external_id);
  end if;
end $$;

create index if not exists apple_health_logs_workout_date_idx
  on public.apple_health_logs (workout_date, created_at desc);

create index if not exists apple_health_logs_created_at_idx
  on public.apple_health_logs (created_at desc);

alter table public.apple_health_logs enable row level security;

-- The browser never reads this table with a public anon policy. Dashboard reads
-- go through the server-side read endpoint, which authenticates with the same
-- private token and uses the service role key.
drop policy if exists "Apple Health logs are readable" on public.apple_health_logs;

-- Do not add anon SELECT/INSERT/UPDATE/DELETE policies. The API routes use the
-- Supabase service-role key, which bypasses RLS without exposing that key.
