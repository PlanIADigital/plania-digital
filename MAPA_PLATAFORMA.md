# MAPA_PLATAFORMA — PlanIA Digital

> Generado el 26 de septiembre de 2026, en **modo solo lectura**: se leyó el código, no se modificó, borró ni renombró ningún archivo. Este archivo es lo único que se creó.
> Rama `main`, commit `6a63286`. Next.js 16.2.6 (App Router, sin `/src`), React 19, Supabase, Anthropic SDK.
> Este archivo no contiene ningún valor de llave; de `.env.local` solo se leyeron los **nombres** de las variables.

## Cómo leer este mapa

- ⚠️ = la ruta o el flujo **confía en un dato que manda el navegador** (`auth_uid`, `user_id`, `profile`…) y trabaja con la llave de servicio, que salta la protección RLS de la base de datos.
- "Llave de servicio" = `supabaseAdmin` (`SUPABASE_SECRET_KEY`), que ignora RLS.
- "Bearer verificado" = la ruta lee el token de sesión del header `Authorization`, se lo pregunta a Supabase (`auth.getUser(token)`) y de ahí saca al usuario. Es la única forma segura que existe hoy en el repo.

**Lo que NO pude ver (está fuera del repo):** las políticas RLS de Supabase, los triggers y funciones de la base (solo hay `database/misiones_schema.sql`), las columnas que el código nunca menciona, las variables de Vercel. Donde una conclusión depende de eso lo digo explícitamente. Las páginas grandes (`mi-grupo`, `planeacion/nueva`, `planeacion/[id]`, `configuracion`, `mi-avance`, `admin/calendario`) las recorrí por sus llamadas a API/Supabase y las partes críticas de lógica; no releí cada línea de maquetación.

**Cifras generales:** 42 rutas API (`route.ts`), 25 páginas (`page.tsx`) + 2 layouts, 12 archivos en `lib/`, 5 en `components/`, 20 tablas + 4 vistas + 1 bucket referenciados en el código.

---

## 1. PÁGINAS (`app/**/page.tsx`)

Todas las páginas de usuario son componentes de cliente (`'use client'`) que leen la sesión con `supabase.auth.getSession()` y redirigen desde el navegador. **Solo `/admin/*` está protegido en el servidor** (`proxy.ts`, `matcher: ['/admin/:path*']`); el resto depende de redirecciones del lado del cliente y de RLS.

### 1.1 Públicas y de acceso

| Ruta | Archivo | Líneas | Propósito | APIs que llama | Supabase directo |
|---|---|---:|---|---|---|
| `/` | `app/page.tsx` | 4 | Redirige a `/auth/login` | — | — |
| `/auth/login` | `app/auth/login/page.tsx` | 122 | Inicio de sesión; decide a dónde mandar según rol | `POST /api/auth/me` ⚠️ | `auth.signInWithPassword`, `auth.signOut` |
| `/auth/register` | `app/auth/register/page.tsx` | 216 | Registro (nombre, correo, WhatsApp, rol, aceptar términos) | `POST /api/verificar-whatsapp-duplicado` | `auth.signUp` (manda `full_name`, `role`, `whatsapp`, fechas de aceptación y `legal_version` como *metadata*) |
| `/auth/confirmar-correo` | `app/auth/confirmar-correo/page.tsx` | 42 | Pantalla "revisa tu correo" | — | — |
| `/onboarding` | `app/onboarding/page.tsx` | 386 | Completar perfil: CCT, turno, zona/sector/región | `POST /api/decodificar-cct`, `GET /api/cct-lookup`, `POST /api/verificar-cct-duplicado`, `POST /api/cct-confirmar` | **Lee** `users` (role, profile_completed). **Escribe** `users` (cct_primary, shift_primary, profile_completed, estado, sostenimiento, nivel_educativo, school_name) |
| `/privacidad` | `app/privacidad/page.tsx` | 103 | Aviso de privacidad (estático) | — | — |
| `/terminos` | `app/terminos/page.tsx` | 241 | Términos y condiciones (estático) | — | — |

### 1.2 Educadora / Educador / Maestro de música

| Ruta | Archivo | Líneas | Propósito | APIs que llama | Supabase directo |
|---|---|---:|---|---|---|
| `/dashboard` | `app/dashboard/page.tsx` | 210 | Inicio: planeaciones del ciclo y cobertura (campos, ejes, PDAs) | — | **Lee** `users` (`*`), `plannings`, `pda_coverage` |
| `/mi-grupo` | `app/mi-grupo/page.tsx` | 1258 | Sube y analiza los 6 documentos del grupo (PMC, PA, diagnóstico grupal, evaluación individual, observaciones de dirección, PDAs del jardín); lista de códigos de alumnos | `extraer-texto`, `analizar-diagnostico-escolar` ⚠️, `analizar-programa-analitico` (GET/POST) ⚠️, `analizar-diagnostico` ⚠️, `analizar-evaluacion-individual` ⚠️, `analizar-observaciones-directivo` ⚠️, `analizar-pdas-jardin` ⚠️, `documentos-historial/fechas` ⚠️, `documentos-historial/lista` ⚠️, `alumnos-codigo` (GET/POST) ⚠️, `alumnos-codigo/baja` ⚠️ | **Lee** `users` (`*`). **Escribe** `users` (total_alumnos, grado, grupo_letra) |
| `/planeacion/nueva` | `app/planeacion/nueva/page.tsx` | 1516 | Formulario de nueva planeación; sugerencias de transversales/ejes; generación con barra de progreso | `GET /api/calendario/dias-habiles-reales`, `POST /api/sugerir-campos`, `POST`+`GET /api/generar-planeacion/progreso` ⚠️, `POST /api/generar-planeacion` ⚠️ (manda **todo** el `profile`) | **Lee** `users` (`*`), `programa_analitico` (pda_ponderacion), `pda_catalog` (×2) |
| `/planeacion/[id]` | `app/planeacion/[id]/page.tsx` | 703 | Ver una planeación, sus rúbricas y ajustes; exportar a Word; descartar | `POST /api/exportar-word` | **Lee** `users` (`*`), `plannings` (`*`), `rubrics`, `pda_catalog`. **Escribe** `plannings` (status='discarded'; word_descargado_en), `rubrics` (descartada=true) |
| `/mis-planeaciones` | `app/mis-planeaciones/page.tsx` | 289 | Historial de planeaciones; descartar | — | **Lee** `users` (`*`), `plannings`. **Escribe** `plannings` (status='discarded') |
| `/mi-avance` | `app/mi-avance/page.tsx` | 514 | Cobertura curricular (PDAs, campos, ejes), alertas y sugerencias | `GET /api/calendario/fin-ciclo` | **Lee** `users` (`*`), `plannings`, `pda_coverage`, `pda_catalog` |
| `/configuracion` | `app/configuracion/page.tsx` | 520 | Perfil, foto, WhatsApp, zona/sector/región/turno, estado de cuenta, estilo narrativo | `cct-lookup`, `estado-cuenta` ⚠️, `cct-confirmar`, `verificar-whatsapp-duplicado`, `analizar-estilo-narrativo` ⚠️, `extraer-texto` | **Lee** `users` (`*`). **Escribe** `users` (avatar_url, whatsapp). **Storage** bucket `avatars` (upload + URL pública) |
| `/misiones` | `app/misiones/page.tsx` | 436 | Gamificación (apagada por `MISIONES_ACTIVO = false`) | `GET /api/misiones/progreso`, `GET /api/misiones/ranking`, `POST /api/misiones/completar-mision` (todas con Bearer) | **Lee** `users` (`*`) |

### 1.3 Directivo

| Ruta | Archivo | Líneas | Propósito | APIs | Supabase directo |
|---|---|---:|---|---|---|
| `/directivo/dashboard` | `app/directivo/dashboard/page.tsx` | 218 | Resumen de docentes del mismo CCT y sus planeaciones | — | **Lee** `users` (propio `*`; docentes: id, full_name, role, grado, total_students, cct_primary, shift_primary, **evaluacion_individual**), `plannings` |
| `/directivo/docentes` | `app/directivo/docentes/page.tsx` | 11 | Redirige a `/directivo/dashboard` | — | — |
| `/directivo/docentes/[id]` | `app/directivo/docentes/[id]/page.tsx` | 236 | Detalle de una docente (solo lectura) | — | **Lee** `users` (propio `*` y el de la docente `*`), `plannings`, `pda_coverage` |

