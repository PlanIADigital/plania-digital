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

**Práctica de publicación:** cada rama se une a `main` con "Squash and merge" (un solo commit limpio).

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

## Fase 1 — Honestidad de datos · 26-27 sep 2026 · ✅ CERRADA

**Principio:** la educadora ve su avance REAL del grupo actual en el ciclo actual; lo anterior se conserva
como historial sin mezclarse. El avance cuenta PDA distintos; las repeticiones se muestran aparte.

### Parte 1 — Mi Avance, Dashboard y directivo · ✅ publicada (26-27 sep, commit `cbefb01` en `main`)

Base de datos: `database/2026-09-26_saneamiento_fase1.sql`.

**Diagnóstico (cuenta Mariana PRUEBAS):** Mi Avance decía 99 PDA trabajados; eran 33 PDA reales en toda la
tabla y 24 en el ciclo real. Causa raíz: el trigger `registrar_pda_coverage` agrupa por TEXTO del PDA (no por
`pda_id`), guardaba literales concatenados "A | B", ignora `pda_2_*`, nunca resta planeaciones descartadas y
fecha la cobertura con `starts_on`. Había 12 planeaciones de prueba con fechas de junio-julio etiquetadas
2026-2027. "PDAs prioritarios 93 · diagnóstico atendido ✓" contaba `is_primary` (= PDA del campo principal),
no el diagnóstico, y el ✓ salía siempre.

**Mi Avance y Dashboard de la educadora:**
- `lib/cobertura.ts`: fuente única. `calcularAvance` lee `plannings` (no `pda_coverage`): ciclo activo,
  sin descartadas, `starts_on` entre `inicio_clases` y `fin_clases` del calendario estatal, `pda_id` distintos
  (principal, `pda_2`, transversales). Resultado serializable con `version` (sirve para informes).
- Canasta de PDA prioritarios con etiquetas en orden de gradualidad: Individual / NEE
  (`evaluacion_individual.pdas_prioritarios_grupo`), Grupo (`pdas_prioritarios`), Jardín (`pdas_jardin`).
  Se ubican en el catálogo por texto normalizado (las fuentes guardan el texto sin el punto final).
- Mi Avance, Dashboard y detalle del directivo muestran los mismos números (verificado contra la base:
  21 planeaciones, 24 PDA, 2/5 prioritarios). MÍA ya avisa de prioritarios pendientes.
- `/api/calendario/fin-ciclo` devuelve también `inicioClases`.
- Calendario Nuevo León 2026-2027: `inicio_clases` corregido de 2026-08-01 a 2026-08-31 (error de captura).
- Cierre de ciclo ahora limpia también `diagnostico_texto` y `diagnostico_fecha`.

**Infraestructura segura del directivo (lista para activarse después del lanzamiento):**
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

### Parte 2 — NEE y ajustes razonables · 27 sep 2026 · rama `saneamiento/fase1-nee`

Base de datos: `database/2026-09-27_saneamiento_fase1_nee.sql`.

**Diagnóstico:** convivían tres identificadores sin puente entre sí: "Alumno N" (evaluación individual),
`AL-XX` (`alumnos_codigo`, rúbricas) e iniciales "R.G.-1" (`users.alumnos_inclusion`, ajustes razonables).
Ningún archivo escribía `alumnos_inclusion`, y el generador salía sin ajustes si estaba vacía: **8 de 9
cuentas nunca recibían ajustes razonables** (solo la cuenta de prueba, con datos cargados a mano). Además, el
alta de alumnos estaba rota para cuentas nuevas (`ciclo_escolar` obligatoria que el endpoint no enviaba) y la
unicidad `(user_id, codigo)` habría impedido crear AL-01 en el siguiente ciclo.

