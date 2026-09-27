-- ============================================================
--  PlanIA Digital — Saneamiento Fase 1 (Mi Avance + directivo)
--  database/2026-09-26_saneamiento_fase1.sql
--  Aplicado en producción (Supabase SQL Editor) el 26-27 sep 2026.
--  Rama: saneamiento/fase1-mi-avance
-- ============================================================

-- ------------------------------------------------------------
-- 1) Calendario Nuevo León 2026-2027: inicio_clases capturado mal.
--    Decía 2026-08-01; el inicio real de clases con alumnos fue el
--    2026-08-31 (igual que los otros 31 estados y el federal).
--    Efecto del error: se podía planear del 1 al 30 de agosto como
--    días de clase, y Mi Avance no tenía un corte correcto de ciclo.
--    dias_habiles_totales (185) ya era correcto: error de captura.
-- ------------------------------------------------------------
UPDATE calendarios_sep
SET datos = jsonb_set(datos, '{inicio_clases}', '"2026-08-31"')
WHERE ciclo = '2026-2027'
  AND tipo = 'estatal'
  AND estado = '19';

-- ------------------------------------------------------------
-- 2) Regla RLS "plannings: directivo ve las de su CCT".
--    Antes exigía membresía activa/prueba también a la EDUCADORA,
--    lo que ocultaba a las fundadoras. Criterio del fundador: la
--    membresía de la educadora nunca limita que su directivo la vea.
--    Se agrega 'founder' a las membresías válidas del DIRECTIVO
--    (igual que MEMBRESIAS_DIRECTIVO_CON_PANEL en
--    lib/verificarDirectivo.ts).
--    Nota: las pantallas del directivo ya no dependen de esta regla
--    (usan /api/directivo/* con la llave de servicio); se corrige
--    para que la base diga lo mismo que el producto.
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "plannings: directivo ve las de su CCT" ON public.plannings;

CREATE POLICY "plannings: directivo ve las de su CCT"
ON public.plannings
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM users directivo
    WHERE directivo.auth_uid = auth.uid()
      AND directivo.role = 'directivo'::user_role
      AND directivo.membership_status = ANY (ARRAY['active'::membership_status, 'trial'::membership_status, 'founder'::membership_status])
      AND EXISTS (
        SELECT 1
        FROM users educadora
        WHERE educadora.id = plannings.user_id
          AND (   educadora.cct_primary   = directivo.cct_primary
               OR educadora.cct_primary   = directivo.cct_secondary
               OR educadora.cct_secondary = directivo.cct_primary
               OR educadora.cct_secondary = directivo.cct_secondary)
      )
  )
);

-- ------------------------------------------------------------
-- Sin cambios de datos en pda_coverage ni en plannings: el historial
-- se conserva intacto. pda_coverage y su trigger
-- (registrar_pda_coverage) ya no los lee ninguna pantalla; qué hacer
-- con ellos queda pendiente para una fase posterior.
-- ------------------------------------------------------------