### 1.4 Super Admin (`/admin/*`, protegido por `proxy.ts` + `admin/layout.tsx`)

`admin/layout.tsx` (171 líneas): verifica sesión (`auth.getSession`), llama `GET /api/auth/me-session` con Bearer y expulsa si no es `is_super_admin`.
Todas las páginas admin usan `fetchAdmin()` (Bearer automático) y **no** tocan Supabase directo.

| Ruta | Archivo | Líneas | Propósito | APIs |
|---|---|---:|---|---|
| `/admin` | `app/admin/page.tsx` | 122 | Dashboard: usuarios y calendarios cargados | `calendario-estado`, `usuarios` |
| `/admin/usuarios` | `app/admin/usuarios/page.tsx` | 188 | Lista de usuarios; marcar fundadora; activar membresía | `usuarios`, `marcar-fundadora`, `activar-membresia` |
| `/admin/calendario` | `app/admin/calendario/page.tsx` | 628 | Subir/borrar calendarios SEP por estado; "usar federal"; contiene el prompt para convertir calendarios en claude.ai | `calendario-estado`, `calendario` (POST/DELETE), `calendario/usar-federal` |
| `/admin/cct` | `app/admin/cct/page.tsx` | 348 | Estado del catálogo de CCT y consulta de un CCT | `cct-catalogo-estado`, `GET /api/cct-lookup` (pública) |
| `/admin/cerrar-ciclo` | `app/admin/cerrar-ciclo/page.tsx` | 204 | Cierre de ciclo escolar (limpia datos "activos") | `cierres-ciclo`, `cerrar-ciclo` |
| `/admin/avances` | `app/admin/avances/page.tsx` | 232 | Checklist de avance del producto | `avances` (GET/POST/PATCH) |
| `/admin/acciones` | `app/admin/acciones/page.tsx` | 126 | Lista estática de acciones periódicas | — |
| `/admin/costos` | `app/admin/costos/page.tsx` | 96 | Pantalla de costos API — **datos escritos a mano** ($0.00, "~$0.03"), no conectada a nada | — |
| `/admin/modelos` | `app/admin/modelos/page.tsx` | 92 | Muestra qué modelos IA hay — **texto fijo**, no lee el entorno real | — |

Layout raíz: `app/layout.tsx` (36 líneas) — monta `ThemeProvider`; declara `lang="en"` en una app en español.

---

## 2. RUTAS API (`app/api/**/route.ts`)

**Resumen de cómo se identifica al usuario (42 archivos):**

| Categoría | # | Rutas |
|---|---:|---|
| ✅ Bearer verificado en servidor | 17 | 10 de `admin/*`, `cct-confirmar`, `perfil/tema`, `misiones/*` (3), `verificar-cct-duplicado`, `auth/me-session` |
| ⚠️ Confía en `auth_uid` / `user_id` / `profile` del navegador (con llave de servicio) | 16 | `alumnos-codigo`, `alumnos-codigo/baja`, 7× `analizar-*`, `documentos-historial/fechas`, `documentos-historial/lista`, `estado-cuenta`, `auth/me`, `verificar-whatsapp-duplicado` (parcial), `generar-planeacion`, `generar-planeacion/progreso` |
| Pública, sin ninguna identificación | 9 | `cct-lookup`, `decodificar-cct`, `decode-cct`, `calendario/dias-habiles-reales`, `calendario/fin-ciclo`, `extraer-texto`, `exportar-word`, `sugerir-campos`, `test` |

> 17 + 16 + 9 = 42 rutas. `verificar-whatsapp-duplicado` es a la vez ⚠️ y sin autenticación (se cuenta solo en la fila ⚠️). Todas las rutas ⚠️ usan llave de servicio. El archivo `app/api/test/route.ts ` (con espacio final, ver §8) no es una ruta y no entra en el conteo.

**Por qué importa:** el `auth_uid` de una persona **no es secreto**. Por ejemplo, la foto de perfil se guarda como `avatars/<auth_uid>.<ext>` y se publica con `getPublicUrl` (configuracion/page.tsx:110-114) — es decir, la URL pública del avatar contiene el `auth_uid`. Con ese dato, cualquiera puede llamar las rutas ⚠️ y leer/escribir datos de esa persona.

### 2.1 Rutas ✅ de Super Admin (todas: `verificarSuperAdmin(request)` → Bearer → `getUser(token)` → `users.is_super_admin`)

| Ruta | Método | Recibe | Devuelve | Tablas |
|---|---|---|---|---|
| `admin/usuarios` | GET | — | `{usuarios:[auth_uid, full_name, email, role, cct_primary, membership_status, created_at, es_fundadora]}` (en error devuelve lista vacía) | R `users` |
| `admin/activar-membresia` | POST | `{auth_uid, activar}` | `{ok}` | W `users` (membership_status; fecha_pago si activa) |
| `admin/marcar-fundadora` | POST | `{auth_uid, es_fundadora}` | `{ok}` | W `users` (es_fundadora) |
| `admin/calendario` | POST / DELETE | `{tipo, estado, datos}` / `{tipo, estado}` | `{ok}` | W `calendarios_sep` (upsert por tipo+ciclo+estado; delete por tipo+estado) |
| `admin/calendario/usar-federal` | POST | `{estado, nombreEstado, nota}` | `{ok}` | R+W `calendarios_sep` (**ciclo '2025-2026' escrito a mano**) |
| `admin/calendario-estado` | GET | `?estado` (default `'19'`) | `{federal, estatal, estadosConEstatal, estatalEsFederal}` (en error devuelve todo "vacío" sin avisar) | R `calendarios_sep` |
| `admin/cct-catalogo-estado` | GET / POST | `{archivo_nombre, registros_count, actualizado_por}` | `{data}` | R+W `admin_cct_catalogo` |
| `admin/avances` | GET / POST / PATCH | `{categoria, elemento}` / `{id, estado, nota}` | `{data}` | R+W `admin_avances` |
| `admin/cerrar-ciclo` | POST | `{ciclo_a_cerrar}` | `{ok, ciclo_cerrado, usuarios_afectados}` | R+W `cierres_ciclo`; W `users` (8 campos → NULL, **todas las filas**); W `programa_analitico` (activo=false) |
| `admin/cierres-ciclo` | GET | — | `{ok, ciclosCerrados}` | R `cierres_ciclo` |

### 2.2 Rutas ✅ de usuario (Bearer verificado)

| Ruta | Método | Recibe | Devuelve | Tablas | Identificación |
|---|---|---|---|---|---|
| `auth/me-session` | GET | Bearer | `{is_super_admin, role}` | R `users` | `auth.getUser(token)` inline |
| `perfil/tema` | POST | `{theme}` | `{ok}` | W `users.theme_preference` | `verificarUsuario` |
| `cct-confirmar` | POST | `{cv_cct, campo, valor}` | `{ok, valor_guardado}` | R+W `cct_valores_comunitarios`; W `users` (shift_primary, o zona/sector/region + `*_confirmada`) | `verificarUsuario` — el `user_id` sale del token, no del body |
| `verificar-cct-duplicado` | POST | `{cct}` + Bearer | `{existe}` | R `users` (cuenta otros con el mismo `cct_primary`) | `auth.getUser(token)` inline |
| `misiones/progreso` | GET | Bearer | `{progreso, misiones, logros}` (crea progreso si no existe) | R `msn_progreso_usuario`, `msn_misiones`, `msn_logros`; W `msn_progreso_usuario` | `verificarUsuario` |
| `misiones/completar-mision` | POST | `{misionId}` | `{progreso, logrosNuevos}` | R `msn_misiones`, `msn_progreso_usuario`, `msn_logros`; W `msn_progreso_usuario`, `msn_ranking_cache` (copia `full_name`) | `verificarUsuario` |
| `misiones/ranking` | GET | Bearer | `{ranking}` (top 20 del mismo rol: user_id, full_name, xp, nivel) | R `msn_ranking_cache` | `verificarUsuario` |