**Decisiones (criterio del fundador):** un solo código AL-XX por niño, en el orden de la lista de la educadora;
el código nunca se recorre ni se reutiliza; una baja conserva su número y aparece "(baja)" en listas de
cotejo/rúbricas; un niño que llega después recibe el siguiente número con "(alta fecha)". MÍA sugiere, la
educadora confirma eligiendo a qué código corresponde (recordatorio visible); enfoque BAP, sin diagnósticos
ni nombres.

**Construido:**
- `alumnos_codigo`: columnas `requiere_apoyos`, `apoyos`, `apoyos_origen` ('mia' | 'educadora'),
  `apoyos_confirmado_en`; unicidad `(user_id, ciclo_escolar, codigo)`.
- `/api/alumnos-codigo`: envía `ciclo_escolar` (alta reparada), filtra por ciclo, devuelve activos + bajas +
  `alta_posterior`; acciones `confirmar_apoyos`, `quitar_apoyos` y `descartar_sugerencia`. La decisión sobre cada
  sugerencia se guarda en `evaluacion_individual.alumnos[].revision`: al subir una evaluación nueva, las
  sugerencias nuevas vuelven a quedar pendientes.
- `components/GrupoAlumnosApoyos.tsx`: sugerencias de MÍA (barreras, texto editable, selector de código
  propuesto por posición, Confirmar/Descartar) y lista del grupo (altas, bajas, agregar/editar/quitar apoyos).
- Mi Grupo: aviso "MÍA detectó N niños que podrían necesitar apoyos" mientras haya sugerencias sin revisar.
- `generar-planeacion`: `obtenerGrupoAlumnos` lee el grupo del ciclo desde `alumnos_codigo`; los ajustes
  razonables usan solo apoyos CONFIRMADOS de alumnos activos; las rúbricas llevan el roster con "(baja)" y
  "(alta …)". Los prompts no se tocaron (reciben la misma forma `{ codigo, acciones }`).
- `users.alumnos_inclusion` ya no se lee ni se escribe en ningún archivo (la columna se conserva).

**Verificado:** planeación de prueba de 2 días con ajuste "AL-02.-" ligado a sus barreras reales, sin
iniciales, y rúbrica con AL-01..AL-12 y AL-13..AL-17 "(baja)". Costo real: $0.16 USD.

### Parte 3 — Sugerencias de MÍA con acciones · 27 sep 2026 · rama `saneamiento/fase1-apoyos-mia`

**Diagnóstico:** el texto que MÍA proponía como apoyos era la observación del alumno ("Alumna que requiere…"),
no acciones, y con género.

**Construido (autorizado por el fundador: el prompt solo se AMPLÍA, nada existente se reescribe):**
- `analizar-evaluacion-individual`: +785 caracteres al prompt — regla de `apoyos_sugeridos` (solo si hay barreras;
  2-3 acciones concretas en infinitivo; lenguaje neutro sin "alumna/alumno/niña/niño/él/ella"; sin diagnósticos
  ni nombres; apoyarse en fortalezas; máx. 400 caracteres) y el campo en el JSON. Presupuesto de tokens sin cambio
  (peor caso ~26,000 de 48,000). La protección de nombres de la Fase 0 cubre el campo nuevo automáticamente.
- `GrupoAlumnosApoyos`: el texto editable usa `apoyos_sugeridos` (evaluaciones anteriores siguen usando la
  observación) y muestra la observación de MÍA en gris como contexto. Si el código propuesto ya tiene apoyos,
  no se sobrescribe solo: la educadora elige.

**Verificado:** evaluación de prueba con 3 alumnos ficticios → 2 sugerencias con acciones neutras ancladas en
fortalezas, sin nombres; confirmadas a AL-02 (reemplazó el texto anterior) y AL-03.

### Parte 4 — Barreras con enfoque BAP · 27 sep 2026 · rama `saneamiento/fase1-barreras-bap`

**Diagnóstico:** las etiquetas de barreras (`nee`) a veces traían términos clínicos ("Dislalia"), contrario al
enfoque BAP de la NEM. **Decisión del fundador:** cumplir BAP y la normativa NEM, corregir ya.

