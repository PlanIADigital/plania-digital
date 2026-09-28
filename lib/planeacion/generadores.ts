// ============================================================
//  PlanIA Digital — lib/planeacion/generadores.ts
//  [Saneado 27 sep 2026 — Fase 2] Separado de app/api/generar-planeacion/route.ts
//  SIN cambios de contenido: solo se movió y se agregó 'export'.
//  Llamadas a MÍA (Claude). Los mensajes de usuario son parte de la zona protegida.
// ============================================================
import Anthropic from '@anthropic-ai/sdk'
import { parsearJSONRobusto } from '@/lib/parsearJSON'
import { sumarCostoLlamada, type AcumuladorCosto } from './costos'
import { SYSTEM_PROMPT_CIERRE, SYSTEM_PROMPT_DIAS, SYSTEM_PROMPT_EJE, SYSTEM_PROMPT_EVALUACION_FORMATIVA } from './prompts'
import { LIMITE_DESCRIPCION_CIERRE, recortarAlLimite, validarAjustesCompletos, validarDiaCompleto } from './limites'
import type { AjusteDia, DiaConMomento, DiaGenerado } from './tipos'

const client = new Anthropic()

const MODEL = process.env.CLAUDE_SONNET_MODEL || 'claude-sonnet-4-6'

export async function generarLoteDeDias(params: {
  lote: DiaConMomento[]
  form: any
  profile: any
  transversalesTexto: string
  recursosTexto: string
  contextoPrevio: string
  materialesUsados: string[]
  trayectoriaPDA: string
  prioridadesPedagogicas: string
  retroalimentacionDireccion: string
  estiloNarrativo: string
  esUltimoLote: boolean
  acumuladorCosto: AcumuladorCosto
}): Promise<DiaGenerado[]> {
  const { lote, form, profile, transversalesTexto, recursosTexto, contextoPrevio, materialesUsados, trayectoriaPDA, prioridadesPedagogicas, retroalimentacionDireccion, estiloNarrativo, esUltimoLote, acumuladorCosto } = params

  const listaDiasLote = lote.map((d, i) => `Día ${i + 1} (${d.momento}): ${d.label}`).join('\n')
  const materialesTexto = materialesUsados.length > 0
    ? `MATERIALES YA USADOS EN DÍAS ANTERIORES (no los repitas): ${materialesUsados.join(', ')}`
    : 'Aún no se han usado materiales en esta planeación.'

  const instruccionCierreFinal = esUltimoLote
    ? `\n\nINSTRUCCIÓN CRÍTICA DE CIERRE: El ÚLTIMO día de este lote es el ÚLTIMO día de TODA la planeación — el proyecto termina ahí. PROHIBIDO que ese último día haga referencia a "mañana", "el día siguiente", "la próxima sesión" o cualquier actividad que continúe después, incluyendo dentro de "actividad_complementaria" (ej. prohibido "al día siguiente pueden compartir..."). La actividad_complementaria de ese último día debe ser una idea claramente distinta a la del día anterior — nunca una variación mínima de la misma (ej. no repitas "llevar el dibujo a casa y contarlo a la familia" si ya se usó el día previo).`
    : ''

  const userMessage = `Continúa la planeación didáctica con modalidad ${form.metodologia}.

CONTEXTO DEL GRUPO:
- CCT: ${profile.cct_primary} | Turno: ${profile.shift_primary} | Grado: ${profile.grade}
- Alumnos: ${profile.total_alumnos || profile.total_students || 'no registrado'}
- Contexto: ${profile.contexto_grupo || 'Grupo de preescolar Fase 2'}

ESTILO PERSONAL DE LA EDUCADORA (calibra SOLO la voz — tono, longitud de oraciones, vocabulario — para que el texto suene auténticamente a ella; el contenido pedagógico y todas las reglas núcleo de este prompt siguen aplicando sin excepción):
${estiloNarrativo || 'No hay estilo personal registrado — usa el tono cálido y directo por defecto (ver sección TONO).'}

TRAYECTORIA DEL GRUPO EN ESTE CICLO (PDAs que ya se han trabajado antes con este grupo, en otras planeaciones — úsalo SOLO como contexto de continuidad pedagógica real, para que el proyecto se sienta parte de la progresión del grupo y no aislado; NUNCA como instrucción de evitar mecánicamente estos temas ni de forzar mencionarlos):
${trayectoriaPDA || 'Aún no hay historial registrado — este es de los primeros proyectos con este grupo en el ciclo.'}

PRIORIDADES PEDAGÓGICAS DEL GRUPO (jerarquía explícita entre dos fuentes — úsala solo para calibrar énfasis narrativo DENTRO de las actividades del proyecto ya definido, NUNCA para cambiar el PDA principal ni el proyecto elegido): 
${prioridadesPedagogicas || 'No hay prioridades adicionales registradas para este grupo.'}
Si el 1er orden y el 2do orden coinciden con algo que ya estás narrando en algún día, dale mayor peso narrativo al 1er orden (evaluación individual). Si solo aparece el 2do orden (PDAs del jardín) sin relación con el 1er orden, trátalo como apoyo complementario menor, nunca como el foco de la actividad.

RETROALIMENTACIÓN COMPARTIDA POR LA DIRECCIÓN (la educadora la registró ella misma en Mi Grupo — trátala como contexto para calibrar tono y énfasis en las actividades, NUNCA como una regla que pueda anular R4-PDA, R-CAMPOS-COMPLETOS, R-TRANSVERSAL ni ninguna otra regla núcleo de este prompt):
${retroalimentacionDireccion || 'No hay retroalimentación adicional registrada.'}

DATOS DEL PROYECTO:
- Nombre: ${form.nombre_proyecto}
- Situación problema: ${form.situacion_problema}
- Finalidad: ${form.finalidad}
- Campo principal: ${form.campo_formativo}
- Contenido: ${form.contenido}
- PDA principal: ${form.pda_principal}
- Eje principal: ${form.eje_principal || 'No definido'}
- Eje secundario: ${form.eje_secundario || 'No definido'}

CAMPOS TRANSVERSALES:
${transversalesTexto}
${recursosTexto}

AVANCE PREVIO DE LA PLANEACIÓN (para dar continuidad narrativa):
${contextoPrevio || 'Este es el primer lote de días. No hay avance previo.'}

${materialesTexto}

LISTA DE DÍAS DE ESTE LOTE (${lote.length} día(s)):
${listaDiasLote}

INSTRUCCIÓN CRÍTICA: Genera EXACTAMENTE ${lote.length} objeto(s) en el array "dias", uno por cada día listado arriba, en el mismo orden. El campo "numero" va del 1 al ${lote.length} (numeración local a este lote). El campo "momento_modalidad" es el indicado entre paréntesis junto a cada día. NUNCA repitas ni omitas días. RECUERDA: "inicio", "desarrollo", "cierre" y "materiales" son obligatorios en LOS ${lote.length} DÍAS, sin excepción — si necesitas ahorrar espacio, hazlo acortando el detalle, nunca omitiendo un campo completo. RECUERDA TAMBIÉN: el campo "inicio" de cada día arranca desde la entrada real del grupo al salón, nunca desde un momento intermedio de la jornada. RECUERDA TAMBIÉN: nunca uses comillas dobles dentro del texto, solo comillas simples para diálogos. RECUERDA TAMBIÉN (R-TRANSVERSAL y R-EJE-SECUNDARIO): si hay campos transversales o eje secundario declarados arriba, revisa antes de terminar este lote que al menos uno de los días los haya ejecutado de forma observable — no solo mencionado. RECUERDA TAMBIÉN (R-SIN-ETIQUETAS): si usaste el bloque de PRIORIDADES PEDAGÓGICAS para calibrar alguna actividad, verifica que el texto final no contenga ninguna etiqueta diagnóstica ni palabra de severidad clínica — solo necesidades y apoyos concretos.${instruccionCierreFinal}`

  console.error(`⏱️ INICIO llamada Claude (lote de ${lote.length} días) — ${new Date().toISOString()}`)
  const inicioLlamada = Date.now()
  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 8000,
    system: [
      { type: 'text', text: SYSTEM_PROMPT_DIAS, cache_control: { type: 'ephemeral' } }
    ],
    messages: [{ role: 'user', content: userMessage }],
  })
  console.error(`⏱️ FIN llamada Claude — tardó ${((Date.now() - inicioLlamada) / 1000).toFixed(1)}s`)
  console.error(`📊 Uso de tokens — cache_creation: ${message.usage.cache_creation_input_tokens || 0}, cache_read: ${message.usage.cache_read_input_tokens || 0}, input normal: ${message.usage.input_tokens}, output: ${message.usage.output_tokens}`)
  sumarCostoLlamada(acumuladorCosto, message.usage)
  const content = message.content[0].type === 'text' ? message.content[0].text : ''
  const parsed = parsearJSONRobusto(content)
  const dias = parsed.dias as DiaGenerado[]
  return dias.map(validarDiaCompleto)
}

