-- ============================================================
--  PlanIA Digital — Semáforo de desempeño (2 oct 2026)
--  Diagnóstico por áreas fundamentales en 4 momentos del ciclo:
--  diagnostico (inicio) · m1 (nov) · m2 (mar) · m3 (may–jun).
--  Niños SOLO por código AL-XX (nunca nombres).
--  Lectura/escritura únicamente vía servidor: RLS activado sin políticas.
-- ============================================================

-- Áreas que evalúa cada jardín (si no hay fila, se usan las 4 predeterminadas)
create table if not exists public.semaforo_areas_jardin (
  cct            text primary key,
  areas          text[] not null,
  actualizado_en timestamptz not null default now(),
  actualizado_por uuid references public.users(id) on delete set null
);

-- Una marca por niño, por área, por momento
create table if not exists public.semaforo_registros (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.users(id) on delete cascade,
  ciclo_escolar  text not null,
  momento        text not null check (momento in ('diagnostico','m1','m2','m3')),
  area           text not null,
  alumno_codigo  text not null,
  nivel          text not null check (nivel in ('suficiente','en_desarrollo','requiere_apoyo','no_evaluado')),
  grado          text,
  grupo_letra    text,
  actualizado_en timestamptz not null default now(),
  constraint semaforo_una_marca unique (user_id, ciclo_escolar, momento, area, alumno_codigo)
);
create index if not exists semaforo_registros_momento_idx on public.semaforo_registros (ciclo_escolar, momento);

-- Envío a dirección de un momento completo
create table if not exists public.semaforo_envios (
  user_id        uuid not null references public.users(id) on delete cascade,
  ciclo_escolar  text not null,
  momento        text not null check (momento in ('diagnostico','m1','m2','m3')),
  enviado_en     timestamptz not null default now(),
  primary key (user_id, ciclo_escolar, momento)
);

alter table public.semaforo_areas_jardin enable row level security;
alter table public.semaforo_registros   enable row level security;
alter table public.semaforo_envios      enable row level security;

comment on table public.semaforo_registros is
  'Semáforo de desempeño por niño (código AL-XX), área y momento. Solo vía servidor.';
