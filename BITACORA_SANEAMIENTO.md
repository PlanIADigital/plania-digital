# Bitácora de Saneamiento — PlanIA Digital

Registro de qué se ha saneado, cuándo y qué falta. Se actualiza al cerrar cada fase.

## Método (por archivo)

1. **Inventario:** qué secciones tiene y qué hace cada una.
2. **Contrato ideal:** qué recibe, qué produce, en qué orden, qué variables debe tener.
3. **Diagnóstico:** duplicados, etiquetas equivocadas, faltantes, lógica fuera de lugar.
4. **Saneamiento por partes:** un cambio a la vez, en rama aparte, con prueba después de cada bloque.
5. **Sello:** registro en esta bitácora con fecha y alcance.

**Criterios innegociables:** no perder calidad narrativa (los prompts son zona protegida:
se pueden mover, nunca reescribir durante el saneamiento) · seguridad de la infraestructura ·
protección de datos personales (ningún nombre de alumno se guarda ni se filtra).

Referencia: `MAPA_PLATAFORMA.md` (local, NO versionado: describe debilidades de la plataforma;
está en `.gitignore`).

## Fase 0 — Seguridad y privacidad · 26 sep 2026 · ✅ CERRADA

**Base de datos** (registro en `database/2026-09-26_saneamiento_fase0.sql`):
- Portero en `users`: el navegador no puede cambiar rol, permisos, membresía, fechas de pago ni fundadora.
- CCT: primera vez libre; después, 30 días entre cambios, clave validada en el catálogo e historial en `historial_cambios_cct`.
- Cerradas las políticas abiertas de `interaction_logs` y `cct_valores_comunitarios`.
- Borrados los textos crudos de `users.diagnostico_texto` y `programa_analitico.contenido_extraido`.

**Código** (commits `513c00c`, `3a2183e`, `8d03985`, `2fca8d2`):
- `generar-planeacion`: sesión verificada en servidor, perfil leído de la base, membresía validada y
  fecha mínima = inicio del ciclo de membresía (zona horaria por CCT), todo antes de gastar en IA.
- 14 rutas + `sugerir-campos` identifican al usuario con token verificado (`verificarUsuario` + `fetchConSesion`).
- `verificar-whatsapp-duplicado` ya no carga todos los teléfonos.
- Evaluación individual: nombres reemplazados por "Alumno N" antes de la IA y verificados en la respuesta.
- Retirados: `decode-cct`, `cct-decoder`, `api/test` (y su duplicado con espacio en el nombre).
- Apagadas las banderas de prueba de fechas pasadas y de ciclo activo.

**Alcance del sello:** estos archivos quedaron saneados en **seguridad**. Su saneamiento completo
(contrato, estructura, duplicados) corresponde a fases siguientes.

## Fase 1 — Honestidad de datos · 26-27 sep 2026 · 🟡 EN CURSO

Rama `saneamiento/fase1-mi-avance` (commits `93fb75c`, `8d0c3d5`, `6b5e8de` y el de cierre de esta entrada).
Base de datos: `database/2026-09-26_saneamiento_fase1.sql`.

**Principio:** la educadora ve su avance REAL del grupo actual en el ciclo actual; lo anterior se conserva
como historial sin mezclarse. El avance cuenta PDA distintos; las repeticiones se muestran aparte.

**Diagnóstico (cuenta Mariana PRUEBAS):** Mi Avance decía 99 PDA trabajados; eran 33 PDA reales en toda la
tabla y 24 en el ciclo real. Causa raíz: el trigger `registrar_pda_coverage` agrupa por TEXTO del PDA (no por
`pda_id`), guardaba literales concatenados "A | B", ignora `pda_2_*`, nunca resta planeaciones descartadas y
fecha la cobertura con `starts_on`. Había 12 planeaciones de prueba con fechas de junio-julio etiquetadas
2026-2027. "PDAs prioritarios 93 · diagnóstico atendido ✓" contaba `is_primary` (= PDA del campo principal),
no el diagnóstico, y el ✓ salía siempre.

**Cerrado — Mi Avance y Dashboard de la educadora:**
- `lib/cobertura.ts`: fuente única. `calcularAvance` lee `plannings` (no `pda_coverage`): ciclo activo,
  sin descartadas, `starts_on` entre `inicio_clases` y `fin_clases` del calendario estatal, `pda_id` distintos
  (principal, `pda_2`, transversales). Resultado serializable con `version` (sirve para informes).
- Canasta de PDA prioritarios con etiquetas en orden de gradualidad: Individual / NEE
  (`evaluacion_individual.pdas_prioritarios_grupo`), Grupo (`pdas_prioritarios`), Jardín (`pdas_jardin`).
  Se ubican en el catálogo por texto normalizado (las fuentes guardan el texto sin el punto final).
- Mi Avance, Dashboard y detalle del directivo muestran los mismos números (verificado contra la base:
  21 planeaciones, 24 PDA, 2/5 prioritarios). MÍA ya avisa de prioritarios pendientes.