> Las rutas de Misiones **no revisan** `MISIONES_ACTIVO`: funcionan aunque la sección esté "apagada" en la interfaz.

### 2.3 Rutas ⚠️ (confían en datos del navegador)

| Ruta | Método | Recibe | Devuelve | Tablas | Cómo "identifica" (⚠️) |
|---|---|---|---|---|---|
| ⚠️ `generar-planeacion` | POST | `{form, profile, job_id}` (el `profile` es la fila **completa** de `users` con `select('*')`) | `{planeacion, costo_generacion_usd, planning_id}` | R `calendarios_sep`, `pda_coverage_avanzada`, `alumnos_codigo`; W `generacion_progreso`, `plannings`, `rubrics` | **Ninguna.** `profile.id` viene del navegador y se usa como `user_id` para leer roster/trayectoria e **insertar** `plannings`/`rubrics`. `profile.alumnos_inclusion`, `estilo_narrativo`, `evaluacion_individual`, etc. también vienen del navegador y se meten al prompt. Sin control de membresía ni de tope mensual. `maxDuration = 700`. Cada llamada gasta dinero de Anthropic |
| ⚠️ `generar-planeacion/progreso` | POST / GET | POST `{job_id, user_id}` / GET `?job_id` | `{ok}` / `{totalLotes, lotesCompletados, faseActual, estado, errorMensaje, fasesLotes, planningId}` | W / R `generacion_progreso` | `user_id` viene del body (POST); GET solo con `job_id` (UUID aleatorio) |
| ⚠️ `alumnos-codigo` | GET / POST | `?auth_uid` / `{auth_uid, accion:'agregar'|'bootstrap', total}` | `{ok, alumnos}` / `{ok, alumno(s)}` | R+W `alumnos_codigo`; R `users` (id, alumnos_inclusion) | `auth_uid` del navegador → resuelve `users.id` con llave de servicio |
| ⚠️ `alumnos-codigo/baja` | POST | `{auth_uid, id}` | `{ok, alumno}` | W `alumnos_codigo` (activo=false, fecha_baja) | Ídem (sí exige que el registro pertenezca a ese `auth_uid`, pero el `auth_uid` lo pone el navegador) |
| ⚠️ `analizar-diagnostico` | POST | `{diagnostico_texto, grado, auth_uid}` | `{pdas_sugeridos}` | R `pda_catalog`; W `users` (**diagnostico_texto crudo**, diagnostico_fecha, pdas_prioritarios); R+W `documentos_historial` | `auth_uid` del navegador |
| ⚠️ `analizar-diagnostico-escolar` | POST | `{texto, auth_uid}` | `{ok, resultado}` | W `users.diagnostico_escolar`; R+W `documentos_historial` (sección `pmc`) | Ídem |
| ⚠️ `analizar-evaluacion-individual` | POST | `{texto_evaluacion, grado, auth_uid}` | `{resultado}` | R `pda_catalog`; W `users.evaluacion_individual`; R+W `documentos_historial` (`diagnostico_individual`) | Ídem. `maxDuration = 300` |
| ⚠️ `analizar-observaciones-directivo` | POST | `{texto, auth_uid}` | `{ok, resultado}` | W `users.observaciones_directivo`; R+W `documentos_historial` | Ídem |
| ⚠️ `analizar-pdas-jardin` | POST | `{texto, auth_uid}` | `{ok, pdas_jardin, total_vinculados, resumen}` | R `pda_catalog`; W `users.pdas_jardin`; R+W `documentos_historial` | Ídem. Ignora el error de guardado en `users` |
| ⚠️ `analizar-estilo-narrativo` | POST | `{texto, auth_uid}` | `{ok, resultado}` | W `users.estilo_narrativo` | Ídem |
| ⚠️ `analizar-programa-analitico` | POST / GET | POST `{texto, auth_uid, cct, archivo_formato, grado}` / GET `?auth_uid&cct` | POST `{ok, version_numero, pa_id, resultado, inconsistencias…}` / GET `{ok, historial}` | R `users`; R+W `programa_analitico` (`educadora_id` = **auth_uid**, no users.id) | `auth_uid` y `cct` del navegador. El GET devuelve el historial completo incluyendo `nota_directivo` de cualquier `auth_uid` |
| ⚠️ `documentos-historial/fechas` | GET | `?auth_uid` | `{ok, fechas:{sección:{fecha, version}}}` | R `users`, `documentos_historial` | `auth_uid` del navegador |
| ⚠️ `documentos-historial/lista` | GET | `?auth_uid&seccion` | `{ok, versiones}` (sin `contenido`) | R `users`, `documentos_historial` | Ídem |
| ⚠️ `estado-cuenta` | GET | `?auth_uid` | `{ok, fecha_pago, ciclo_inicio, ciclo_fin, dias_habiles_generados_ciclo}` | R vista `v_estado_cuenta` | `auth_uid` del navegador. Crea su **propio** cliente con `SUPABASE_SERVICE_ROLE_KEY` (otra variable distinta) |
| ⚠️ `auth/me` | POST | `{auth_uid}` | `{is_super_admin, role}` | R `users` | `auth_uid` del navegador. Le dice a cualquiera si un `auth_uid` es Super Admin. Su gemela segura es `auth/me-session` |
| ⚠️ `verificar-whatsapp-duplicado` | POST | `{whatsapp, excluir_auth_uid}` | `{duplicado}` | R `users` (**todos** los `whatsapp`, comparados en memoria) | **Sin autenticación**; permite preguntar "¿este teléfono está registrado?" a cualquiera; `excluir_auth_uid` viene del navegador |

### 2.4 Rutas públicas (sin identificación)

| Ruta | Método | Recibe | Devuelve | Tablas / servicios | Nota |
|---|---|---|---|---|---|
| `cct-lookup` | GET | `?cv_cct` | zona/sector/región/turno resueltos (comunidad → oficial → "No aplica") | R `cct_catalogo_oficial`, vistas `v_cct_valores_resueltos`, `v_campo_nulidad` | Llave de servicio; datos de catálogo |
| `decodificar-cct` | POST | `{cct}` | estado, sostenimiento, tipo, nombre, zona/sector/región | R `cct_catalogo_oficial` | Decodificador determinista (usado por onboarding) |
| `decode-cct` | POST | `{cct}` | resultado IA (Haiku) | Anthropic | **Ninguna página lo llama**; expone gasto de IA sin login |
| `calendario/dias-habiles-reales` | GET | `?estado&fecha_inicio&fecha_fin&ciclo` | `{diasHabilesReales, diasExcluidos, diasExcluidosDetalle}` | R `calendarios_sep` | Usa `CICLO_ESCOLAR_ACTIVO` por defecto |
| `calendario/fin-ciclo` | GET | `?estado&ciclo` | `{finClases}` | R `calendarios_sep` | Ciclo por defecto **'2025-2026' escrito a mano** (la página no manda `ciclo`) |
| `extraer-texto` | POST | archivo (multipart) | `{texto}` (PDF con `unpdf`, DOCX con `mammoth`) | — (no guarda nada) | Sin tope de tamaño ni login; el archivo puede traer nombres reales de alumnos |
| `exportar-word` | POST | `{institucional, proyecto, campos_formativos, ejes, dias, dias_especiales, ajustes_por_dia, instrumentos_evaluacion, evaluacion_formativa}` | archivo `.docx` | — | Sin base de datos: dibuja lo que le manda el navegador. Usa `lib/wordTemplateTokens.ts` |
| `sugerir-campos` | POST | datos del proyecto + prioridades del grupo | `{transversales[3], eje_principal, eje_secundario, ejes_disponibles}` | R `pda_catalog`; Anthropic (Haiku) | Sin login: cualquiera puede gastar tokens de Haiku |
| `test` | GET | — | filas de `school_years` | R `school_years` | Sin uso; público |

---

## 3. ARCHIVOS EN `lib/` Y `components/`

### 3.1 `lib/`

