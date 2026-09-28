-- ============================================================
--  PlanIA Digital — Fase 2, Parte 10: estilos de aprendizaje
--  [28 sep 2026] Aplicado en producción desde el SQL Editor.
--  Resumen del GRUPO (sin datos por niño) + sección de historial.
-- ============================================================
BEGIN;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS estilos_aprendizaje jsonb;

COMMENT ON COLUMN users.estilos_aprendizaje IS
  'Resumen del grupo: {kinestesico, visual, auditivo, total, ciclo_escolar, fecha}. Sin datos por niño. Fase 2, Parte 10 (28 sep 2026).';

ALTER TABLE documentos_historial DROP CONSTRAINT documentos_historial_seccion_check;
ALTER TABLE documentos_historial ADD CONSTRAINT documentos_historial_seccion_check
  CHECK (seccion = ANY (ARRAY['pmc','diagnostico_grupal','diagnostico_individual','observaciones_directivo','pdas_jardin','estilos_aprendizaje']));

COMMIT;
