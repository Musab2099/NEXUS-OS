-- Health Auto Export's stable source identifier used by PostgREST upserts.
alter table public.health_data
  add column if not exists sample_id text;

-- Preserve existing rows if this migration is applied to a table that already
-- contains data. New rows are written with both id and sample_id by the Edge
-- Function because id remains the table's primary key.
update public.health_data
set sample_id = id
where sample_id is null;

alter table public.health_data
  alter column sample_id set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'health_data_sample_id_key'
      and conrelid = 'public.health_data'::regclass
  ) then
    alter table public.health_data
      add constraint health_data_sample_id_key unique (sample_id);
  end if;
end $$;