| Archivo | Líneas | Qué hace | Quién lo importa |
|---|---:|---|---|
| `lib/supabase.ts` | 16 | Exporta `supabase` (cliente navegador) y `supabaseAdmin` (llave de servicio; `null` en el navegador) | **`supabaseAdmin`**: 22 rutas API (alumnos-codigo ×2, analizar-* ×7, auth/me, auth/me-session, calendario ×2, cct-lookup, decodificar-cct, documentos-historial ×2, generar-planeacion/progreso, sugerir-campos, test, verificar-cct-duplicado, verificar-whatsapp-duplicado) + `import()` dinámico en `generar-planeacion`. **`supabase`**: `app/mi-grupo/page.tsx`, `app/planeacion/nueva/page.tsx` |
| `lib/supabase-browser.ts` | 17 | `createBrowserClient` de `@supabase/ssr` (sesión en cookies) | `lib/supabase.ts`, `lib/fetchAdmin.ts`, `components/Sidebar`, `SidebarDirectivo`, `ThemeProvider`, y 12 páginas (login, register, configuracion, dashboard, directivo ×2, mi-avance, mis-planeaciones, misiones, onboarding, planeacion/[id], admin/layout) |
| `lib/supabase-middleware.ts` | 37 | `actualizarSesion()`: lee/refresca la sesión desde cookies en el servidor | `proxy.ts` |
| `lib/verificarSuperAdmin.ts` | 50 | Guardia de rutas admin (Bearer → `getUser` → `users.is_super_admin`); devuelve `supabaseAdmin` | Las 10 rutas de `app/api/admin/*` |
| `lib/verificarUsuario.ts` | 63 | Guardia de usuario normal (Bearer → `users` id, full_name, role, cct_primary); además `rolAplicableDe()` | `cct-confirmar`, `perfil/tema`, `misiones/*` (3) |
| `lib/fetchAdmin.ts` | 25 | `fetch` que agrega el header `Authorization: Bearer` | Páginas admin: avances, calendario, cct, cerrar-ciclo, page, usuarios |
| `lib/calendarioEscolar.ts` | 115 | `CICLO_ESCOLAR_ACTIVO = '2026-2027'`, `obtenerCalendarioEstatal()`, `calcularDiasHabiles()` (lee `calDatos.eventos`) | API: generar-planeacion, dias-habiles-reales, analizar-diagnostico, -diagnostico-escolar, -evaluacion-individual, -observaciones-directivo, -pdas-jardin. Páginas: dashboard, mi-avance, mis-planeaciones, planeacion/nueva, planeacion/[id] (solo la constante) |
| `lib/cobertura.ts` | 24 | `calcularEjesCubiertos()` (eje principal + secundario) | `dashboard`, `mi-avance` |
| `lib/featureFlags.ts` | 11 | `MISIONES_ACTIVO = false` | Solo `app/misiones/page.tsx` (el `Sidebar` **no** lo usa; tiene su propio `activo: false` a mano) |
| `lib/agents/cct-decoder.ts` | 84 | Decodificador CCT con IA (Haiku) + su prompt | Solo `api/decode-cct` (que nadie llama) |
| `lib/wordTemplateTokens.ts` | 159 | Constantes de diseño del Word (página, colores, fuentes, bordes) | `api/exportar-word` |
| `lib/wordTemplates.ts` | 59 | Plantillas Word "institucional"/"clásica" (versión anterior) | **Nadie** |
| `lib/design-tokens.ts` | 150 | Colores, radios, sombras, tipografías de la interfaz | **Nadie** |

### 3.2 `components/`

| Archivo | Líneas | Qué hace | Quién lo importa |
|---|---:|---|---|
| `SidebarWrapper.tsx` | 19 | Elige `SidebarDirectivo` si `role==='directivo'`, si no `Sidebar` | configuracion, dashboard, mi-avance, mi-grupo, mis-planeaciones, misiones, planeacion/nueva |
| `Sidebar.tsx` | 237 | Menú lateral de educadoras (ficha del jardín, navegación, tema, cerrar sesión) | `SidebarWrapper`; también `planeacion/[id]` directamente (se salta el wrapper) |
| `SidebarDirectivo.tsx` | 145 | Menú lateral de directivos | `SidebarWrapper`; `directivo/dashboard`, `directivo/docentes/[id]` |
| `ThemeProvider.tsx` | 67 | Tema claro/oscuro; lee `users.theme_preference`, guarda vía `/api/perfil/tema` y `localStorage` | `app/layout.tsx`; `Sidebar` (hook `useTheme`) |
| `DetalleModal.tsx` | 59 | Ventana emergente genérica | `app/mi-grupo/page.tsx` |

`proxy.ts` (raíz, 21 líneas): reemplaza al antiguo middleware (Next 16). Solo actúa sobre `/admin/*`: si no hay sesión en cookies, redirige a login; **no** revisa si es Super Admin (eso lo hace la API).

---

## 4. TABLAS DE SUPABASE

R = lee · W = escribe. "Trigger/BD" = escritura que ocurre en la base de datos y no aparece en el repo. Tablas: **20** (+ 4 vistas + 1 bucket). CLAUDE.md dice 19.

### 4.1 `users` (la tabla central)

Prácticamente toda página hace `select('*')` sobre esta tabla, así que "lee" abajo se refiere al uso explícito de cada columna.

| Columna(s) | Escriben | Leen |
|---|---|---|
| `id`, `auth_uid` | Trigger/BD al registrarse | Casi todo el sistema (clave de búsqueda) |
| `full_name`, `email`, `role`, `whatsapp` | Trigger/BD desde el *metadata* de `signUp`; `whatsapp` también `configuracion` | verificarUsuario, admin/usuarios, auth/me(-session), Sidebars, completar-mision (copia `full_name` al ranking), verificar-whatsapp-duplicado |
| `cct_primary`, `shift_primary`, `school_name`, `estado`, `sostenimiento`, `nivel_educativo` | `onboarding` (navegador); `cct-confirmar` (`shift_primary`) | Casi todas las páginas; `generar-planeacion` (`cct_primary` → código de estado para el calendario); directivo (`cct_primary` agrupa docentes); verificar-cct-duplicado |
| `zona`, `sector`, `region`, `zona_confirmada`, `sector_confirmada`, `region_confirmada` | `cct-confirmar` | Sidebar, configuracion |
| `profile_completed` | `onboarding` | dashboard y demás (redirección), verificar-cct-duplicado |
| `is_super_admin` | Nadie en el código (manual en Supabase) | verificarSuperAdmin, auth/me, auth/me-session, dashboard, admin/usuarios |
| `membership_status`, `fecha_pago` | `admin/activar-membresia` (estado inicial "trial": trigger/BD) | admin/usuarios, configuracion, vista `v_estado_cuenta` |
| `es_fundadora` | `admin/marcar-fundadora` | admin/usuarios, Sidebar |
| `theme_preference` | `perfil/tema` | ThemeProvider |
| `avatar_url` | `configuracion` | Sidebar, SidebarDirectivo, configuracion |
| `grado`, `grupo_letra`, `total_alumnos` | `mi-grupo` (navegador); `admin/cerrar-ciclo` (→NULL) | mi-grupo, planeacion/nueva, generar-planeacion (vía `profile`), directivo |
| `total_students`, `seccion_grupo`, `grade`, `contexto_grupo` | **Nadie en el código** | mi-grupo, nueva, directivo, `generar-planeacion` (`profile.grade`, `profile.total_students`, `profile.contexto_grupo`) |
| `alumnos_inclusion` (lista de `{codigo, acciones}`) | **Nadie en el código** | `alumnos-codigo` (bootstrap), mi-grupo, `generar-planeacion` (vía `profile`, va al prompt) |
| `diagnostico_texto`, `diagnostico_fecha` | `analizar-diagnostico` | — (no se limpian en `cerrar-ciclo`) |
| `pdas_prioritarios` | `analizar-diagnostico`; `cerrar-ciclo` (→NULL) | mi-grupo, mi-avance, generar-planeacion (vía `profile`) |
| `diagnostico_escolar` | `analizar-diagnostico-escolar`; `cerrar-ciclo` | mi-grupo, nueva, generar-planeacion |
| `evaluacion_individual` | `analizar-evaluacion-individual`; `cerrar-ciclo` | mi-grupo, mi-avance, nueva, **directivo/dashboard**, generar-planeacion |
| `pdas_jardin` | `analizar-pdas-jardin`; `cerrar-ciclo` | mi-grupo, nueva, generar-planeacion |
| `observaciones_directivo` | `analizar-observaciones-directivo`; `cerrar-ciclo` | mi-grupo, generar-planeacion |
| `estilo_narrativo` | `analizar-estilo-narrativo` | configuracion, generar-planeacion |
| `created_at` | Trigger/BD | admin/usuarios |