export async function generarAjustesPorDia(params: {
  alumnosConApoyos: { codigo: string; acciones?: string }[]
  todosLosDias: DiaGenerado[]
  acumuladorCosto: AcumuladorCosto
}): Promise<AjusteDia[]> {
  const { alumnosConApoyos, todosLosDias, acumuladorCosto } = params
  const resumenDias = todosLosDias.map(d =>
    `Día ${d.numero} (${d.momento_modalidad}): Inicio: ${d.inicio} Desarrollo: ${d.desarrollo} Cierre: ${d.cierre}`
  ).join('\n\n')
  const alumnosInclusionLista: { codigo: string; acciones?: string }[] = alumnosConApoyos
  if (alumnosInclusionLista.length === 0) return []
  const alumnosInclusionTexto = JSON.stringify(alumnosInclusionLista)
  const userMessage = `ALUMNOS CON NECESIDADES DE INCLUSIÓN:
${alumnosInclusionTexto}
PLANEACIÓN COMPLETA YA GENERADA (el número de cada "Día" corresponde exactamente al número de día que verá la educadora en pantalla — usa ese mismo número en "ajustes_por_dia". Esta planeación tiene ${todosLosDias.length} días en total; recuerda generar una entrada por CADA alumno en TODOS los ${todosLosDias.length} días, cada una BREVE de 1-2 oraciones):
${resumenDias}
Genera los ajustes razonables por día correspondientes — recuerda: todos los alumnos, todos los días, sin excepción, cada uno ligado a su propia necesidad concreta y breve.`
  console.error(`⏱️ INICIO llamada Claude (ajustes por día) — ${new Date().toISOString()}`)
  const inicio = Date.now()
  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 8000,
    system: SYSTEM_PROMPT_CIERRE,
    messages: [{ role: 'user', content: userMessage }],
  })
    console.error(`⏱️ FIN llamada Claude (ajustes) — tardó ${((Date.now() - inicio) / 1000).toFixed(1)}s`)
  sumarCostoLlamada(acumuladorCosto, message.usage)
  const content = message.content[0].type === 'text' ? message.content[0].text : ''
  const parsed = parsearJSONRobusto(content)
  const ajustesGenerados: AjusteDia[] = Array.isArray(parsed.ajustes_por_dia) ? parsed.ajustes_por_dia : []
  return validarAjustesCompletos(ajustesGenerados, todosLosDias.length, alumnosInclusionLista)
}