**Construido (el prompt solo se AMPLÍA):** `analizar-evaluacion-individual` +776 caracteres — regla de ENFOQUE BAP:
en `nee`, `observaciones`, `alertas` y `resumen_general` solo barreras observables en el contexto del aula, nunca
diagnósticos ni términos clínicos (dislalia, TDAH, TEA, autismo, Asperger, dislexia, trastorno, síndrome, déficit,
hiperactividad), aunque el documento de la educadora los mencione; se traducen a la barrera observable.

**Verificado:** documento de prueba que decía "diagnóstico de TDAH" y "dislalia" → etiquetas, observación y apoyos
sin ningún término clínico ("Dificultad en la pronunciación de sonidos r y rr en situaciones orales").

**Lenguaje neutro (mismo día, a propuesta del fundador):** +regla que extiende el lenguaje neutro a `nee`,
`observaciones`, `alertas` y `resumen_general` (ej. "permanece en silencio" en lugar de "permanece callada").

### Parte 5 — Pantallas muestran apoyos confirmados · 27 sep 2026 · rama `saneamiento/fase1-apoyos-pantallas`

**Diagnóstico:** Mi Avance (Diversidad) y el directivo mostraban lo que DETECTÓ la IA ("Alumno 2", barreras,
observación), no lo que la educadora confirmó ni lo que llega a las planeaciones.

**Construido:**
- `lib/avanceServidor.ts`: `obtenerApoyosConfirmados` (alumnos activos del ciclo con apoyos confirmados en
  `alumnos_codigo`; solo código AL-XX y texto de apoyos).
