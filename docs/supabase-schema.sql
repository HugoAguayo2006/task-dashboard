create table if not exists public.chalendar_state (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.chalendar_state enable row level security;

-- La app escribe por una funcion serverless con service role key.
-- No se crean politicas publicas para evitar acceso directo desde el navegador.
