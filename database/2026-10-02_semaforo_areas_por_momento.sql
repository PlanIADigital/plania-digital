-- ============================================================
--  PlanIA Digital — Áreas del semáforo POR MOMENTO (2 oct 2026)
--  La directora define las áreas de su jardín para cada momento.
--  Un momento sin fila propia hereda las del momento anterior del
--  mismo ciclo; sin ninguna, se usan las 4 predeterminadas.
--  Las áreas de un momento quedan fijas en cuanto alguna educadora
--  empieza a marcarlo (regla aplicada en el servidor).
--  (Se recrea: la tabla anterior estaba vacía.)
-- ============================================================
drop table if exists public.semaforo_areas_jardin;

create table public.semaforo_areas_jardin (
  cct             text not null,
  ciclo_escolar   text not null,
  momento         text not null check (momento in ('diagnostico','m1','m2','m3')),
  areas           text[] not null check (array_length(areas, 1) between 1 and 6),
  actualizado_en  timestamptz not null default now(),
  actualizado_por uuid references public.users(id) on delete set null,
  primary key (cct, ciclo_escolar, momento)
);

alter table public.semaforo_areas_jardin enable row level security;

comment on table public.semaforo_areas_jardin is
  'Áreas del semáforo por jardín, ciclo y momento. Solo vía servidor.';
