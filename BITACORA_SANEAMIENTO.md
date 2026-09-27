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

Referencia: `MAPA_PLATAFORMA.md` (local, NO versionado: describe debilidades de la plataforma).

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

## Pendientes

**Fase 1 — Honestidad de datos (prioridad alta, antes del lanzamiento):**
- Mi Avance: la tarjeta "PDAs trabajados" y la pestaña Campos no coinciden con la cuadrícula
  (99 vs 33 PDA distintos vs 132 usos). Revisar cálculo y posibles planeaciones de prueba del ciclo anterior.
- NEE y ajustes razonables: hoy la IA decide sola quién tiene NEE y `alumnos_inclusion` no la escribe ningún
  archivo. Rediseño: MÍA sugiere, la educadora confirma y describe apoyos (enfoque BAP, sin diagnósticos).
- Dashboard Directivo: función "¿es mi docente?", lista segura de docentes y reglas de solo lectura
  (directivo `active`/`founder`; educadora en cualquier estado).

**Fase 2 — Estructura:** separar `generar-planeacion` (prompts, JSON, límites), reparador de JSON copiado
4 veces, ciclo escolar y UUID escritos a mano, doble `estado: 'completado'`.

**Fase 3 — Limpieza:** respaldos versionados (`.bak`, `.backup`, `aplicar_fix_generador.sh`),
`design-tokens.ts` y `wordTemplates.ts` sin uso, llave duplicada `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY` sin uso.

**Fase 4 — Documentación:** actualizar `CLAUDE.md` y `BITACORA_INFRAESTRUCTURA.md`.

**Legal (para el abogado):** Aviso de Privacidad debe mencionar el procesamiento con proveedor de IA y que la
educadora declara poder compartir sus documentos; Términos deben indicar que el directivo de su CCT verá
sus planeaciones y estadísticas.