alter table public.app_settings
  add column if not exists instagram_message text not null default '',
  add column if not exists instagram_follow_up_message text not null default '';