### 4.2 Planeaciones

| Tabla | Columnas referenciadas | Escriben | Leen |
|---|---|---|---|
| `plannings` | user_id, project_name, situacion_problema, finalidad, metodologia, pda_campo, pda_contenido, pda_literal, pda_id, pda_2_contenido/pda/id/activo, recursos_materiales, transversal_{1,2,3}_{campo,contenido,pda,id,activo}, starts_on, ends_on, duration_days, grade, content_json, eje_principal, eje_secundario, **school_year_id**, ciclo_escolar, status, costo_generacion_usd, word_descargado_en, id, created_at | `generar-planeacion` (insert); `mis-planeaciones` y `planeacion/[id]` (status, word_descargado_en) | dashboard, directivo/dashboard, directivo/docentes/[id], mi-avance, mis-planeaciones, planeacion/[id] |
| `rubrics` | planning_id, user_id, pda_evaluated, content_json (incluye `registro_alumnos:[{codigo, nivel_marcado}]`), original_json, descartada, id, created_at | `generar-planeacion` (insert); `planeacion/[id]` (descartada) | `planeacion/[id]` |
| `pda_catalog` | id, campo, contenido, pda, grado, orden, posicion_campo | Nadie (catálogo) | analizar-diagnostico, -evaluacion-individual, -pdas-jardin, sugerir-campos, mi-avance, planeacion/[id], planeacion/nueva |
| `pda_coverage` | user_id, pda_literal, pda_id, campo, is_primary, covered_on, times_used, ciclo_escolar | **Trigger/BD** `registrar_pda_coverage()` (según BITACORA; sin escritura en código) | dashboard, directivo/docentes/[id], mi-avance |
| `pda_coverage_avanzada` (vista) | campo, contenido, pda_literal, is_primary, covered_on, times_used, user_id, ciclo_escolar | — | `generar-planeacion` |
| `generacion_progreso` | job_id, user_id, estado, fase_actual, total_lotes, lotes_completados, fases_lotes, error_mensaje, planning_id, actualizado_en | `generar-planeacion/progreso` (insert); `generar-planeacion` (update) | `generar-planeacion/progreso` (GET) |
| `school_years` | `*` (sin columnas) | — | `api/test`. Su único UUID está copiado a mano en `generar-planeacion` |

### 4.3 Documentos y grupo

| Tabla | Columnas | Escriben | Leen |
|---|---|---|---|
| `alumnos_codigo` | id, user_id (= users.id), codigo (`AL-NN`), fecha_alta, fecha_baja, activo | `alumnos-codigo` (insert), `alumnos-codigo/baja` (update) | `alumnos-codigo`, `generar-planeacion` (roster) |
| `documentos_historial` | user_id (= users.id), seccion (`pmc`, `diagnostico_grupal`, `diagnostico_individual`, `pdas_jardin`, `observaciones_directivo`), ciclo_escolar, version_numero, contenido (JSON del análisis), resumen, archivo_formato, activo, created_at | Los 5 `analizar-*` correspondientes | Los mismos + `documentos-historial/fechas`, `/lista` |
| `programa_analitico` | educadora_id (= **auth_uid**), cct, version_numero, archivo_formato, **contenido_extraido** (texto crudo, primeros 5000 caracteres), pda_ponderacion, activo, id, fecha_carga, created_at, nota_directivo, nota_directivo_fecha | `analizar-programa-analitico`; `admin/cerrar-ciclo` (activo=false) | `analizar-programa-analitico` (GET/POST), `planeacion/nueva` (pda_ponderacion). `nota_directivo*`: nadie las escribe en el código |

### 4.4 Calendario y catálogo CCT

| Tabla | Columnas | Escriben | Leen |
|---|---|---|---|
| `calendarios_sep` | tipo (`federal`/`estatal`), estado (2 dígitos o `FED`), ciclo, datos (`inicio_clases`, `fin_clases`, `eventos[{categoria, fecha, fecha_fin, motivo}]`, `entidad`, `origen_calendario`, `notas`), actualizado_en | `admin/calendario`, `admin/calendario/usar-federal` | `admin/calendario-estado`, `calendario/fin-ciclo`, `lib/calendarioEscolar` (→ generar-planeacion, dias-habiles-reales) |
| `cct_catalogo_oficial` | cv_cct, nombre_jardin, administracion, estado, clasificador, region_oficial/numero, sector_oficial/numero, zona_oficial/numero, turno | Nadie (carga externa) | `cct-lookup`, `decodificar-cct` |
| `cct_valores_comunitarios` | id, cv_cct, campo, valor, veces_confirmado, ultima_confirmacion | `cct-confirmar` | `cct-confirmar` |
| `v_cct_valores_resueltos`, `v_campo_nulidad` (vistas) | cv_cct, campo, valor_resuelto, veces_confirmado / estado, clasificador, campo, pct_nulo | — | `cct-lookup` |
| `admin_cct_catalogo` | archivo_nombre, registros_count, actualizado_por, fecha_actualizacion, created_at | `admin/cct-catalogo-estado` | Ídem |

### 4.5 Administración, cuenta y gamificación

| Tabla | Columnas | Escriben | Leen |
|---|---|---|---|
| `admin_avances` | id, categoria, elemento, estado, nota, orden, updated_at | `admin/avances` | `admin/avances` |
| `cierres_ciclo` | ciclo_cerrado, fecha_cierre, usuarios_afectados | `admin/cerrar-ciclo` | `admin/cerrar-ciclo`, `admin/cierres-ciclo` |
| `v_estado_cuenta` (vista) | auth_uid, fecha_pago, ciclo_inicio, ciclo_fin, dias_habiles_generados_ciclo | — | `estado-cuenta` |
| `msn_misiones` | id, titulo, descripcion, tipo, xp_recompensa, nodo_mazmorra, ventana_horas, rol_aplicable, orden, activa | Solo SQL manual | `misiones/progreso`, `completar-mision` |
| `msn_logros` | id, titulo, descripcion, icono, xp_recompensa, criterio, rol_aplicable | Solo SQL manual | Ídem |
| `msn_progreso_usuario` | user_id, rol_aplicable, xp_total, nivel_gamificacion, nodo_actual, misiones_completadas, logros_desbloqueados, updated_at | `misiones/progreso`, `completar-mision` | Ídem |
| `msn_ranking_cache` | user_id, full_name, xp_total, nivel_gamificacion, rol_aplicable, actualizado_en | `completar-mision` | `misiones/ranking` |
| Bucket `avatars` | objeto `avatars/<auth_uid>.<ext>` | `configuracion` (subida desde el navegador) | URL pública |

---

## 5. FLUJO DE DATOS DE ALUMNOS

### 5.1 Códigos de alumno (esto funciona como se diseñó)

- **Alumnos regulares** → `AL-01`, `AL-02`… en `alumnos_codigo` (`user_id` = `users.id`). Se crean desde `Mi Grupo` → `POST /api/alumnos-codigo` ⚠️ (`bootstrap` hasta 60 menos los de inclusión, o `agregar`). La baja marca `activo=false`; el código nunca se reutiliza.
- **Alumnos de inclusión** → `users.alumnos_inclusion`: `[{codigo: 'R.G.-1', acciones: '<texto libre>'}]`. **Ningún archivo del repo escribe esta columna**; la lee `mi-grupo` (solo para mostrar), `alumnos-codigo` (para restar del total) y `generar-planeacion`. Se llena por un camino que no está en el código (probablemente SQL manual o una versión anterior de la pantalla).
- **Recorrido en una generación:** navegador → `profile` completo → `POST /api/generar-planeacion` ⚠️ → el servidor toma los códigos de inclusión y sus `acciones` **del `profile` que manda el navegador**, y el roster `AL-NN` de `alumnos_codigo` usando `profile.id` (también del navegador) → **Anthropic** (código + `acciones`) → `plannings.content_json.ajustes_por_dia[{numero, codigo, ajuste}]` y `rubrics.content_json.registro_alumnos[{codigo, nivel_marcado}]` → el navegador reenvía todo a `/api/exportar-word` → los códigos salen en el `.docx`.

