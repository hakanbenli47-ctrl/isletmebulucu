create extension if not exists pgcrypto;

create table public.lead_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  place_id text not null,
  lead_type text not null check (lead_type in ('website', 'accounting')),
  status text not null default 'new' check (status in ('new', 'contacted', 'replied', 'interested', 'demo_sent', 'follow_up', 'not_suitable', 'no_whatsapp', 'opted_out', 'customer', 'archived')),
  contacted_at timestamptz,
  next_follow_up_at timestamptz,
  contact_count integer not null default 0 check (contact_count between 0 and 20),
  notes text,
  source_province text,
  source_sector text,
  last_activity_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, place_id)
);

create table public.search_states (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  lead_type text not null check (lead_type in ('website', 'accounting')),
  province_index integer not null default 0 check (province_index between 0 and 80),
  sector_index integer not null default 0 check (sector_index >= 0),
  updated_at timestamptz not null default now(),
  unique (user_id, lead_type)
);

create table public.message_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  lead_type text not null check (lead_type in ('website', 'accounting')),
  message text not null check (char_length(message) between 1 and 5000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, lead_type)
);

create table public.app_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade unique,
  results_per_search integer not null default 50 check (results_per_search between 1 and 50),
  daily_contact_goal integer not null default 25 check (daily_contact_goal between 1 and 500),
  website_sectors jsonb not null default '[]'::jsonb,
  accounting_sectors jsonb not null default '[]'::jsonb,
  website_follow_up_message text not null default '',
  accounting_follow_up_message text not null default '',
  instagram_message text not null default '',
  instagram_follow_up_message text not null default '',
  first_follow_up_days integer not null default 3 check (first_follow_up_days between 1 and 30),
  final_follow_up_days integer not null default 7 check (final_follow_up_days between 2 and 60),
  max_follow_ups integer not null default 2 check (max_follow_ups between 0 and 3),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.search_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  lead_type text not null check (lead_type in ('website', 'accounting')),
  requested_count integer not null check (requested_count between 1 and 50),
  returned_count integer not null check (returned_count >= 0),
  api_call_count integer not null check (api_call_count >= 0),
  created_at timestamptz not null default now()
);

create table public.lead_activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  lead_record_id uuid not null references public.lead_records(id) on delete cascade,
  activity_type text not null check (activity_type in ('status', 'message', 'follow_up', 'reply', 'demo', 'note', 'customer', 'opt_out')),
  from_status text,
  to_status text,
  note text,
  created_at timestamptz not null default now()
);

create table public.referral_partners (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 160),
  partner_type text not null check (partner_type in ('accountant', 'it', 'printing', 'agency', 'supplier', 'customer', 'other')),
  contact text not null default '',
  status text not null default 'candidate' check (status in ('candidate', 'contacted', 'active', 'paused')),
  notes text,
  referrals_count integer not null default 0 check (referrals_count >= 0),
  customers_count integer not null default 0 check (customers_count >= 0),
  next_follow_up_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index lead_records_user_status_idx on public.lead_records(user_id, status, lead_type);
create index lead_records_contacted_at_idx on public.lead_records(user_id, contacted_at desc);
create index lead_records_follow_up_idx on public.lead_records(user_id, next_follow_up_at) where next_follow_up_at is not null;
create index search_runs_user_created_idx on public.search_runs(user_id, created_at desc);
create index lead_activities_lead_idx on public.lead_activities(user_id, lead_record_id, created_at desc);
create index referral_partners_user_status_idx on public.referral_partners(user_id, status, next_follow_up_at);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger lead_records_set_updated_at before update on public.lead_records
for each row execute function public.set_updated_at();
create trigger search_states_set_updated_at before update on public.search_states
for each row execute function public.set_updated_at();
create trigger message_templates_set_updated_at before update on public.message_templates
for each row execute function public.set_updated_at();
create trigger app_settings_set_updated_at before update on public.app_settings
for each row execute function public.set_updated_at();
create trigger referral_partners_set_updated_at before update on public.referral_partners
for each row execute function public.set_updated_at();

alter table public.lead_records enable row level security;
alter table public.search_states enable row level security;
alter table public.message_templates enable row level security;
alter table public.app_settings enable row level security;
alter table public.search_runs enable row level security;
alter table public.lead_activities enable row level security;
alter table public.referral_partners enable row level security;

create policy "lead_records_select_own" on public.lead_records for select using (auth.uid() = user_id);
create policy "lead_records_insert_own" on public.lead_records for insert with check (auth.uid() = user_id);
create policy "lead_records_update_own" on public.lead_records for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "lead_records_delete_own" on public.lead_records for delete using (auth.uid() = user_id);

create policy "search_states_select_own" on public.search_states for select using (auth.uid() = user_id);
create policy "search_states_insert_own" on public.search_states for insert with check (auth.uid() = user_id);
create policy "search_states_update_own" on public.search_states for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "search_states_delete_own" on public.search_states for delete using (auth.uid() = user_id);

create policy "message_templates_select_own" on public.message_templates for select using (auth.uid() = user_id);
create policy "message_templates_insert_own" on public.message_templates for insert with check (auth.uid() = user_id);
create policy "message_templates_update_own" on public.message_templates for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "message_templates_delete_own" on public.message_templates for delete using (auth.uid() = user_id);

create policy "app_settings_select_own" on public.app_settings for select using (auth.uid() = user_id);
create policy "app_settings_insert_own" on public.app_settings for insert with check (auth.uid() = user_id);
create policy "app_settings_update_own" on public.app_settings for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "app_settings_delete_own" on public.app_settings for delete using (auth.uid() = user_id);

create policy "search_runs_select_own" on public.search_runs for select using (auth.uid() = user_id);
create policy "search_runs_insert_own" on public.search_runs for insert with check (auth.uid() = user_id);
create policy "search_runs_update_own" on public.search_runs for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "search_runs_delete_own" on public.search_runs for delete using (auth.uid() = user_id);

create policy "lead_activities_select_own" on public.lead_activities for select using (auth.uid() = user_id);
create policy "lead_activities_insert_own" on public.lead_activities for insert with check (auth.uid() = user_id);
create policy "lead_activities_update_own" on public.lead_activities for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "lead_activities_delete_own" on public.lead_activities for delete using (auth.uid() = user_id);

create policy "referral_partners_select_own" on public.referral_partners for select using (auth.uid() = user_id);
create policy "referral_partners_insert_own" on public.referral_partners for insert with check (auth.uid() = user_id);
create policy "referral_partners_update_own" on public.referral_partners for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "referral_partners_delete_own" on public.referral_partners for delete using (auth.uid() = user_id);
