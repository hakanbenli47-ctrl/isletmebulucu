alter table public.lead_records
  add column if not exists phone_normalized text;

alter table public.lead_records
  drop constraint if exists lead_records_status_check;

alter table public.lead_records
  drop constraint if exists lead_records_phone_normalized_check;

alter table public.lead_records
  add constraint lead_records_status_check check (
    status in (
      'new',
      'contacted',
      'replied',
      'interested',
      'demo_sent',
      'follow_up',
      'no_reply',
      'not_approved',
      'not_suitable',
      'no_whatsapp',
      'opted_out',
      'customer',
      'archived'
    )
  );

alter table public.lead_records
  add constraint lead_records_phone_normalized_check check (
    phone_normalized is null or phone_normalized ~ '^90[0-9]{10}$'
  );

create index if not exists lead_records_user_phone_idx
  on public.lead_records(user_id, phone_normalized)
  where phone_normalized is not null;
