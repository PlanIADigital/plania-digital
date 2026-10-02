-- ============================================================
--  PlanIA Digital — Asistencia diaria (2 oct 2026)
--  Una fila por educadora por día: solo CANTIDADES (nunca nombres).
--  Escritura y lectura SOLO desde el servidor (llave de servicio):
--  RLS activado sin políticas = el navegador no puede leer ni escribir.
-- ============================================================
create table if not exists public.asistencia_diaria (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.users(id) on delete cascade,
  fecha          date not null,
  ciclo_escolar  text not null,
  grado          text,
  grupo_letra    text,
  presentes      integer not null check (presentes >= 0),
  total          integer not null check (total > 0),
  creado_en      timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  constraint asistencia_presentes_max check (presentes <= total),
  constraint asistencia_un_registro_por_dia unique (user_id, fecha)
);

create index if not exists asistencia_diaria_fecha_idx on public.asistencia_diaria (fecha);

alter table public.asistencia_diaria enable row level security;

comment on table public.asistencia_diaria is
  'Asistencia diaria por grupo (solo cantidades). Escritura/lectura únicamente vía servidor.';