### 5.2 Puntos donde puede viajar o guardarse un nombre real de alumno

| # | Punto | Qué pasa | Se guarda | Se envía a un tercero |
|---|---|---|---|---|
| 1 | **Evaluación individual** (`mi-grupo` → `extraer-texto` → `analizar-evaluacion-individual`) | El documento trae "Nombre del Alumno: …" (el código depende de ese marcador literal). El texto completo, con nombres, se manda tal cual a Claude. La protección es **solo la instrucción del prompt** ("NUNCA incluyas nombres reales… usa Alumno 1, 2…"); **no hay ninguna verificación en código** de que la respuesta no traiga nombres. Se recorta el número de alumnos, no el contenido | Sí, el **resultado del modelo** en `users.evaluacion_individual` y `documentos_historial.contenido` (si el modelo dejara un nombre, queda guardado y luego lo lee el directivo) | **Sí: nombres reales → Anthropic** |
| 2 | **Diagnóstico grupal** (`analizar-diagnostico`) | El texto completo se manda a Claude y **se guarda crudo** en `users.diagnostico_texto`. Su prompt manda ignorar datos administrativos y de padres pero **no menciona nombres de alumnos** | **Sí, texto crudo** en `users.diagnostico_texto` (`cerrar-ciclo` no lo limpia) | Sí |
| 3 | **Programa Analítico** (`analizar-programa-analitico`) | Se manda hasta 12 000 caracteres a Claude; el prompt dice no incluir nombres en la salida | **Sí, texto crudo** (primeros 5 000 caracteres) en `programa_analitico.contenido_extraido` | Sí |
| 4 | **PMC / diagnóstico escolar** | Prompt: "ignorar nombres de personas… nunca incluir nombres reales" | Solo el resumen | Sí (8 000 caracteres) |
| 5 | **Observaciones de dirección** | Pueden nombrar a la docente o a alumnos; el prompt pide no incluir nombres | Solo el resultado | Sí (6 000 caracteres) |
| 6 | **`alumnos_inclusion[].acciones`** | Texto libre entrando por un camino fuera del repo; va literal al prompt y de ahí puede aparecer en los ajustes redactados | En `users` y (redactado) en `plannings.content_json` | Sí |
| 7 | **Campos libres del formulario de planeación** (`nombre_proyecto`, `situacion_problema`, `finalidad`, `recursos_materiales`) | Texto que escribe la educadora; sin filtro | En `plannings` | Sí |
| 8 | **`profile` completo en cada generación** | `select('*')` de `users` (incluye `diagnostico_texto` crudo, `evaluacion_individual`, `whatsapp`, `email`, `auth_uid`) viaja del navegador al servidor aunque solo se usen algunos campos | No | No (el servidor solo usa algunos campos) |

Lo que **sí** está bien: `extraer-texto` no guarda el archivo ni el texto; el generador y las rúbricas solo trabajan con códigos; `exportar-word` no toca base de datos; el prompt del generador prohíbe etiquetas diagnósticas (R-SIN-ETIQUETAS).
Además: `mi-grupo` (línea ~1043) muestra "🔒 Nombres nunca almacenados"; eso es cierto para el texto crudo de la evaluación individual, pero **no** cubre los puntos 2, 3 y 6, ni el hecho de que los nombres sí salen hacia Anthropic.

### 5.3 Otros datos personales (docentes / cuenta)

| Dato | Dónde nace | Dónde vive | Quién lo ve |
|---|---|---|---|
| Nombre, correo, WhatsApp, rol | `signUp` (metadata, lo pone el navegador) | `users` | Admin (`admin/usuarios`: nombre, correo); directivo (`select('*')` de sus docentes: incluye WhatsApp y correo); ranking de Misiones (`full_name`, a todos los del mismo rol; sección apagada en UI pero API activa) |
| WhatsApp | `register`, `configuracion` | `users.whatsapp` | `verificar-whatsapp-duplicado` lee **todos** los números en cada llamada y permite comprobar si uno existe, sin login |
| `auth_uid` | Supabase Auth | `users`; **URL pública del avatar** | Cualquiera con la URL de una foto |
| Nombre de la docente en Word | `institucional.educadora` | `.docx` (firma) | Descarga |
| Rol (`role`) | Lo elige quien se registra, va en el *metadata* de `signUp` | `users.role` (por trigger, no visible) | Si el trigger copia el valor sin validar, alguien podría registrarse como `directivo` y ver docentes de un CCT. **No verificable desde el repo.** La UI oculta las opciones no activas, pero el metadata lo controla el navegador |
| Datos de alumnos vistos por el directivo | — | `users.evaluacion_individual` de las docentes del mismo `cct_primary` | El directivo los lee **directo desde el navegador** con `select`; depende de que RLS exista y sea correcta (no verificable) |

---

## 6. VARIABLES DE ENTORNO

Nombres presentes en `.env.local` (archivo ignorado por git: `.gitignore:34 .env*`; revisé el código versionado y no hay llaves pegadas):

| Variable | Dónde se usa | Comentario |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `lib/supabase.ts`, `supabase-browser.ts`, `supabase-middleware.ts`, `verificarSuperAdmin.ts`, `verificarUsuario.ts`, `estado-cuenta` | Pública por diseño |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `supabase-browser.ts`, `supabase-middleware.ts` | Pública por diseño; respeta RLS |
| `SUPABASE_SECRET_KEY` | `lib/supabase.ts`, `verificarSuperAdmin.ts`, `verificarUsuario.ts` (+ `route.ts.bak`) | Llave de servicio "oficial" del proyecto |
| `SUPABASE_SERVICE_ROLE_KEY` | **Solo** `app/api/estado-cuenta/route.ts` | ⚠️ **Duplicada con el mismo propósito** que `SUPABASE_SECRET_KEY` (misma llave de servicio, otro nombre). Si Vercel tiene solo una de las dos, `estado-cuenta` fallaría en silencio ("No se pudo obtener el estado de cuenta") |
| `ANTHROPIC_API_KEY` | Explícita en: analizar-diagnostico-escolar, -estilo-narrativo, -observaciones-directivo, -pdas-jardin, -programa-analitico, `cct-decoder`. **Implícita** (el SDK la toma solo) en: generar-planeacion, sugerir-campos, analizar-diagnostico, analizar-evaluacion-individual | Mismo valor, dos estilos de lectura |
| `CLAUDE_SONNET_MODEL` | generar-planeacion, analizar-pdas-jardin, analizar-programa-analitico (respaldo `'claude-sonnet-4-6'` escrito en el código, sin fecha) | |
| `CLAUDE_HAIKU_MODEL` | analizar-diagnostico, -diagnostico-escolar, -estilo-narrativo, -evaluacion-individual, -observaciones-directivo, sugerir-campos (respaldo `'claude-haiku-4-5-20251001'`) | `lib/agents/cct-decoder.ts` **no** la usa: tiene el modelo Haiku escrito a mano |
| `NEXT_PUBLIC_APP_URL` | **Ningún archivo** | Sin uso |
| `RESEND_API_KEY` | **Ningún archivo** (ni existe `resend` en `package.json`) | Sin uso |

Duplicación de propósito: `SUPABASE_SECRET_KEY` ≡ `SUPABASE_SERVICE_ROLE_KEY`. Además hay **cinco** formas distintas de crear un cliente de Supabase con la llave de servicio (ver §8).

---

## 7. PROMPTS DE IA

Todos los prompts de sistema viven **dentro del archivo de la ruta que los usa** (no hay carpeta de prompts).

