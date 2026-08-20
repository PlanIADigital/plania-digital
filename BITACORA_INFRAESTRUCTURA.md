# Bitácora de Infraestructura Compartida — PlanIA Digital

> **Propósito:** registro cronológico de cualquier cambio que toque algo
> usado por MÁS DE UNA sección de la app — columnas de tablas leídas por
> varios módulos, autenticación, clientes de Supabase, funciones/triggers
> de base de datos, variables de entorno, o cualquier constante compartida
> (ej. `CICLO_ESCOLAR_ACTIVO`).
>
> **Regla de uso:** ANTES de tocar algo que sospeches que es compartido,
> revisa esta bitácora completa. DESPUÉS de terminar un cambio de este
> tipo, agrega una entrada nueva aquí (nunca sobrescribas una entrada
> vieja — si algo cambia lo que se hizo antes, la entrada nueva lo dice
> explícitamente: "corrige/reemplaza lo hecho el [fecha]").
>
> **Conexión con bitácoras de sección:** si un cambio registrado en
> `BITACORA_MI_GRUPO.md`, `BITACORA_MI_AVANCE.md`, etc. también toca algo
> de aquí, esa entrada debe terminar con la línea:
> `⚠️ Toca infraestructura compartida — ver BITACORA_INFRAESTRUCTURA.md [fecha]`

---

## 21 de agosto de 2026 — Columna `ciclo_escolar` faltante en insert de `plannings`

**Qué se descubrió:** durante la migración de Fase 1 (ciclo de vida de datos
por ciclo escolar, ejecutada el 19-20 de agosto), se agregó la columna
`ciclo_escolar` (text, NOT NULL) a la tabla `plannings`. Pero el insert real
de planeaciones nuevas — que vive en `app/planeacion/nueva/page.tsx`, línea
~666, NO en `app/api/generar-planeacion/route.ts` como se hubiera esperado —
nunca se actualizó para incluir ese campo. Cualquier planeación generada
después de la migración habría fallado al guardarse con:
`null value in column "ciclo_escolar" of relation "plannings" violates not-null constraint`.

**Por qué se nos escapó:** el grep de auditoría de la migración se hizo
sobre el schema (Supabase) y sobre `lib/calendarioEscolar.ts`, pero no se
extendió a buscar TODOS los puntos de `insert` hacia `plannings` en el
código de la app. `generar-planeacion/route.ts` solo genera el contenido
de la planeación (llamada al modelo) — el guardado real en base de datos
ocurre después, en el frontend, en un archivo distinto.

**Fix aplicado:** se agregó `import { CICLO_ESCOLAR_ACTIVO } from '@/lib/calendarioEscolar'`
y el campo `ciclo_escolar: CICLO_ESCOLAR_ACTIVO` al objeto del insert.
Verificado con una planeación real generada tras el deploy — se guardó
correctamente.

**Hallazgo relacionado, aún sin resolver:** en ese mismo insert, la columna
`school_year_id` está **hardcodeada como string literal**:
`school_year_id: '96cae520-b0ed-4fcb-9c62-a95212ee357e'` — el UUID fijo de
la única fila que existe en `school_years` (la del ciclo 2025-2026, ya
vencida). Esto significa que el trigger `trigger_pda_coverage` (en
Postgres, función `registrar_pda_coverage()`) sigue registrando toda
cobertura de PDA nueva bajo ese mismo `school_year_id` viejo, sin importar
que `ciclo_escolar` en la misma fila ya diga `'2026-2027'` correctamente.
Afecta a: `mi-avance/page.tsx` (lee `pda_coverage` sin filtrar por ciclo),
`generar-planeacion/route.ts` función `obtenerTrayectoriaPDA()` (lee
`pda_coverage_avanzada` sin filtrar por ciclo), `dashboard/page.tsx`,
`directivo/docentes/[id]/page.tsx`. **Pendiente de decisión:** ¿agregar
`ciclo_escolar` también a `pda_coverage` y usarlo como criterio de filtro
en vez de `school_year_id`? ¿O corregir `school_year_id` para que sea
dinámico? Requiere ver primero cómo se relaciona `school_year_id` con la
lógica de `ON CONFLICT (user_id, school_year_id, pda_literal)` del trigger
antes de decidir — un cambio aquí toca la restricción única de la tabla.

