-- NEXUS per-date workout persistence.
-- Each authenticated user owns one upsertable JSON document per local calendar date.
create table if not exists public.workout_logs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  date date not null,
  workout_data jsonb not null,
  created_at timestamp default now(),
  updated_at timestamp default now()
);

create unique index if not exists workout_logs_user_date_idx
  on public.workout_logs(user_id, date);

alter table public.workout_logs enable row level security;
drop policy if exists "Users can only access own logs" on public.workout_logs;
create policy "Users can only access own logs"
  on public.workout_logs for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
