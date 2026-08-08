-- NEXUS Auth data isolation.
-- Apply this migration after enabling Supabase Email Auth.

create table if not exists public.app_state (
  user_id uuid references auth.users(id) on delete cascade,
  key text not null,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.app_state add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.app_state add column if not exists updated_at timestamptz not null default now();
alter table public.app_state drop constraint if exists app_state_pkey;
-- Existing anonymous rows are retained but remain inaccessible under the RLS
-- policy until an administrator explicitly assigns ownership. New browser
-- writes always include user_id.
create unique index if not exists app_state_user_key_idx on public.app_state(user_id, key);
alter table public.app_state enable row level security;
drop policy if exists "Users can manage their own app state" on public.app_state;
create policy "Users can manage their own app state"
  on public.app_state for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create table if not exists public.workout_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  day text,
  day_name text,
  session_date timestamptz not null default now(),
  duration integer,
  skills jsonb not null default '[]'::jsonb,
  log jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.workout_sessions add column if not exists user_id uuid references auth.users(id) on delete cascade;
-- Existing rows without an owner remain inaccessible under RLS. Assign them
-- explicitly before making user_id NOT NULL, if they should be preserved.
create index if not exists workout_sessions_user_id_idx on public.workout_sessions(user_id);
alter table public.workout_sessions enable row level security;
drop policy if exists "Users can manage their own workout sessions" on public.workout_sessions;
create policy "Users can manage their own workout sessions"
  on public.workout_sessions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
