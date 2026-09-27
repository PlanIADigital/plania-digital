-- ============================================================
--  PlanIA Digital — Saneamiento Fase 1 (NEE y ajustes razonables)
--  database/2026-09-27_saneamiento_fase1_nee.sql
--  Aplicado en producción (Supabase SQL Editor) el 27 sep 2026.
--  Rama: saneamiento/fase1-nee
-- ============================================================

-- ------------------------------------------------------------
-- 1) Apoyos como dato del alumno (un solo código AL-XX por niño;
--    se retira users.alumnos_inclusion con iniciales).
--    Enfoque BAP: barreras y apoyos observables, sin diagnósticos.
--    MÍA sugiere (apoyos_origen = 'mia'); solo lo que la educadora
--    CONFIRMA llega a las planeaciones como ajustes razonables.
-- ------------------------------------------------------------
ALTER TABLE public.alumnos_codigo
  ADD COLUMN IF NOT EXISTS requiere_apoyos boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS apoyos text,
  ADD COLUMN IF NOT EXISTS apoyos_origen text,
  ADD COLUMN IF NOT EXISTS apoyos_confirmado_en timestamptz;

ALTER TABLE public.alumnos_codigo
  DROP CONSTRAINT IF EXISTS alumnos_codigo_apoyos_origen_check;

ALTER TABLE public.alumnos_codigo
  ADD CONSTRAINT alumnos_codigo_apoyos_origen_check
  CHECK (apoyos_origen IS NULL OR apoyos_origen IN ('mia', 'educadora'));

-- ------------------------------------------------------------
-- 2) Unicidad por ciclo. Antes era (user_id, codigo): el siguiente
--    ciclo escolar no habría podido crear AL-01 de nuevo. Ahora cada
--    ciclo es un grupo nuevo que empieza en AL-01; dentro del ciclo
--    el código nunca se repite ni se reutiliza (incluye bajas).
-- ------------------------------------------------------------
ALTER TABLE public.alumnos_codigo
  DROP CONSTRAINT IF EXISTS alumnos_codigo_user_codigo_unique;

DROP INDEX IF EXISTS public.alumnos_codigo_user_codigo_unique;

ALTER TABLE public.alumnos_codigo
  ADD CONSTRAINT alumnos_codigo_user_ciclo_codigo_unique
  UNIQUE (user_id, ciclo_escolar, codigo);

-- ------------------------------------------------------------
-- Nota: users.alumnos_inclusion ya no la lee ni la escribe ningún
-- archivo. Se conserva la columna (solo la cuenta de prueba tenía
-- datos); retirarla queda para la fase de limpieza.
-- ------------------------------------------------------------