| Prompt | Ubicación | Función que lo usa | Modelo / max_tokens |
|---|---|---|---|
| `SYSTEM_PROMPT_DIAS` (reglas R1–R8, R4-PDA, R-TRANSVERSAL, R-SIN-ETIQUETAS, R-CAMPOS-COMPLETOS, R-JORNADA-COMPLETA, R-FORMATO-JSON…) | `app/api/generar-planeacion/route.ts:52` | `generarLoteDeDias()` (mensaje de usuario armado inline en :492-534) | Sonnet · 8000 · con `cache_control: ephemeral`; lotes de **2** días |
| `SYSTEM_PROMPT_CIERRE` (rúbrica R4-PDA, indicador, 3 niveles, ajustes razonables por día) | `generar-planeacion/route.ts:92` | `generarAjustesPorDia()` **y** `generarUnaRubrica()` (un solo prompt para dos tareas distintas) | Sonnet · 8000 (ajustes) / 4000 (rúbrica) |
| `SYSTEM_PROMPT_EJE` | `generar-planeacion/route.ts:589` | `generarDescripcionEje()` | Sonnet · 300 |
| `SYSTEM_PROMPT_EVALUACION_FORMATIVA` | `generar-planeacion/route.ts:597` | `generarDescripcionEvaluacionFormativa()` | Sonnet · 300 |
| Selección de 3 campos transversales + ejes | `app/api/sugerir-campos/route.ts:96` | `POST` | Haiku · 1500 |
| Diagnóstico grupal → 5–7 PDAs | `app/api/analizar-diagnostico/route.ts:36` | `POST` | Haiku · 3000 |
| PMC / diagnóstico escolar | `app/api/analizar-diagnostico-escolar/route.ts:19` | `POST` | Haiku · 1000 |
| Evaluación individual (`systemPrompt` armado dentro del `POST`) | `app/api/analizar-evaluacion-individual/route.ts:194` | `llamarModeloConReintento()` (streaming, cabecera `anthropic-beta: output-128k-2025-02-19`) | Haiku · 48 000 |
| Observaciones de dirección | `app/api/analizar-observaciones-directivo/route.ts:19` | `POST` | Haiku · 800 |
| Estilo narrativo | `app/api/analizar-estilo-narrativo/route.ts:17` | `POST` | Haiku · 800 |
| PDAs del jardín (por índice del catálogo) | `app/api/analizar-pdas-jardin/route.ts:112` | `POST` | Sonnet · 2000 |
| Programa Analítico | `app/api/analizar-programa-analitico/route.ts:151` | `POST` | Sonnet · 4000 |
| Decodificador CCT | `lib/agents/cct-decoder.ts:18` (`SYSTEM_PROMPT`) | `decodeCCT()` ← `api/decode-cct` (sin uso) | Haiku (modelo escrito a mano) · 300 |
| Prompt para convertir calendarios (`PROMPT_ESTANDAR`) | `app/admin/calendario/page.tsx` (~línea 62) | **No lo ejecuta la app**: es texto para copiar a claude.ai | — |
| Copias antiguas del generador | `generar-planeacion/route.ts.bak_20260702_183805` y dentro de `aplicar_fix_generador.sh` | Ninguna (respaldo) | — |

Observaciones sobre la regla de modelos de CLAUDE.md §5 (para que decidas tú): Haiku hace hoy `analizar-evaluacion-individual` y `analizar-diagnostico`, cuyos resultados (PDAs prioritarios, justificaciones, análisis por alumno) la educadora sí ve y usa.

---

## 8. SEÑALES DE DEUDA TÉCNICA (solo lista; no se corrigió nada)

### 8.1 Código duplicado

- **Reparador de JSON** (`repararJSON`, `cerrarJSONTruncado`, `parsearJSONRobusto`, ~75 líneas) copiado idéntico en 4 rutas: `generar-planeacion`, `analizar-evaluacion-individual`, `analizar-pdas-jardin`, `analizar-programa-analitico`. Otras 6 llamadas a IA usan `JSON.parse` directo sobre la respuesta del modelo (`sugerir-campos`, `analizar-diagnostico`, `-diagnostico-escolar`, `-observaciones-directivo`, `-estilo-narrativo`, `cct-decoder`) — CLAUDE.md §4 pide `parsearJSONRobusto` para el generador.
- **Bloque de "historial versionado"** (buscar versión máxima → desactivar la activa → insertar) copiado en 5 rutas `analizar-*` (~40 líneas cada una).
- **"Resolver `users.id` a partir de `auth_uid`"** repetido en ~10 rutas.
- **Clientes**: 10 `new Anthropic(...)` en 3 estilos; clientes Supabase de servicio creados de 5 formas (`lib/supabase.ts`, dentro de `verificarSuperAdmin`, dentro de `verificarUsuario`, dentro de `estado-cuenta` con otra variable, y `test/route.ts ` viejo).
- **Tabla de 32 estados** ×4: `admin/page.tsx`, `admin/calendario/page.tsx`, `api/decodificar-cct`, y dentro del prompt de `cct-decoder`.
- **Dos decodificadores de CCT**: `decodificar-cct` (determinista + catálogo, en uso) y `decode-cct` + `lib/agents/cct-decoder` (IA, sin uso).
- **Dos rutas de "quién soy"**: `auth/me` ⚠️ (con `auth_uid` del navegador; la usa `login`) y `auth/me-session` (con token; la usa `admin/layout`).
- **Verificación de token "a mano"** repetida en `verificar-cct-duplicado` y `auth/me-session`, existiendo ya `verificarUsuario`.
- **Modalidades y fases**: `MOMENTOS_MODALIDAD` (route) vs `NOMBRES_FASES_MODALIDAD` + `ORDEN_MODALIDADES` (nueva/page) + el mismo texto dentro de `aplicar_fix_generador.sh` (con valores distintos y lote de 5).
- **Extracción de prioridades pedagógicas** (`pdas_prioritarios_grupo`, `pdas_jardin`, `contexto_social`): el mismo código en `planeacion/nueva/page.tsx` (~495-510) y en `generar-planeacion` (`obtenerPrioridadesPedagogicas`).
- **Constantes curriculares copiadas**: `CAMPOS_CONFIG` ×3 (`mi-avance`, `directivo/dashboard`, `directivo/docentes/[id]`) con totales 86/130/70/85 = **371** a mano; "371" también en `dashboard` (`totalPdas`) y en textos de `mi-grupo`; `PREFIJO_POR_CAMPO` ×2 (`mi-avance`, `planeacion/[id]`); listas de campos en `planeacion/nueva`, `analizar-pdas-jardin`, `mis-planeaciones`; lista de 7 ejes en varios archivos y dentro de prompts.
- **Utilidades de texto**: `nombreCorto`/`nombreJardinCorto` ×3 (`mi-grupo`, `mis-planeaciones`, `Sidebar`); `iniciales` ×4; `ajustarAlturaTextarea` ×2; `MESES`/`DIAS_SEMANA` en `calendarioEscolar` y `exportar-word`.
- **Días hábiles**: `contarDiasHabiles` "ingenuo" (solo fines de semana) en `planeacion/nueva` frente a `calcularDiasHabiles` del servidor.
- **Estilos**: ~120 colores hex escritos en línea en `planeacion/nueva`, 84 en `mi-grupo`, 75 en `mi-avance`, etc.; `Sidebar` y `SidebarDirectivo` son casi la misma pieza; `lib/design-tokens.ts` existe pero nadie lo usa.

### 8.2 Código o archivos sin uso

- `lib/design-tokens.ts` (150 líneas) y `lib/wordTemplates.ts` (59): ningún importador.
- `api/decode-cct` + `lib/agents/cct-decoder.ts`: ninguna página los llama.
- `api/test` (público, lee `school_years`): ninguna página lo llama.
- **Archivos de respaldo versionados en git**: `app/admin/calendario/page.tsx.bak_20260704_210600`, `app/api/generar-planeacion/route.ts.bak_20260702_183805`, `app/onboarding/page.tsx.bak`, `app/planeacion/nueva/page.tsx.backup`, `aplicar_fix_generador.sh` (contiene una copia completa del generador antiguo), y **`app/api/test/route.ts ` (con un espacio al final del nombre)**.
- Misiones completa (`msn_*`, 3 rutas, `/misiones`) apagada por `MISIONES_ACTIVO = false`, con las rutas API vivas.
- Variables `NEXT_PUBLIC_APP_URL` y `RESEND_API_KEY` sin uso.
- Columnas que se **leen pero nadie escribe** en el código: `users.alumnos_inclusion`, `total_students`, `seccion_grupo`, `grade`, `contexto_grupo`, `programa_analitico.nota_directivo(_fecha)`.
- Ítems "PRONTO" sin ruta en los menús (Calendario, Estadísticas, Informes CTE).
- `admin/costos` y `admin/modelos` muestran texto fijo; el costo real sí se guarda (`plannings.costo_generacion_usd`) pero no se muestra en ningún lado.

