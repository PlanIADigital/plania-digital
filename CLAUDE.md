
# CLAUDE.md — PlanIA Digital

Este archivo le da a Claude Code el contexto que normalmente vive solo en la memoria de las conversaciones de Alfredo con Claude en claude.ai. Léelo completo antes de tocar código.

> **Regla de seguridad:** este archivo se sube a GitHub. Nunca escribas aquí el valor real de una llave/API key — solo el *nombre* de la variable de entorno. Los valores reales viven únicamente en `.env.local` (excluido por `.gitignore`) y en las variables de entorno de Vercel.

---

## 1. Qué es PlanIA Digital

SaaS para educadoras de preescolar en México (Fase 2, NEM 2022) que genera planeaciones didácticas con IA. Fundador y único desarrollador: Alfredo — 27 años como educador musical y ex-coordinador SEP NL, **no es programador**. Claude es su colaborador técnico principal.

Roles de usuario (los tres coexisten ya en producción, no son fases de infraestructura):
- **Educadora/Educador** — usuario principal, hasta 2 CCT.
- **Directivo** — acceso de solo lectura vía CCT compartido, auto-vinculado.
- **Maestro/a de Música** — itinerante, usa exclusivamente ABJ (Aprendizaje Basado en Juego).
- **Super Admin** (Alfredo) — panel `/admin`.

Filosofía del producto — **"Cero Fricción, Eficiencia Alta Gama"**:
- El sistema absorbe la complejidad interna; la educadora experimenta mínima fricción.
- La calidad nunca se sacrifica por ahorro de costos.
- MÍA (el asistente del producto) habla como colega experta, nunca corporativo.
- Sin alertas punitivas — solo indicadores armoniosos.

---

## 2. Stack

- **Next.js App Router** (sin carpeta `/src`) — nunca sugerir Pages Router ni HTML/CSS/JS suelto.
- **Supabase** — Postgres + Auth + Storage. Proyecto ID: `zdagfyfhuuaywocaahse` (East US).
- **Anthropic API** — Claude Sonnet/Haiku para generación.
- **Vercel** — despliegue automático en cada push a `main`.
- Repo: `PlanIADigital/plania-digital`. Local: `/Users/user/plania-digital`. Dominio: `plania.digital`.

### Variables de entorno (nombres únicamente — valores en `.env.local` / Vercel)
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — cliente público, respeta RLS.
- `SUPABASE_SECRET_KEY` — **solo en rutas de servidor** (`app/api/*`), nunca en componentes de cliente. Bypasea RLS.
- Llave de Anthropic API — configurada en Vercel, nunca pedir su valor ni escribirlo en código o en este archivo.

---

## 3. Convenciones de nomenclatura (evitar colisiones)

- **`estado`** ya tiene tres significados distintos en el sistema — verificar el contexto de la tabla antes de usar esta palabra en columnas nuevas:
  - `calendarios_sep.estado` = código de entidad federativa (2 dígitos).
  - `users.estado` = estado geográfico de México del usuario (ej. "Nuevo León") — **sin relación con membresía/suscripción**.
  - `suscripciones.status` (tabla futura, no construida aún) = estado de membresía estilo Stripe (`trialing/active/past_due/canceled/unpaid`).
- **`nivel`** — nunca usar solo. `users.nivel_educativo` ya existe (grado escolar). Gamificación futura debe usar `nivel_gamificacion`.
- **Prefijo `msn_`** reservado para tablas de Misiones (gamificación; la sección se llamó "Centro de Aprendizaje" hasta julio 2026): `msn_misiones`, `msn_logros`, `msn_progreso_usuario`, `msn_ranking_cache`.
- **"Bonos"** (no "tokens", no "puntos") — nombre reservado para la futura moneda del sistema SMGM (material didáctico con costo extra). "Tokens" se evita porque colisiona con los tokens de la API de Anthropic en el código.
- Repo tiene 19 tablas reales en Supabase — antes de crear una tabla nueva, verificar con una query a `information_schema.tables` que el nombre no colisione.

---

## 4. Reglas de negocio del generador de planeaciones (`app/api/generar-planeacion/route.ts`)