**Archivos tocados:** `app/planeacion/nueva/page.tsx`

**Tablas/columnas involucradas:** `plannings.ciclo_escolar`, `plannings.school_year_id`, `pda_coverage` (indirectamente, vía trigger)

---

## 21 de agosto de 2026 — Migración completa de `pda_coverage` a `ciclo_escolar` real

**Qué se descubrió:** la restricción única de `pda_coverage` era
`UNIQUE (user_id, school_year_id, pda_literal)` — y como `school_year_id`
siempre fue un valor fijo hardcodeado (ver entrada anterior, mismo día),
esa restricción nunca distinguió ciclo real desde que existe la tabla.
Esto significa que, hasta hoy, el "no repetir PDA" y el tracker de
`times_used` mezclaban todos los ciclos sin darse cuenta — a pesar de que
el diseño original (`CLAUDE.md`) dice explícitamente "sistema reinicia
tracker PDA" al inicio de cada ciclo.

**Origen del problema:** `pda_coverage` se llena vía un **trigger de
Postgres** (`trigger_pda_coverage`, función `registrar_pda_coverage()`),
no desde código de Next.js — por eso el primer `grep` en el código de la
app no encontró ningún `insert`/`upsert` hacia esa tabla. El trigger
copiaba `school_year_id` de `plannings.school_year_id` (también
hardcodeado, ver entrada anterior) en cada inserción.

**Fix aplicado (4 bloques SQL + 2 cambios de código):**
1. Columna `ciclo_escolar` agregada a `pda_coverage`, backfill vía JOIN
   con `plannings.ciclo_escolar` para las 26 filas con `planning_id`
   válido; las 58 filas huérfanas (planeaciones ya no existentes, datos
   de ejercicio de la cuenta de prueba) se etiquetaron por default al
   ciclo activo — sin impacto real, es data de prueba.
2. Restricción única movida de `(user_id, school_year_id, pda_literal)`
   a `(user_id, ciclo_escolar, pda_literal)`.
3. Función `registrar_pda_coverage()` actualizada para copiar
   `NEW.ciclo_escolar` (de `plannings`, ya poblado desde el fix anterior)
   y usar `ciclo_escolar` en el `ON CONFLICT` de las 4 secciones
   (principal + 3 transversales).
4. Vista `pda_coverage_avanzada` actualizada para exponer `ciclo_escolar`
   (agregada al FINAL de la lista de columnas — Postgres no permite
   insertar columnas en medio con `CREATE OR REPLACE VIEW`, solo agregar
   al final; intentarlo en medio da error 42P16).
5. Código: `mi-avance/page.tsx` y `obtenerTrayectoriaPDA()` en
   `generar-planeacion/route.ts` ahora filtran por
   `.eq('ciclo_escolar', CICLO_ESCOLAR_ACTIVO)`.

**Pendiente relacionado (no resuelto hoy, no bloqueante):** la consulta de
`plannings` en `mi-avance/page.tsx` (líneas ~192-196) tampoco filtra por
`ciclo_escolar` — sigue mostrando planeaciones de todos los ciclos
mezcladas. Es la funcionalidad completa de "historial multi-ciclo con
selector ciclo+grupo" ya anotada en el roadmap — no es un fix de una
línea, requiere diseño de UI (selector), se deja aparte.

**Archivos tocados:** `app/mi-avance/page.tsx`, `app/api/generar-planeacion/route.ts`

**Tablas/columnas/funciones involucradas:** `pda_coverage.ciclo_escolar`, `pda_coverage_avanzada` (vista), función `registrar_pda_coverage()`, restricción única `pda_coverage_user_id_ciclo_escolar_pda_literal_key`

---

## Plantilla para nuevas entradas

```
## [Fecha] — [Título corto y descriptivo]

**Qué se descubrió / qué se hizo:**

**Por qué importa (a qué otras secciones afecta):**

**Fix aplicado (si aplica):**

**Pendiente relacionado (si algo queda abierto):**

**Archivos tocados:**

**Tablas/columnas involucradas:**
```