### 8.3 Valores escritos a mano (IDs, fechas, ciclos, cifras)

- **UUID de ciclo**: `school_year_id: '96cae520-b0ed-4fcb-9c62-a95212ee357e'` en `generar-planeacion/route.ts:1025` (la BITACORA dice que es el de 2025-2026, ya vencido).
- **Ciclo `'2025-2026'` literal** mientras `CICLO_ESCOLAR_ACTIVO = '2026-2027'`: `api/calendario/fin-ciclo/route.ts:19` (valor por defecto — `mi-avance` no manda `ciclo`, así que consulta el calendario del ciclo anterior; hoy queda oculto por `MODO_PRUEBA_CICLO_ACTIVO = true`); `api/admin/calendario/usar-federal/route.ts:27,39,57`; `admin/cerrar-ciclo/page.tsx:24`; `directivo/dashboard/page.tsx:118` ("Ciclo 2025-2026" en el encabezado).
- **Banderas de prueba en producción**: `MODO_PRUEBA_FECHAS_PASADAS = true` y `FECHA_MINIMA_PRUEBA = '2026-06-01'` (`planeacion/nueva`, permite planear en el pasado); `MODO_PRUEBA_CICLO_ACTIVO = true` (`mi-avance`).
- `CICLO_ESCOLAR_ACTIVO` se cambia **a mano y con `git push`** (así lo indica `admin/cerrar-ciclo`).
- `LEGAL_VERSION = '2026-08-v1'` (register); estado por defecto `'19'` (`admin/calendario-estado`); "7 días gratis" en `register`.
- **Valores por defecto de negocio**: grado `'2°'` en 8 lugares; 24 alumnos por defecto ×4 en `mi-grupo`; tope 60 en `alumnos-codigo`; 35 alumnos (comentarios); 371 PDAs; 7 ejes; 4 campos.
- **Tarifas de Sonnet 4.6** (3.00 / 15.00 / 0.30 / 3.75 USD por millón) en `generar-planeacion:10-13`; nombres de modelo por defecto `'claude-sonnet-4-6'` ×3 (sin fecha; CLAUDE.md §5 pide strings completos) y `'claude-haiku-4-5-20251001'` ×7.
- **Límites de caracteres** (`LIMITES_CARACTERES`, `LIMITE_AJUSTE`) duplicados dentro del texto del prompt (regla R6).
- Umbrales: `UMBRAL_NO_APLICA = 95`, `CONFIRMACIONES_MINIMAS = 3` (`cct-lookup`); `nivelDesdeXP` = xp/100+1 (`completar-mision`).
- `MAX_DIAS_POR_LOTE = 2` en el generador (CLAUDE.md §4 dice "máximo 5"; `aplicar_fix_generador.sh` usa 5). Rúbricas con `max_tokens` 4000 y descripciones con 300, frente al "8000, no reducir" de CLAUDE.md (que se refiere a las llamadas de días).
- Estados de membresía como texto suelto en varios archivos (`trial`, `active`, `suspended`, `cancelled`, `expired`, `founder`); roles como texto suelto (`educadora`, `educador`, `maestra_musica`, `maestro_musica`, `directivo`); `rolAplicableDe` usa `includes('musica')`.
- El análisis de la evaluación individual solo funciona con el marcador literal `"Nombre del Alumno:"` (formato de un jardín específico).

### 8.4 Lógica que parece estar en el archivo equivocado

- **`generar-planeacion/route.ts` (1080 líneas)** junta prompts, reparación de JSON, cálculo de costo, validación de campos, cálculo de distribución de días, guardado en BD y progreso. Los prompts y el reparador de JSON viven dentro de rutas en vez de en `lib/`.
- **Escrituras de negocio desde el navegador** (dependen 100% de RLS, no verificable): `onboarding` escribe `profile_completed` y datos del CCT en `users`; `mi-grupo` escribe `grado`, `grupo_letra`, `total_alumnos`; `configuracion` escribe `avatar_url` y `whatsapp`; `mis-planeaciones`/`planeacion/[id]` cambian `plannings.status` y `rubrics.descartada`. Otras operaciones equivalentes sí pasan por rutas de servidor. Si la política RLS de UPDATE en `users` no limita columnas, un usuario podría intentar tocar `role`, `membership_status` o `is_super_admin` desde la consola del navegador.
- **Tope mensual de días hábiles**: el texto de `mis-planeaciones` y la pantalla de `configuracion` hablan del tope, pero **ningún código del servidor ni del formulario lo aplica**; `generar-planeacion` tampoco revisa `membership_status`.
- **Seguridad de páginas**: solo `/admin` pasa por el proxy; el resto se protege con redirecciones desde el navegador. El directivo se limita a "su" CCT con un `if` en el cliente (`directivo/docentes/[id]`).
- **`lib/supabase.ts`** mezcla cliente de navegador y cliente admin; todas las rutas API que lo importan instancian también un cliente de navegador que no usan. Coexisten 4 formas de obtener el cliente del navegador (`lib/supabase`, `createClient()` propio en cada página, el de `Sidebar`, el de `fetchAdmin`).
- **`planeacion/[id]`** importa `Sidebar` directo (se salta `SidebarWrapper`); el `Sidebar` tiene `Misiones activo:false` escrito a mano en lugar de leer `featureFlags`.
- **Identificadores inconsistentes**: `programa_analitico.educadora_id` guarda `auth_uid`, mientras `alumnos_codigo.user_id`, `documentos_historial.user_id`, `plannings.user_id`, `msn_*.user_id` guardan `users.id`. Pares duplicados: `total_students`/`total_alumnos`, `grade`/`grado`, `seccion_grupo`/`grupo_letra`, `pda_coverage`/`pda_coverage_avanzada`.
- **`admin/cerrar-ciclo`**: limpia 8 campos de `users` (el encabezado dice "8" y un comentario dice "5"), pero **no** limpia `diagnostico_texto`/`diagnostico_fecha`, ni `alumnos_codigo` (los códigos del ciclo anterior siguen activos), ni `alumnos_inclusion`; se ejecuta sobre **todas** las filas de `users` (incluidas cuentas Super Admin).
- **`⚠️ N NEE`** en `directivo/dashboard` (línea ~186): usa signo de alerta y la etiqueta "NEE" para docentes con alumnos con necesidades — choca con el principio "sin alertas punitivas" y con R-SIN-ETIQUETAS (que rige para narrativa, pero es el mismo criterio de producto).
- **`admin/calendario-estado`** oculta cualquier error de base devolviendo "todo vacío" sin avisar.
- **`lang="en"`** en `app/layout.tsx` para una app en español.

### 8.5 Documentación que ya no coincide con el código

- CLAUDE.md §6 dice que `@supabase/ssr` "no se usa en ningún archivo": hoy sí (`lib/supabase-browser.ts`, `lib/supabase-middleware.ts`, `proxy.ts`).
- CLAUDE.md §3 dice "19 tablas"; el código referencia 20 tablas + 4 vistas.
- CLAUDE.md §4 "máximo 5 días por llamada": el código usa 2.
- `BITACORA_INFRAESTRUCTURA.md` (21 ago) afirma que el `insert` de `plannings` vive en `planeacion/nueva/page.tsx`; desde la "Opción B" (sep 2026) vive en `api/generar-planeacion`.
- Comentario de `Sidebar`/`featureFlags` dice que el menú se apaga con el flag; el menú no lo lee.
- `lib/supabase-browser.ts` dice "reemplaza gradualmente los `createClient()` inline"; la migración quedó a medias.

---

*Fin del mapa. Para regenerarlo o actualizar una sección, basta pedirlo; no se cambió ningún otro archivo.*
