-- ============================================================================
-- NEXUS-OS — Cross-device sync state table
--
-- Creates the shared JSON state store used by every tracker. With auth removed,
-- user_id is TEXT and every client uses the fixed identity 'nexus-ibrahim'.
--
-- Apply with: npx supabase db push --yes
-- Or paste this file into Supabase Dashboard → SQL Editor → Run.
-- ============================================================================

begin;

create table if not exists public.nexus_state (
  user_id text not null default 'nexus-ibrahim',
  key text not null,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);

alter table public.nexus_state enable row level security;

drop policy if exists "nexus_state anon full access" on public.nexus_state;
create policy "nexus_state anon full access"
  on public.nexus_state
  for all
  to anon, authenticated
  using (user_id = 'nexus-ibrahim')
  with check (user_id = 'nexus-ibrahim');

grant select, insert, update, delete on public.nexus_state to anon, authenticated;

-- Preserve older per-date workout records when that auth-era table exists.
-- Map each old row to the shared identity; do not rewrite UUID owner columns
-- in the old tables (they still reference auth.users and are not used by the
-- no-auth sync client).
do $$
begin
  if to_regclass('public.workout_logs') is not null then
    execute $copy$
      insert into public.nexus_state (user_id, key, data, updated_at)
      select 'nexus-ibrahim', 'nexus_workout_' || l.date::text,
             l.workout_data, coalesce(l.updated_at, now())
      from public.workout_logs as l
      where l.date is not null
      on conflict (user_id, key) do nothing
    $copy$;
  end if;
end
$$;

commit;
