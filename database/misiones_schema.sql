-- ============================================================
--  PlanIA Digital — Misiones (Gamificación)
--  database/misiones_schema.sql
--
--  Reemplaza a database/centro_aprendizaje_schema.sql (la sección
--  se llamó "Centro de Aprendizaje" originalmente; las tablas ya
--  fueron renombradas de ca_* a msn_* en Supabase).
--
--  Correr una sola vez en Supabase → SQL Editor → Run.
--  Es seguro volver a correrlo (CREATE ... IF NOT EXISTS y
--  DROP POLICY IF EXISTS antes de cada CREATE POLICY) por si
--  necesitas repetirlo tras un ajuste.
--
--  NO altera ninguna tabla existente (users, plannings, etc.)
-- ============================================================

-- ------------------------------------------------------------
-- 1. msn_misiones — catálogo de misiones/retos disponibles
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS msn_misiones (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo          text NOT NULL,
  descripcion     text,
  tipo            text NOT NULL DEFAULT 'flash' CHECK (tipo IN ('flash', 'semanal')),
  xp_recompensa   integer NOT NULL DEFAULT 0,
  nodo_mazmorra   text CHECK (nodo_mazmorra IN ('Inicio', 'Exploradora', 'Constructora', 'Diseñadora', 'Evaluadora', 'Maestra Guía')),
  ventana_horas   integer,                      -- solo misiones "reto exprés" con ventana de tiempo (NULL = sin límite)
  rol_aplicable   text NOT NULL DEFAULT 'educadora' CHECK (rol_aplicable IN ('educadora', 'directivo', 'musica')),
  orden           integer NOT NULL DEFAULT 0,
  activa          boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE msn_misiones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "msn_misiones_select_autenticados" ON msn_misiones;
CREATE POLICY "msn_misiones_select_autenticados" ON msn_misiones
  FOR SELECT TO authenticated USING (true);

-- ------------------------------------------------------------
-- 2. msn_logros — catálogo de logros/insignias desbloqueables
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS msn_logros (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo          text NOT NULL,
  descripcion     text,
  icono           text,                          -- emoji o clave de ícono
  xp_recompensa   integer NOT NULL DEFAULT 0,
  criterio        jsonb NOT NULL DEFAULT '{}'::jsonb,   -- ej. {"tipo":"misiones_completadas","cantidad":5}
  rol_aplicable   text NOT NULL DEFAULT 'educadora' CHECK (rol_aplicable IN ('educadora', 'directivo', 'musica')),
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE msn_logros ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "msn_logros_select_autenticados" ON msn_logros;
CREATE POLICY "msn_logros_select_autenticados" ON msn_logros
  FOR SELECT TO authenticated USING (true);

-- ------------------------------------------------------------
-- 3. msn_progreso_usuario — progreso, XP y nivel por usuario
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS msn_progreso_usuario (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  rol_aplicable           text NOT NULL DEFAULT 'educadora' CHECK (rol_aplicable IN ('educadora', 'directivo', 'musica')),
  xp_total                integer NOT NULL DEFAULT 0,
  nivel_gamificacion      integer NOT NULL DEFAULT 1,
  nodo_actual             text NOT NULL DEFAULT 'Inicio' CHECK (nodo_actual IN ('Inicio', 'Exploradora', 'Constructora', 'Diseñadora', 'Evaluadora', 'Maestra Guía')),
  misiones_completadas    jsonb NOT NULL DEFAULT '[]'::jsonb,   -- [{"mision_id": "...", "completada_en": "..."}]
  logros_desbloqueados    jsonb NOT NULL DEFAULT '[]'::jsonb,   -- [{"logro_id": "...", "desbloqueado_en": "..."}]
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE msn_progreso_usuario ENABLE ROW LEVEL SECURITY;

-- Cada usuaria solo ve su propio progreso. Los cambios de XP/nivel
-- SIEMPRE pasan por rutas API con supabaseAdmin (bypasea RLS) —
-- por eso no hay política de INSERT/UPDATE para el cliente.
DROP POLICY IF EXISTS "msn_progreso_usuario_select_propio" ON msn_progreso_usuario;
CREATE POLICY "msn_progreso_usuario_select_propio" ON msn_progreso_usuario
  FOR SELECT TO authenticated
  USING (user_id IN (SELECT id FROM users WHERE auth_uid = auth.uid()));

-- ------------------------------------------------------------
-- 4. msn_ranking_cache — cache del leaderboard
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS msn_ranking_cache (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  full_name           text,
  xp_total            integer NOT NULL DEFAULT 0,
  nivel_gamificacion  integer NOT NULL DEFAULT 1,
  rol_aplicable       text NOT NULL DEFAULT 'educadora' CHECK (rol_aplicable IN ('educadora', 'directivo', 'musica')),
  actualizado_en      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS msn_ranking_cache_rol_xp_idx ON msn_ranking_cache (rol_aplicable, xp_total DESC);

ALTER TABLE msn_ranking_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "msn_ranking_cache_select_autenticados" ON msn_ranking_cache;
CREATE POLICY "msn_ranking_cache_select_autenticados" ON msn_ranking_cache
  FOR SELECT TO authenticated USING (true);

-- ------------------------------------------------------------
-- Semilla mínima de misiones (opcional, se puede editar libremente
-- después desde el SQL Editor o desde un panel admin futuro)
-- ------------------------------------------------------------
INSERT INTO msn_misiones (titulo, descripcion, tipo, xp_recompensa, nodo_mazmorra, orden)
SELECT * FROM (VALUES
  ('Explora la NEM 2022', 'Lee el resumen de Fase 2 y responde 3 preguntas rápidas.', 'flash', 20, 'Exploradora', 1),
  ('Arma tu primera planeación guiada', 'Genera una planeación completa con MÍA.', 'semanal', 50, 'Constructora', 2),
  ('Diseña con los 4 campos formativos', 'Crea una planeación que combine al menos 2 campos formativos.', 'semanal', 60, 'Diseñadora', 3)
) AS v(titulo, descripcion, tipo, xp_recompensa, nodo_mazmorra, orden)
WHERE NOT EXISTS (SELECT 1 FROM msn_misiones);

-- ------------------------------------------------------------
-- Semilla mínima de logros (opcional, se puede editar libremente
-- después desde el SQL Editor o desde un panel admin futuro)
-- ------------------------------------------------------------
INSERT INTO msn_logros (titulo, descripcion, icono, xp_recompensa, criterio)
SELECT * FROM (VALUES
  ('Primeros pasos', 'Completa tu primera misión.', '🌱', 10, '{"tipo":"misiones_completadas","cantidad":1}'::jsonb),
  ('En racha', 'Completa 2 misiones.', '🔥', 15, '{"tipo":"misiones_completadas","cantidad":2}'::jsonb),
  ('Maestra en construcción', 'Completa las 3 misiones disponibles.', '🏆', 30, '{"tipo":"misiones_completadas","cantidad":3}'::jsonb)
) AS v(titulo, descripcion, icono, xp_recompensa, criterio)
WHERE NOT EXISTS (SELECT 1 FROM msn_logros);
