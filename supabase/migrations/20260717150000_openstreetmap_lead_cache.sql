alter table public.lead_records
  add column if not exists data_source text not null default 'legacy',
  add column if not exists details_cache jsonb,
  add column if not exists details_cached_at timestamptz;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'lead_records_data_source_check'
      and conrelid = 'public.lead_records'::regclass
  ) then
    alter table public.lead_records
      add constraint lead_records_data_source_check
      check (data_source in ('openstreetmap', 'mock', 'legacy'));
  end if;
end;
$$;

create index if not exists lead_records_uncontacted_cache_idx
  on public.lead_records(user_id, lead_type, created_at desc)
  where status = 'new' and details_cache is not null;

comment on column public.lead_records.details_cache is
  'OpenStreetMap/Nominatim sonucunun, dış servis kesintisinde mesaj gönderilmemiş adayları göstermek için saklanan özeti.';