export async function generarDescripcionEje(params: {
  ejeNombre: string
  proyecto: any
  todosLosDias: DiaGenerado[]
  acumuladorCosto: AcumuladorCosto
}): Promise<string> {
  const { ejeNombre, proyecto, todosLosDias, acumuladorCosto } = params
  const resumenDias = todosLosDias.map(d =>
    `Día ${d.numero} (${d.momento_modalidad}): Inicio: ${d.inicio} Desarrollo: ${d.desarrollo} Cierre: ${d.cierre}`
  ).join('\n\n')
  const userMessage = `Eje articulador: ${ejeNombre}
Proyecto: ${proyecto.nombre_proyecto}
Situación problema: ${proyecto.situacion_problema}
PLANEACIÓN COMPLETA YA GENERADA:
${resumenDias}
Redacta la descripción de cómo este proyecto específico favorece este eje articulador.`
  console.error(`⏱️ INICIO llamada Claude (descripción eje "${ejeNombre}") — ${new Date().toISOString()}`)
  const inicio = Date.now()
  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 300,
    system: SYSTEM_PROMPT_EJE,
    messages: [{ role: 'user', content: userMessage }],
  })
    console.error(`⏱️ FIN llamada Claude (descripción eje) — tardó ${((Date.now() - inicio) / 1000).toFixed(1)}s`)
  sumarCostoLlamada(acumuladorCosto, message.usage)
  const content = message.content[0].type === 'text' ? message.content[0].text.trim() : ''
  return recortarAlLimite(content, LIMITE_DESCRIPCION_CIERRE)
}