- Endpoint `/api/calendario/fin-ciclo` devuelve también `inicioClases`.
- Calendario Nuevo León 2026-2027: `inicio_clases` corregido de 2026-08-01 a 2026-08-31 (error de captura).
- Cierre de ciclo ahora limpia también `diagnostico_texto` y `diagnostico_fecha`.
- Plural "planeaciónes" corregido.

**Cerrado — Infraestructura segura del directivo (lista para activarse después del lanzamiento):**
- Causa del "0 docentes": `users` solo permite leer el propio registro (RLS) y la consulta pedía
  `total_students`, columna que no existe (es `total_alumnos`).
- `lib/verificarDirectivo.ts`: guardia con dos niveles: `panel` (membresía active/trial/founder) e
  `informes` (cualquier directivo; lectura permanente de informes ya generados). `compartenCct` en un solo lugar.
- `lib/avanceServidor.ts`: reúne datos del lado del servidor y usa las mismas funciones de `lib/cobertura.ts`.
- `/api/directivo/docentes` (lista con resumen) y `/api/directivo/docentes/[id]` (detalle): solo campos
  necesarios, nunca correo/teléfono/diagnóstico completo; NEE solo con código de referencia; la membresía de
  la educadora no filtra (incluye fundadoras); cualquier rol docente (preparado para maestros de música).
- Panel y detalle del directivo conectados a esos endpoints; el ciclo ya no está escrito a mano.
- Regla RLS "plannings: directivo ve las de su CCT": ya no oculta a fundadoras; incluye directivo `founder`.

## Decisiones de producto registradas (26-27 sep 2026)

- Informes del directivo: la cuenta es de la persona; los informes (trimestrales y de cierre, Word + "foto"
  JSON de los datos) pertenecen al jardín (CCT). Una directora nueva del mismo jardín ve el historial.
  Un directivo dado de baja conserva consulta y descarga de informes, sin estadísticas en vivo.
- Maestros de música (futuro): el federal (19DJN) rota entre muchos jardines; el estatal (19EJN) atiende uno
  o dos. Tabla anual de asignaciones (CCT, día, turno, horas) y planeación general ligada a varios CCT.

## Pendientes

**Fase 1 — Honestidad de datos (continúa):**
- NEE y ajustes razonables: hoy la IA decide sola quién tiene NEE y `alumnos_inclusion` no la escribe ningún
  archivo. Rediseño: MÍA sugiere, la educadora confirma y describe apoyos (enfoque BAP, sin diagnósticos).
- Distintivos de prioritario en Nueva Planeación comparan texto exacto (`p.pda === pda.pda`) y fallan por el
  punto final: usar `normalizarTextoPda` de `lib/cobertura.ts`.
- Alerta "menos del 20% de cobertura": en septiembre la reciben todas; el umbral debe depender del mes del ciclo.
- 5 planeaciones de la cuenta de prueba tienen 2 PDA en el texto pero sin `pda_2_id` (anteriores a esas
  columnas): revisar si alguna educadora real está en ese caso antes de decidir si se recupera el segundo PDA.
- Confirmar si el directivo en prueba (`trial`) tiene acceso al panel (hoy sí: active/trial/founder).
- Al unir la rama a `main`: usar "Squash and merge" (el commit `93fb75c` incluyó `MAPA_PLATAFORMA.md`).

**Directivo (post-lanzamiento, infraestructura ya lista):** pantalla "Mis docentes" (hoy regresa al
dashboard), endpoint seguro para que el directivo abra una planeación de su docente, tabla de informes
(CCT + autor + ciclo + tipo + archivo + foto JSON), tabla de asignaciones de CCT para maestros itinerantes.

**Fase 2 — Estructura:** separar `generar-planeacion` (prompts, JSON, límites), reparador de JSON copiado
4 veces, ciclo escolar y UUID escritos a mano, doble `estado: 'completado'`. Decidir qué hacer con
`pda_coverage` y el trigger `registrar_pda_coverage` (ya no los lee ninguna pantalla).

**Fase 3 — Limpieza:** respaldos versionados (`.bak`, `.backup`, `aplicar_fix_generador.sh`),
`design-tokens.ts` y `wordTemplates.ts` sin uso, llave duplicada `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`
sin uso, respaldos `total_students` en `mi-grupo`, `planeacion/nueva` y `generar-planeacion` (la columna real
es `total_alumnos`).

**Fase 4 — Documentación:** actualizar `CLAUDE.md` y `BITACORA_INFRAESTRUCTURA.md`.

**Legal (para el abogado):** Aviso de Privacidad debe mencionar el procesamiento con proveedor de IA y que la
educadora declara poder compartir sus documentos; Términos deben indicar que el directivo de su CCT verá
sus planeaciones y estadísticas (y, a futuro, que los informes del directivo pertenecen al jardín).
