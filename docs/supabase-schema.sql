create table if not exists public.chalendar_state (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.chalendar_state enable row level security;

create table if not exists public.chalendar_push_subscriptions (
  endpoint text primary key,
  p256dh text not null,
  auth text not null,
  sync_id text not null default 'default',
  timezone text not null default 'America/Mexico_City',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists chalendar_push_subscriptions_sync_id_idx
  on public.chalendar_push_subscriptions (sync_id);

alter table public.chalendar_push_subscriptions enable row level security;

create table if not exists public.chalendar_sent_reminders (
  reminder_id text not null,
  endpoint text not null,
  sent_at timestamptz not null default now(),
  primary key (reminder_id, endpoint)
);

alter table public.chalendar_sent_reminders enable row level security;

-- La app escribe por funciones serverless con service role key.
-- No se crean politicas publicas para evitar acceso directo desde el navegador.
