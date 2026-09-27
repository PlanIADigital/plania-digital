-- ============================================================
--  PlanIA Digital — Saneamiento Fase 2: school_years 2026-2027
--  [27 sep 2026] Las 44 planeaciones de 2026-2027 (y su cobertura) quedaron
--  ligadas al school_year 2025-2026 porque el UUID estaba escrito a mano en
--  generar-planeacion. Este script:
--    1. desmarca 2025-2026 como ciclo actual;
--    2. crea (o marca) 2026-2027 como actual, con fechas del calendario federal;
--    3. corrige school_year_id en plannings y pda_coverage de 2026-2027.
--  El trigger registrar_pda_coverage es solo AFTER INSERT: estos UPDATE no
--  lo disparan ni generan duplicados. Se puede correr antes o después de
--  publicar el código (si la fila ya existe, solo la marca como actual).
-- ============================================================
BEGIN;

UPDATE school_years
SET is_current = false, updated_at = now()
WHERE is_current = true AND label <> '2026-2027';

INSERT INTO school_years (label, starts_at, ends_at, students_start, is_current)
SELECT '2026-2027',
       (datos ->> 'inicio_clases')::date,
       (datos ->> 'fin_clases')::date,
       (datos ->> 'inicio_clases')::date,
       true
FROM calendarios_sep
WHERE tipo = 'federal' AND estado = 'FED' AND ciclo = '2026-2027'
ON CONFLICT (label) DO UPDATE SET is_current = true, updated_at = now();

UPDATE plannings
SET school_year_id = (SELECT id FROM school_years WHERE label = '2026-2027')
WHERE ciclo_escolar = '2026-2027';

UPDATE pda_coverage
SET school_year_id = (SELECT id FROM school_years WHERE label = '2026-2027')
WHERE ciclo_escolar = '2026-2027';

COMMIT;

-- Verificación (solo lectura): cada ciclo debe quedar ligado a su propia fila.
SELECT sy.label, sy.is_current, sy.starts_at, sy.ends_at,
       (SELECT COUNT(*) FROM plannings p WHERE p.school_year_id = sy.id) AS planeaciones,
       (SELECT COUNT(*) FROM plannings p WHERE p.school_year_id = sy.id AND p.ciclo_escolar <> sy.label) AS mal_ligadas
FROM school_years sy
ORDER BY sy.label;