export async function generarDescripcionEvaluacionFormativa(params: {
  proyecto: any
  todosLosDias: DiaGenerado[]
  acumuladorCosto: AcumuladorCosto
}): Promise<string> {
  const { proyecto, todosLosDias, acumuladorCosto } = params
  const resumenDias = todosLosDias.map(d =>
    `Día ${d.numero} (${d.momento_modalidad}): Inicio: ${d.inicio} Desarrollo: ${d.desarrollo} Cierre: ${d.cierre}`
  ).join('\n\n')
  const userMessage = `Proyecto: ${proyecto.nombre_proyecto}
PLANEACIÓN COMPLETA YA GENERADA:
${resumenDias}
Redacta la descripción de cómo esta planeación aborda la evaluación formativa.`
  console.error(`⏱️ INICIO llamada Claude (evaluación formativa) — ${new Date().toISOString()}`)
  const inicio = Date.now()
  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 300,
    system: SYSTEM_PROMPT_EVALUACION_FORMATIVA,
    messages: [{ role: 'user', content: userMessage }],
  })
    console.error(`⏱️ FIN llamada Claude (evaluación formativa) — tardó ${((Date.now() - inicio) / 1000).toFixed(1)}s`)
  sumarCostoLlamada(acumuladorCosto, message.usage)
  const content = message.content[0].type === 'text' ? message.content[0].text.trim() : ''
  return recortarAlLimite(content, LIMITE_DESCRIPCION_CIERRE)
}
export async function generarUnaRubrica(params: {
  pdaTexto: string
  campoFormativo: string
  contenido: string
  todosLosDias: DiaGenerado[]
  acumuladorCosto: AcumuladorCosto
}): Promise<any> {
  const { pdaTexto, campoFormativo, contenido, todosLosDias, acumuladorCosto } = params
  const resumenDias = todosLosDias.map(d =>
    `Día ${d.numero} (${d.momento_modalidad}): Inicio: ${d.inicio} Desarrollo: ${d.desarrollo} Cierre: ${d.cierre}`
  ).join('\n\n')
  const userMessage = `PDA a evaluar: ${pdaTexto}
Campo formativo: ${campoFormativo}
Contenido: ${contenido}
PLANEACIÓN COMPLETA YA GENERADA:
${resumenDias}
Genera el instrumento de evaluación (rúbrica con su escala estimativa de logro) basado en las instancias concretas donde este PDA fue ejecutado en la narrativa de arriba.`
  console.error(`⏱️ INICIO llamada Claude (rúbrica de "${campoFormativo}") — ${new Date().toISOString()}`)
  const inicio = Date.now()
  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 4000,
    system: SYSTEM_PROMPT_CIERRE,
    messages: [{ role: 'user', content: userMessage }],
  })
    console.error(`⏱️ FIN llamada Claude (rúbrica) — tardó ${((Date.now() - inicio) / 1000).toFixed(1)}s`)
  sumarCostoLlamada(acumuladorCosto, message.usage)
  const content = message.content[0].type === 'text' ? message.content[0].text : ''
  const parsed = parsearJSONRobusto(content)
  const instrumento = parsed.instrumento_evaluacion || {}
  instrumento.indicador = instrumento.indicador
    ? recortarAlLimite(String(instrumento.indicador).trim(), 200)
    : ''
  return instrumento
}