No negociables, no cambiar sin validación de campo con educadoras:
- **R-CAMPOS-COMPLETOS**, **R4-PDA-COMPUESTO**, **R-JORNADA-COMPLETA**, **R-CIERRE-FINAL**, **R-FORMATO-JSON**.
- **R4-PDA**: el PDA principal define el verbo de acción central → la narrativa debe EJECUTAR ese verbo (no mencionarlo ni parafrasearlo) → la rúbrica evalúa desde esas instancias concretas.
- **R-SIN-ETIQUETAS**: prohibido usar etiquetas diagnósticas/clínicas o palabras de severidad ("crítico", "urgente", "grave") en cualquier texto narrativo o de contexto sobre alumnos con inclusión — la legislación vigente prohíbe etiquetar alumnos neurodivergentes.
- Ajustes razonables: **nunca** nombre real ni diagnóstico del alumno — solo código de referencia (ej. `R.G.-1`) y acciones pedagógicas.
- Arquitectura por lotes: máximo 5 días por llamada a la API; llamada separada para rúbrica + ajustes; `contextoPrevio` y `materialesUsados` se pasan entre lotes para continuidad narrativa.
- `calendarios_sep` **siempre** debe filtrarse por `estadoCodigo` (2 dígitos) — sin ese filtro, `.single()` falla silenciosamente porque hay múltiples calendarios estatales en la misma tabla.
- JSON generado por Claude: pasar siempre por `parsearJSONRobusto()` (repara comillas sin escapar y JSON truncado) — nunca `JSON.parse()` directo sobre la respuesta del modelo.
- `max_tokens=8000` en las llamadas del generador — no reducir por ahorro de costo.

---

## 5. Modelos de IA — principio rector

- **Sonnet** para todo lo que el usuario ve y recibe (generación de planeaciones, rúbricas, edición con IA).
- **Haiku** solo para tareas donde la calidad no está en juego (extracción de formato, onboarding, sugerencias rápidas, routing).
- **Opus** solo para desarrollo del sistema y diseño de prompts maestros — nunca en producción de cara al usuario.
- **Nunca degradar el modelo de generación de planeaciones por ahorro de costos.** Optimizar eficiencia SÍ, sacrificar calidad NO.
- Usar siempre strings de modelo completos y verificados (ej. `claude-sonnet-4-5-20250929`) — los strings cortos causan fallos silenciosos.

---

## 6. Seguridad — estado actual (julio 2026)

- Las rutas bajo `app/api/admin/*` **deben** pasar por `verificarSuperAdmin(request)` (en `lib/verificarSuperAdmin.ts`) antes de tocar la llave de servicio. Esto se corrigió el 22 de julio 2026 tras encontrar 4 rutas completamente abiertas sin ninguna verificación.
- El frontend de `/admin/*` debe usar `fetchAdmin()` (en `lib/fetchAdmin.ts`) en vez de `fetch()` plano para que el token de sesión viaje en el header `Authorization`.
- **Pendiente de fondo (no urgente ya, el hueco principal está cerrado):** migrar de sesión manual por Bearer token a `@supabase/ssr` con cookies, para tener protección también a nivel de middleware/Server Components. La dependencia `@supabase/ssr` ya está instalada en `package.json` pero no se usa en ningún archivo — no asumir que está implementada solo porque está en las dependencias.
- Nunca crear una ruta nueva bajo `app/api/admin/*` sin el guard `verificarSuperAdmin` al inicio.

---

## 7. Preferencias de trabajo de Alfredo (aplican siempre)

- **Archivo completo, no parches.** Alfredo copia-pega-reemplaza completo en VS Code (Cmd+A → Delete → pegar → Cmd+S). Dar siempre el archivo entero, incluso si es largo. Excepción: si el archivo supera ~700 líneas, dar parche preciso (buscar/reemplazar) con justificación explícita de por qué no se reproduce completo.
- Después de cualquier entrega de código, incluir siempre los 3 comandos de git al final:
- Los commits hechos desde un entorno de Claude en la nube **no** se propagan al remoto de GitHub — todo cambio debe aplicarse localmente y subirse desde la máquina de Alfredo.
- Trabaja paso a paso, esperando confirmación ("OK" o "Ya OK") antes de continuar al siguiente paso.
- Prefiere explicaciones directas, sin tecnicismos innecesarios — es fundador no-programador, no ingeniero.

---

## 8. Dónde buscar más contexto

Si una tarea toca algo que no está aquí (pedagogía NEM 2022, arquitectura de agentes, roadmap de features, decisiones de diseño visual, nomenclatura de Musilandia, etc.), es casi seguro que ya se decidió en una conversación anterior con Claude en claude.ai. Antes de asumir o preguntar, es mejor confirmar con Alfredo si ya existe una decisión tomada sobre el tema.



@AGENTS.md
