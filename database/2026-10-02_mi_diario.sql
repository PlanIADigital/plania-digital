-- ============================================================
--  PlanIA Digital — Mi diario (2 oct 2026)
--  Notas por voz de la educadora: grupo o código AL-XX (nunca
--  nombres). El audio NO se guarda; solo el texto validado.
--  RLS activado SIN políticas: acceso solo desde el servidor.
-- ============================================================

create table if not exists public.diario_notas (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.users(id) on delete cascade,
  cct              text,
  ciclo_escolar    text not null,
  destinatario     text not null check (destinatario = 'grupo' or destinatario ~ '^AL-[0-9]+$'),
  tipo             text not null check (tipo in ('observacion', 'incidente')),
  sucedido_en      timestamptz not null,
  registrado_en    timestamptz not null default now(),
  estado           text not null default 'activa' check (estado in ('activa', 'anulada')),
  anulada_en       timestamptz,
  motivo_anulacion text,
  version_actual   integer not null default 1,
  check (estado = 'activa' or (anulada_en is not null and coalesce(trim(motivo_anulacion), '') <> ''))
);
create index if not exists diario_notas_user_ciclo_idx on public.diario_notas (user_id, ciclo_escolar, sucedido_en desc);

create table if not exists public.diario_versiones (
  id        uuid primary key default gen_random_uuid(),
  nota_id   uuid not null references public.diario_notas(id) on delete cascade,
  numero    integer not null check (numero >= 1),
  texto     text not null check (length(trim(texto)) > 0),
  origen    text not null check (origen in ('transcripcion', 'edicion', 'agregado')),
  creado_en timestamptz not null default now(),
  unique (nota_id, numero)
);

-- Cada transcripción cuenta para el tope mensual (300 min) y el costo
-- real, aunque la educadora la descarte y vuelva a grabar.
create table if not exists public.diario_transcripciones (
  id        uuid primary key default gen_random_uuid(),
  user_id   uuid not null references public.users(id) on delete cascade,
  segundos  numeric(8,2) not null check (segundos >= 0),
  costo_usd numeric(10,6) not null default 0,
  modelo    text not null,
  creado_en timestamptz not null default now()
);
create index if not exists diario_transcripciones_user_idx on public.diario_transcripciones (user_id, creado_en desc);

alter table public.diario_notas           enable row level security;
alter table public.diario_versiones       enable row level security;
alter table public.diario_transcripciones enable row level security;