- Endpoints del directivo: `alumnosConNee` → `alumnosConApoyos` (lista: conteo; detalle: código + apoyos).
- Directivo: chip "♿ N con apoyos", tarjeta "Alumnos con apoyos", pestaña "Apoyos".
- Mi Avance (Diversidad): apoyos confirmados con origen ("Sugerido por MÍA · confirmado por ti" / "Registrado
  por ti") y aviso de sugerencias de MÍA por revisar que lleva a Mi Grupo.

**Verificado:** Mi Avance, panel y detalle del directivo muestran AL-02 y AL-03 con los mismos apoyos; números
consistentes entre las tres pantallas (22 planeaciones, 25 PDA, 2/4 prioritarios).

### Parte 6 — Marcas de PDA prioritario en Nueva Planeación · 27 sep 2026 · rama `saneamiento/fase1-marcas-prioritario`

**Diagnóstico:** las tres marcas comparaban el texto de forma distinta — Grupo (texto idéntico), Individual / NEE
(sin mayúsculas ni espacios, pero fallaba por el punto final) y Jardín (primeros 40 caracteres, podía marcar un
PDA distinto que empezara igual).

**Construido:** `esPdaPrioritario` en `lib/cobertura.ts` (misma comparación normalizada que la canasta de Mi
Avance); las tres marcas de `app/planeacion/nueva/page.tsx` la usan. La marca y el conteo de Mi Avance ya no
pueden diferir.

**Verificado:** "Percibe cambios corporales…" y "Adapta sus movimientos…" muestran "Necesidad individual
detectada" (antes no se marcaban).

### Parte 7 — Alerta de cobertura según la etapa del ciclo · 27 sep 2026 · rama `saneamiento/fase1-alerta-cobertura`

**Diagnóstico:** la alerta salía si un campo tenía menos del 20% de sus PDA, en cualquier fecha; en septiembre la
recibían todas las educadoras (ruido y punitiva).

**Construido (`app/mi-avance/page.tsx`):** `META_CAMPO_FIN_CICLO = 20` como referencia al cierre del ciclo; a la
fecha se espera la parte proporcional al ciclo transcurrido (inicio/fin de clases del calendario estatal); sin
alerta en el primer 15% del ciclo. Texto: "va/van por debajo de lo esperado para esta etapa del ciclo". El botón
"Equilibrar con MÍA" sigue la misma regla. Ejemplo NL 2026-2027: 27 sep sin alerta; 15 nov ≈5%; 15 mar ≈13%; cierre 20%.

**Verificado:** Mi Avance de la cuenta de prueba sin alerta de campos ni botones en septiembre; se conserva el
aviso de PDA prioritarios pendientes.

### Parte 8 — PDA recomendado por MÍA · 27 sep 2026 · rama `saneamiento/fase1-pda-recomendado`

**Propuesta del fundador:** cerrar el ciclo "MÍA detecta → avisa → un clic → la planeación nace con ese PDA".
Antes, "Equilibrar con MÍA" solo preseleccionaba el CAMPO y la alerta de prioritarios no tenía botón.

**Construido:**
- Mi Avance: enlace "Planear el primero con MÍA →" en la alerta de PDA prioritarios pendientes (lleva al primer
  pendiente) y botón "✦ Planear este PDA con MÍA →" bajo el recuadro de la cuadrícula al elegir un PDA prioritario.
- Nueva Planeación: `?pda_sugerido=<id>` → busca el PDA en el catálogo, preselecciona campo, contenido y PDA
  (una sola vez y solo cuando ya cargó el catálogo, porque al cargar se borra la selección), etiqueta
  "✦ Recomendado por MÍA" y aviso "MÍA preseleccionó un PDA prioritario de tu grupo". La educadora puede quitarlo.

**Verificado:** ambos caminos (alerta → "Adapta sus movimientos…"; cuadrícula LEN-30 → "Manifiesta oralmente…")
abren Nueva Planeación con campo, contenido y PDA elegidos y la etiqueta.

### Revisión — Planeaciones con 2 PDA sin su segundo código · 27 sep 2026 · ✅ sin acción
- Consulta de solo lectura: `pda_literal` con "|" y `pda_2_id` vacío. Solo aparece la cuenta de prueba
  (Mariana PRUEBAS): 18 en 2026-2027 y 40 en 2025-2026. **Ninguna educadora real.**
- La primera planeación con `pda_2_id` se guardó el 2026-09-26 19:00 UTC; después de esa fecha hay
  **0** planeaciones afectadas. El guardado actual de Nueva Planeación registra bien el segundo PDA.
- Conclusión: son datos viejos de prueba. No se recuperan ni se modifican.

## Fase 2 — Estructura · desde 27 sep 2026 · 🟡 EN CURSO

### Parte 1 — Ciclo escolar sin valores escritos a mano · 27 sep 2026 · rama `saneamiento/fase2-ciclo`
- **Hallazgo:** `generar-planeacion` guardaba siempre `school_year_id = 96cae520…` (fila 2025-2026). Las 44
  planeaciones de 2026-2027 y sus 99 registros de `pda_coverage` quedaron ligados al ciclo anterior. Ninguna
  pantalla lee esa columna (el avance usa `ciclo_escolar`), pero es obligatoria y la copia el trigger.
- **Hallazgo:** `usar-federal` buscaba, guardaba y redactaba la nota con `'2025-2026'`. Como el federal
  2025-2026 ya no existe, hoy respondía "No se encontró el calendario federal"; en julio habría guardado el
  calendario estatal en el ciclo equivocado.
- `lib/schoolYear.ts` (nuevo): `obtenerSchoolYearId(supabaseAdmin, ciclo)` busca la fila del ciclo y, si no
  existe, la crea con `inicio_clases`/`fin_clases` del calendario federal (respaldo: 1 ago – 31 jul, con
  aviso en el log) e `is_current = false`. Ya no hay que crear la fila a mano cada año.
- `generar-planeacion`: usa `obtenerSchoolYearId`. `usar-federal`: usa `CICLO_ESCOLAR_ACTIVO` (3 lugares).
- SQL `database/2026-09-27_saneamiento_fase2_ciclo.sql`: 2026-2027 como ciclo actual y corrección de
  `school_year_id` en `plannings` y `pda_coverage`. El trigger es solo `AFTER INSERT`: no genera duplicados.
- Revisado y descartado: `pda_coverage` agrupa por `ciclo_escolar`, así que su cobertura no estaba mezclada.

### Parte 2 — Reparador de JSON único · 27 sep 2026 · rama `saneamiento/fase2-json-unico`
- **Hallazgo:** `repararJSON`, `cerrarJSONTruncado` y `parsearJSONRobusto` estaban copiadas en 4 rutas
  (evaluación individual, PDA del jardín, programa analítico, generar planeación). Comparadas línea por
  línea: misma lógica; solo cambiaban formato y los mensajes de log (dos copias no registraban nada).
- `lib/parsearJSON.ts` (nuevo): versión única, con los mensajes de log y lanzando el primer error.
- Las 4 rutas importan `parsearJSONRobusto`; se quitaron ~326 líneas duplicadas.

- ✅ Verificado en producción: planeación generada y evaluación individual analizada sin cambios.

### Parte 3 — `generar-planeacion` separado en módulos · 27 sep 2026 · rama `saneamiento/fase2-separar-generador`
- 1,071 líneas → `route.ts` (~500, solo el flujo `POST` y el progreso) + `lib/planeacion/`:
  `prompts.ts` (zona protegida: DIAS, CIERRE, EJE, EVALUACION_FORMATIVA), `generadores.ts` (llamadas a MÍA y
  sus mensajes), `contexto.ts` (trayectoria, grupo y apoyos, prioridades, dirección, estilo), `limites.ts`,
  `costos.ts`, `tipos.ts`.
- Solo se movió código y se agregó `export`. Verificado antes de publicar: los 14 bloques originales aparecen
  idénticos y los 4 prompts coinciden carácter por carácter (8,485 / 6,221 / 1,069 / 765).
- **Hallazgo (pendiente):** `obtenerTrayectoriaPDA` lee `pda_coverage_avanzada` y se la entrega a MÍA como
  "TRAYECTORIA DEL GRUPO". Esos datos incluyen planeaciones descartadas y `times_used` se infla, así que MÍA
  puede leer "ya trabajado N veces" cuando no es cierto. Hay que pasarla a `lib/cobertura.ts` antes de
  retirar `pda_coverage`.

- ✅ Verificado en producción: planeación con 2 PDA, rúbricas y ajustes de AL-02 / AL-03.

### Parte 4 — Narrativa sin número de alumnos y recorte sin frases rotas · 27 sep 2026 · rama `saneamiento/fase2-narrativa`
- **Hallazgo:** MÍA narraba "Al entrar los tres al salón" porque recibe "Alumnos: N". Con 25 niños sería igual
  de artificial y el texto deja de ser cierto con una baja o una falta.
- `prompts.ts`: se AGREGA `R-GRUPO-SIN-NUMERO` (autorizada por el fundador) entre R-JORNADA-COMPLETA y
  R-FORMATO-JSON. El parche verifica que el único cambio en el prompt sea esa regla.
- **Hallazgo:** la red de seguridad de caracteres cortaba a media frase con "..." cuando la oración era muy larga
  (ej. actividad complementaria del día 2: "…que refuerza lo mismo que...").
- `limites.ts` (`recortarAlLimite`): si no hay fin de oración después de la mitad del límite, corta en la última
  pausa natural (coma, punto y coma, dos puntos, guion largo) y cierra con punto. "..." queda como último recurso.

## Decisiones de producto registradas (26-27 sep 2026)

- Informes del directivo: la cuenta es de la persona; los informes (trimestrales y de cierre, Word + "foto"
  JSON de los datos) pertenecen al jardín (CCT). Una directora nueva del mismo jardín ve el historial.
  Un directivo dado de baja conserva consulta y descarga de informes, sin estadísticas en vivo.
- Maestros de música (futuro): el federal (19DJN) rota entre muchos jardines; el estatal (19EJN) atiende uno
  o dos. Tabla anual de asignaciones (CCT, día, turno, horas) y planeación general ligada a varios CCT.
- Códigos de alumnos y apoyos: ver Fase 1, Parte 2.
- Directivo en periodo de prueba (`trial`): SÍ ve el panel completo de sus docentes (planeaciones, PDA,
  campos formativos, ejes articuladores). Motivo: la prueba debe mostrar el beneficio real de la membresía
  (y a mediano plazo, la ficha de avances por grupo y por jardín). Se mantiene active/trial/founder.

## Pendientes

**Directivo (post-lanzamiento, infraestructura ya lista):** pantalla "Mis docentes" (hoy regresa al
dashboard), endpoint seguro para que el directivo abra una planeación de su docente, tabla de informes
(CCT + autor + ciclo + tipo + archivo + foto JSON), tabla de asignaciones de CCT para maestros itinerantes.

**Fase 2 — Estructura:** flujo de cambio de ciclo en el admin (cerrar ciclo + ciclo activo sin editar código +
`is_current` en `school_years`; hoy `CICLO_ESCOLAR_ACTIVO` se cambia a mano y la pantalla propone `'2025-2026'`
por defecto), doble `estado: 'completado'`. Trayectoria de MÍA desde `lib/cobertura.ts` (hoy lee `pda_coverage_avanzada`,
que no excluye descartadas, no registra el 2.º PDA y acumula `times_used`); después, retiro de `pda_coverage`,
su vista y el trigger `registrar_pda_coverage` (Fase 3).

**Tamaño del grupo:** hoy hay dos fuentes (`users.total_alumnos`, capturado a mano, y los códigos activos de
`alumnos_codigo`); en la cuenta de prueba no coinciden (3 vs 12). Definir una sola fuente antes del lanzamiento.

**Fase 3 — Limpieza:** respaldos versionados (`.bak`, `.backup`, `aplicar_fix_generador.sh`),
`design-tokens.ts` y `wordTemplates.ts` sin uso, llave duplicada `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`
sin uso, respaldos `total_students` en `mi-grupo`, `planeacion/nueva` y `generar-planeacion` (la columna real
es `total_alumnos`), columna `users.alumnos_inclusion` sin uso, estados sin uso en Mi Grupo
(`alumnosCodigo`, `cargandoAlumnos`, `errorAlumnos`), `fecha_baja` se calcula en UTC (puede marcar el día
siguiente si la baja se registra de noche).

**Revisión ESLint (27 sep 2026, al cerrar Fase 1):** proyecto completo 293 problemas (259 errores, 34 avisos);
archivos tocados en Fase 1: 91 (60 `no-explicit-any`, 14 `no-unescaped-entities`, 8 `set-state-in-effect`,
7 `exhaustive-deps`, 2 `no-unused-vars`). Sin riesgo de datos desfasados: los `exhaustive-deps` son `router`
(estable) y una constante. Variables sin uso en `planeacion/nueva`: `CICLO_ESCOLAR_ACTIVO` (se resuelve con el
ciclo escrito a mano, Fase 2) y `nombreCorto`. Los `any` y comillas pasan a Fase 3; meta: bajar de 293.

**Fase 4 — Documentación:** actualizar `CLAUDE.md` y `BITACORA_INFRAESTRUCTURA.md`.

**Legal (para el abogado):** Aviso de Privacidad debe mencionar el procesamiento con proveedor de IA y que la
educadora declara poder compartir sus documentos; Términos deben indicar que el directivo de su CCT, también en
periodo de prueba, verá sus planeaciones y estadísticas (y, a futuro, que los informes del directivo pertenecen al jardín).
