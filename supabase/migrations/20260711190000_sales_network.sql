alter table public.lead_records drop constraint if exists lead_records_status_check;
alter table public.lead_records drop constraint if exists lead_records_place_id_key;
alter table public.lead_records
  add column if not exists next_follow_up_at timestamptz,
  add column if not exists contact_count integer not null default 0,
  add column if not exists source_province text,
  add column if not exists source_sector text,
  add column if not exists last_activity_at timestamptz not null default now();
alter table public.lead_records
  add constraint lead_records_status_check check (status in ('new', 'contacted', 'replied', 'interested', 'demo_sent', 'follow_up', 'not_suitable', 'no_whatsapp', 'opted_out', 'customer', 'archived'));
alter table public.lead_records drop constraint if exists lead_records_user_place_unique;
alter table public.lead_records add constraint lead_records_user_place_unique unique (user_id, place_id);

alter table public.app_settings
  add column if not exists website_follow_up_message text not null default '',
  add column if not exists accounting_follow_up_message text not null default '',
  add column if not exists first_follow_up_days integer not null default 3,
  add column if not exists final_follow_up_days integer not null default 7,
  add column if not exists max_follow_ups integer not null default 2;

create table if not exists public.lead_activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  lead_record_id uuid not null references public.lead_records(id) on delete cascade,
  activity_type text not null check (activity_type in ('status', 'message', 'follow_up', 'reply', 'demo', 'note', 'customer', 'opt_out')),
  from_status text,
  to_status text,
  note text,
  created_at timestamptz not null default now()
);

create table if not exists public.referral_partners (
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

create index if not exists lead_records_follow_up_idx on public.lead_records(user_id, next_follow_up_at) where next_follow_up_at is not null;
create index if not exists lead_activities_lead_idx on public.lead_activities(user_id, lead_record_id, created_at desc);
create index if not exists referral_partners_user_status_idx on public.referral_partners(user_id, status, next_follow_up_at);

drop trigger if exists referral_partners_set_updated_at on public.referral_partners;
create trigger referral_partners_set_updated_at before update on public.referral_partners
for each row execute function public.set_updated_at();

alter table public.lead_activities enable row level security;
alter table public.referral_partners enable row level security;

drop policy if exists "lead_activities_select_own" on public.lead_activities;
drop policy if exists "lead_activities_insert_own" on public.lead_activities;
drop policy if exists "lead_activities_update_own" on public.lead_activities;
drop policy if exists "lead_activities_delete_own" on public.lead_activities;
create policy "lead_activities_select_own" on public.lead_activities for select using (auth.uid() = user_id);
create policy "lead_activities_insert_own" on public.lead_activities for insert with check (auth.uid() = user_id);
create policy "lead_activities_update_own" on public.lead_activities for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "lead_activities_delete_own" on public.lead_activities for delete using (auth.uid() = user_id);

drop policy if exists "referral_partners_select_own" on public.referral_partners;
drop policy if exists "referral_partners_insert_own" on public.referral_partners;
drop policy if exists "referral_partners_update_own" on public.referral_partners;
drop policy if exists "referral_partners_delete_own" on public.referral_partners;
create policy "referral_partners_select_own" on public.referral_partners for select using (auth.uid() = user_id);
create policy "referral_partners_insert_own" on public.referral_partners for insert with check (auth.uid() = user_id);
create policy "referral_partners_update_own" on public.referral_partners for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "referral_partners_delete_own" on public.referral_partners for delete using (auth.uid() = user_id);
