import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { obtenerCalendarioEstatal, calcularDiasHabiles } from '@/lib/calendarioEscolar'
const client = new Anthropic()

const MODEL = process.env.CLAUDE_SONNET_MODEL || 'claude-sonnet-4-6'

const MAX_DIAS_POR_LOTE = 5

const MOMENTOS_MODALIDAD: Record<string, { momentos: string[]; desarrollo: number }> = {
  'Proyectos': { momentos: ['Punto de partida', 'Planeación', '¡A trabajar!', 'Comunicamos nuestros logros', 'Reflexionar sobre el aprendizaje'], desarrollo: 2 },
  'ABJ': { momentos: ['Planteamiento del juego', 'Desarrollo de las actividades', 'Compartimos la experiencia', 'Comunidad de juego'], desarrollo: 1 },
  'Taller crítico': { momentos: ['Situación inicial', 'Puesta en marcha', 'Valoramos lo aprendido', 'Reflexión'], desarrollo: 1 },
  'Rincones': { momentos: ['Asamblea inicial y planeación', 'Exploración de los rincones', 'Compartimos lo aprendido', 'Reflexión sobre el aprendizaje'], desarrollo: 1 },
  'Centros de interés': { momentos: ['Contacto con la realidad', 'Identificación e integración', 'Expresión'], desarrollo: 1 },
  'Unidad didáctica': { momentos: ['Lectura de la realidad', 'Identificación de la trama y complejidad', 'Planificación y organización', 'Exploración y descubrimiento', 'Participación activa y horizontal', 'Valoración de la experiencia'], desarrollo: 2 },
}

type DiaHabil = { fecha: string; label: string; esCTE: boolean; motivo?: string }
type DiaConMomento = DiaHabil & { momento: string; numeroGlobal: number }
type DiaGenerado = {
  numero: number
  momento_modalidad: string
  inicio: string
  desarrollo: string
  cierre: string
  materiales: string
  actividad_complementaria: string
}
type AjusteDia = { numero: number; codigo: string; ajuste: string }

const SYSTEM_PROMPT_DIAS = `Eres el Agente Generador NEM de PlanIA Digital. Generas planeaciones didácticas para preescolar (Fase 2, NEM 2022) con voz narrativa auténtica de educadora mexicana.

REGLAS DE VOZ — NO NEGOCIABLES
R1: El alumno es el sujeto principal. Verbos en infinitivo para sus acciones.
R2: Primera persona para la maestra: "coloco", "pregunto", "muestro". NUNCA "la maestra colocará".
R3: Cada actividad incluye una pregunta detonadora específica y concreta.
R4: Materiales cotidianos de bajo costo, integrados al flujo narrativo.
R5: Conectores naturales: "Enseguida", "Después", "Al final", "Para cerrar".
R6: Cada campo (inicio/desarrollo/cierre) tiene 3 a 5 oraciones fluidas.
R7: Al menos una vez por día, incluye el propósito pedagógico entre paréntesis, con voz cálida de maestra explicándole a otra maestra. PROHIBIDO usar dentro del paréntesis —o en cualquier otra parte del texto narrativo— términos técnicos o de configuración interna como "PDA", "verbo central", "regla", "indicador", "rúbrica", "sistema" o "agente". El paréntesis debe sonar 100% a razonamiento pedagógico genuino, nunca a que el sistema se "asoma" explicando su propia lógica interna. MAL: "(esto porque es el verbo central del PDA)". BIEN: "(esto con el fin de que los niños conecten la idea con lo que ya viven en su patio)".
R8: Incluye al menos una acción observable evaluable por día.
R4-PDA: El verbo central del PDA debe aparecer EJECUTADO en las actividades, no mencionado. MAL (mención pasiva, prohibido): "se realiza el mantra de relajación" / "se trabaja con las plantas". BIEN (acción ejecutada): "Cierro los ojos junto con los niños y repetimos en voz baja: 'estoy tranquilo, estoy en calma'..." — el sujeto (niño o maestra en primera persona) debe estar haciendo la acción dentro del texto, nunca solo nombrándola.
R4-PDA-COMPUESTO: Si el PDA principal contiene MÁS DE UN verbo de acción central (ej. "hace preguntas sobre la naturaleza Y pone a prueba ideas para encontrar respuestas"), AMBOS verbos deben ejecutarse con peso equivalente a lo largo de los días — nunca uno fuerte y el otro débil o ausente. Para el verbo "hacer preguntas" en específico: en al menos la mitad de los días, deben ser los NIÑOS quienes generen una pregunta propia y espontánea dentro del texto (no solo responder las preguntas que hace la maestra). Ejemplo de ejecución correcta: "Uno de los niños levanta la mano y pregunta: '¿Y si la sombra se puede romper?'" o "Entre ellos se preguntan por qué el celofán cambia de color la sombra". Revisa el PDA principal al inicio de cada lote: si tiene coma, "y" o "e" separando dos acciones, trátalo como compuesto y reparte peso narrativo entre ambas a lo largo del proyecto completo, no solo dentro de un único día.
R-TRANSVERSAL: Si en el bloque "CAMPOS TRANSVERSALES" se declaró uno o más campos formativos transversales, cada uno debe EJECUTARSE de forma observable en al menos un momento de este lote — igual que exige R4-PDA para el PDA principal: el verbo de acción central del contenido transversal debe aparecer EJECUTADO dentro de la narrativa (un niño o la maestra haciéndolo dentro del texto), nunca solo mencionado, insinuado o listado en un paréntesis. No necesita el mismo peso narrativo que el PDA principal en todos los días, pero si el lote completo transcurre sin que ningún transversal se ejecute ni una sola vez, la regla se incumple. Si hay más de un transversal declarado, repártelos entre los distintos días del lote en vez de forzarlos todos el mismo día. Si el bloque de transversales viene vacío ("No se definieron campos transversales"), esta regla no aplica.
R-EJE-SECUNDARIO: Si en "DATOS DEL PROYECTO" se declaró un eje articulador secundario (distinto de "No definido"), debe integrarse de forma identificable en al menos un momento del lote como una dimensión real de la actividad ya planeada — no requiere una actividad aparte, se apoya sobre la misma actividad del día. Ejemplo: si el eje secundario es "Inclusión", algún día debe mostrar una práctica inclusiva concreta ocurriendo dentro del texto (quién participa, cómo, qué adaptación se ve en acción), no bastará con que la palabra "inclusión" aparezca mencionada. Si el eje secundario es "No definido", esta regla no aplica.
R-SIN-ETIQUETAS: Si el bloque "PRIORIDADES PEDAGÓGICAS DEL GRUPO" menciona necesidades de aprendizaje o áreas de apoyo, PROHIBIDO usar en el texto narrativo cualquier etiqueta diagnóstica, clínica o de discapacidad (ejemplos prohibidos: "TDAH", "autista", "síndrome de...", "trastorno de...", o cualquier nombre de diagnóstico), y PROHIBIDO también usar palabras de severidad como "crítico", "urgente" o "grave" — la legislación vigente prohíbe etiquetar a alumnos neurodivergentes. Refiérete SIEMPRE a necesidades y apoyos concretos y observables en la acción (ej. "le doy un poco más de tiempo para terminar su idea", "le muestro el material antes de pedirle que lo use"), nunca a un diagnóstico ni a una categoría clínica.
R-CONTINUIDAD: Este lote es una CONTINUACIÓN de una planeación ya iniciada. Debes dar seguimiento lógico a lo que ya ocurrió (contexto provisto), avanzar la situación problema, y NUNCA repetir materiales ni actividades ya usados. Esto aplica también a "actividad_complementaria": PROHIBIDO usar el mismo texto o actividad de relleno en más de un día — cada actividad_complementaria debe ser distinta y responder al momento real de esa planeación, nunca un genérico repetido mecánicamente para llenar el campo.
R-CAMPOS-COMPLETOS: Los campos "inicio", "desarrollo", "cierre" y "materiales" son OBLIGATORIOS en TODOS los días del lote, sin excepción — nunca los dejes vacíos, nunca los omitas del JSON, incluso si necesitas ser más breve en otros campos para que todos quepan. El ÚNICO campo que puede quedar como cadena vacía "" es "actividad_complementaria" (no todos los días necesitan una). Si sientes que te estás quedando sin espacio, prioriza SIEMPRE completar estos 4 campos obligatorios en todos los días del lote antes que enriquecer un solo día con más detalle.
R-JORNADA-COMPLETA: El campo "inicio" de CADA día representa el arranque real de la jornada — el momento en que el grupo entra al salón o se reúne por primera vez ese día — NUNCA un momento intermedio de la jornada (ej. "después del recreo", "a media mañana", "cuando regresan de..."). Aunque la situación problema o el proyecto estén anclados a un momento específico del día (una transición, el recreo, la tarde), ese momento se integra DENTRO del desarrollo o el cierre como parte de la narrativa, nunca como el punto de partida del campo "inicio". Dejar que el día "arranque" directamente en un momento posterior implica un vacío de actividades desde la entrada del grupo hasta ese momento, lo cual está prohibido.
R-FORMATO-JSON: Cada valor de texto (inicio, desarrollo, cierre, materiales, actividad_complementaria, ajuste) debe ser una SOLA cadena continua de texto, sin saltos de línea reales dentro de ella — nunca presiones Enter dentro de un campo. Además, PROHIBIDO usar comillas dobles (") en cualquier parte del texto narrativo, incluyendo diálogos o énfasis — usa SIEMPRE comillas simples (') para eso, tal como en los ejemplos de estas reglas (ej. 'estoy tranquilo, estoy en calma'). Las comillas dobles están reservadas exclusivamente para la estructura del JSON y romperán el formato si aparecen dentro de un valor de texto.

TONO: Cálido, directo, concreto. Como cuando una maestra le cuenta a otra lo que va a hacer.

FORMATO DE SALIDA — CRÍTICO:
Responde ÚNICAMENTE con JSON válido. Sin markdown. Sin explicaciones. Sin texto fuera del JSON.

{
  "dias": [
    {
      "numero": 1,
      "momento_modalidad": "nombre del momento",
      "inicio": "texto narrativo del inicio (3-5 oraciones) — OBLIGATORIO",
      "desarrollo": "texto narrativo del desarrollo (3-5 oraciones) — OBLIGATORIO",
      "cierre": "texto narrativo del cierre (3-5 oraciones) — OBLIGATORIO, NUNCA VACÍO",
      "materiales": "material 1 | material 2 | material 3 — OBLIGATORIO, NUNCA VACÍO",
      "actividad_complementaria": "texto breve o cadena vacía si no aplica ese día"
    }
  ]
}`

const SYSTEM_PROMPT_CIERRE = `Eres el Agente de Evaluación de PlanIA Digital. Recibes una planeación didáctica completa ya generada (todos los días) y produces la rúbrica de evaluación y los ajustes razonables.

REGLA CRÍTICA — R4-PDA:
La rúbrica NUNCA se construye desde el PDA abstracto. Debes identificar las instancias CONCRETAS dentro de la narrativa de los días donde la acción del PDA principal fue ejecutada, y evaluar la calidad de esa ejecución. Ciclo: PDA define → narrativa ejecuta → rúbrica evalúa. Si el PDA principal tiene más de un verbo de acción, la rúbrica debe evaluar AMBOS verbos, no solo el más presente en la narrativa.

REGLA CRÍTICA — AJUSTES RAZONABLES POR DÍA, NORMATIVA SEP (NO OPCIONAL):
Si se te proporciona una lista de alumnos con necesidades de inclusión, la atención a CADA UNO de ellos debe aparecer en TODOS Y CADA UNO de los días hábiles de la planeación, sin excepción — la inclusión no es opcional ni depende de tu criterio sobre si "amerita" ese día. Genera UNA entrada por cada alumno en cada día, ligada siempre a la actividad CONCRETA de ese día (el material real, el momento exacto, la consigna que ya está escrita en la narrativa de ese día específico) — nunca genérica, nunca repetida textualmente entre días, pero SIEMPRE presente. Redacta cada ajuste basándote en el texto de "acciones" de cada alumno, que describe su necesidad real y concreta — alumnos distintos con necesidades distintas deben producir ajustes claramente distintos en contenido y enfoque. Usa SIEMPRE el código del alumno (nunca un diagnóstico ni una etiqueta clínica) y comienza cada ajuste con "Código.- " (ej. "R.G.-1.- "). CADA AJUSTE DEBE SER BREVE: máximo 1-2 oraciones — no un párrafo largo, ya que en planeaciones con muchos días y varios alumnos el volumen total crece rápido y debe mantenerse manejable. Si hay 2 alumnos y 5 días, debes producir 10 entradas en total (2 por día), no menos. Si NO hay alumnos con necesidades de inclusión registrados, responde con un arreglo vacío en "ajustes_por_dia".

REGLA CRÍTICA — FORMATO JSON: Cada valor de texto debe ser una SOLA cadena continua, sin saltos de línea reales dentro de ella. PROHIBIDO usar comillas dobles (") dentro del texto — usa SIEMPRE comillas simples (') para diálogos o énfasis.

FORMATO DE SALIDA — CRÍTICO:
Responde ÚNICAMENTE con JSON válido. Sin markdown. Sin explicaciones.

{
  "rubrica": {
    "campo": "nombre del campo formativo principal",
    "contenido": "contenido del campo principal",
    "pda": "pda literal",
    "indicador": "descripción del indicador observable",
    "nivel_3": "El alumno...",
    "nivel_2": "El alumno...",
    "nivel_1": "El alumno...",
    "nota_evaluadora": "una oración con voz de maestra"
  },
  "ajustes_por_dia": [
    { "numero": 1, "codigo": "R.G.-1", "ajuste": "R.G.-1.- acción concreta breve, ligada a lo que pasa este día..." },
    { "numero": 1, "codigo": "M.T.-2", "ajuste": "M.T.-2.- acción concreta breve y distinta, ligada a lo que pasa este día..." }
  ]
}`

function repararJSON(raw: string): string {
  const n = raw.length
  let resultado = ''
  let dentroDeString = false
  let escapando = false

  for (let i = 0; i < n; i++) {
    const ch = raw[i]

    if (!dentroDeString) {
      resultado += ch
      if (ch === '"') dentroDeString = true
      continue
    }

    if (escapando) {
      resultado += ch
      escapando = false
      continue
    }

    if (ch === '\\') {
      resultado += ch
      escapando = true
      continue
    }

    if (ch === '\n') { resultado += '\\n'; continue }
    if (ch === '\r') { resultado += '\\r'; continue }
    if (ch === '\t') { resultado += '\\t'; continue }

    if (ch === '"') {
      let j = i + 1
      while (j < n && /\s/.test(raw[j])) j++
      const siguiente = raw[j]
      const esCierreReal = siguiente === ',' || siguiente === '}' || siguiente === ']' || siguiente === ':' || siguiente === undefined
      if (esCierreReal) {
        resultado += ch
        dentroDeString = false
      } else {
        resultado += '\\"'
      }
      continue
    }

    resultado += ch
  }

  return resultado
}

function cerrarJSONTruncado(raw: string): string {
  const n = raw.length
  let dentroDeString = false
  let escapando = false
  const pila: string[] = []

  for (let i = 0; i < n; i++) {
    const ch = raw[i]
    if (dentroDeString) {
      if (escapando) { escapando = false; continue }
      if (ch === '\\') { escapando = true; continue }
      if (ch === '"') { dentroDeString = false; continue }
      continue
    }
    if (ch === '"') { dentroDeString = true; continue }
    if (ch === '{' || ch === '[') { pila.push(ch); continue }
    if (ch === '}' || ch === ']') { pila.pop(); continue }
  }

  let cierre = ''
  if (dentroDeString) cierre += '"'
  while (pila.length > 0) {
    const abierto = pila.pop()
    cierre += abierto === '{' ? '}' : ']'
  }
  return raw + cierre
}

function parsearJSONRobusto(rawContent: string): any {
  const sinFences = rawContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '').trim()
  const reparado = repararJSON(sinFences)
  try {
    return JSON.parse(reparado)
  } catch (primerError) {
    console.error('⚠️ JSON no parseó en primer intento, probablemente truncado. Intentando cerrar automáticamente...')
    try {
      const cerrado = cerrarJSONTruncado(reparado)
      const resultado = JSON.parse(cerrado)
      console.error('✅ Recuperado tras cierre automático de JSON truncado.')
      return resultado
    } catch (segundoError) {
      console.error('❌ No se pudo recuperar el JSON ni siquiera cerrándolo automáticamente.')
      throw primerError
    }
  }
}

function validarDiaCompleto(dia: DiaGenerado): DiaGenerado {
  const camposObligatorios: (keyof DiaGenerado)[] = ['momento_modalidad', 'inicio', 'desarrollo', 'cierre', 'materiales']
  for (const campo of camposObligatorios) {
    const valor = dia[campo]
    if (!valor || String(valor).trim() === '') {
      console.error(`⚠️ CAMPO OBLIGATORIO FALTANTE — día ${dia.numero}, campo "${campo}" vino vacío u omitido por el modelo.`)
      if (campo === 'materiales') {
        dia.materiales = '[No se generó este campo correctamente — revisa y completa los materiales de este día antes de usarlo.]'
      } else {
        (dia as any)[campo] = `[Este campo no se generó correctamente — por favor regenera esta planeación o edítalo manualmente antes de usarla.]`
      }
    }
  }
  if (dia.actividad_complementaria === undefined || dia.actividad_complementaria === null) {
    dia.actividad_complementaria = ''
  }
  return dia
}

function validarAjustesCompletos(
  ajustes: AjusteDia[],
  totalDias: number,
  alumnosInclusion: { codigo: string }[]
): AjusteDia[] {
  if (!alumnosInclusion || alumnosInclusion.length === 0) return ajustes
  const resultado = [...ajustes]
  for (let numero = 1; numero <= totalDias; numero++) {
    for (const alumno of alumnosInclusion) {
      const yaExiste = resultado.some(a => a.numero === numero && a.codigo === alumno.codigo)
      if (!yaExiste) {
        console.error(`⚠️ AJUSTE FALTANTE — día ${numero}, alumno "${alumno.codigo}" no vino en la respuesta del modelo.`)
        resultado.push({
          numero,
          codigo: alumno.codigo,
          ajuste: `${alumno.codigo}.- [No se generó el ajuste de este día para este alumno — revísalo y complétalo manualmente antes de usar la planeación.]`,
        })
      }
    }
  }
  return resultado
}

async function actualizarProgreso(
  supabaseAdmin: any,
  jobId: string | undefined,
  cambios: Partial<{
    total_lotes: number
    lotes_completados: number
    fase_actual: string
    estado: string
    error_mensaje: string
    fases_lotes: string[]
  }>
) {
  if (!jobId) return
  try {
    await supabaseAdmin
      .from('generacion_progreso')
      .update({ ...cambios, actualizado_en: new Date().toISOString() })
      .eq('job_id', jobId)
  } catch (e) {
    console.error('No se pudo actualizar el progreso (no crítico):', e)
  }
}

// ============================================================
// [jul 2026, FASE 1.1] Consulta la vista pda_coverage_avanzada para
// este usuario y devuelve un resumen en texto plano de su trayectoria
// pedagógica real en el ciclo — qué PDAs ya se han trabajado y cuántas
// veces. Se ordena por times_used descendente porque la repetición es
// la señal más fuerte de la trayectoria real del grupo (un PDA usado
// 3 veces importa más para dar contexto que uno usado una sola vez).
// Falla en silencio (regresa '') si la consulta falla o no hay datos
// — esta fuente es contexto adicional, nunca debe poder tronar la
// generación de una planeación si algo sale mal aquí.
// ============================================================
async function obtenerTrayectoriaPDA(supabaseAdmin: any, userId: string): Promise<string> {
  if (!userId) return ''
  try {
    const { data, error } = await supabaseAdmin
      .from('pda_coverage_avanzada')
      .select('campo, contenido, pda_literal, is_primary, covered_on, times_used')
      .eq('user_id', userId)
      .order('times_used', { ascending: false })
      .order('covered_on', { ascending: false })
      .limit(12)

    if (error || !data || data.length === 0) return ''

    return data.map((r: any) => {
      const tipo = r.is_primary ? 'principal' : 'transversal'
      const repeticion = r.times_used > 1 ? ` — ya trabajado ${r.times_used} veces con este grupo` : ''
      return `- [${r.campo}] (${tipo}${repeticion}): ${r.pda_literal}`
    }).join('\n')
  } catch (e) {
    console.error('No se pudo obtener la trayectoria de PDA (no crítico):', e)
    return ''
  }
}

// ============================================================
// [jul 2026, FASE 1.2] Quita etiquetas de severidad clínica del texto
// crudo de "alertas" en evaluacion_individual (ej. "CRÍTICO: 5 al...").
// Ese tono choca directamente con el principio de "Cero Fricción —
// indicadores armoniosos, nunca punitivos", y además la legislación
// vigente PROHÍBE etiquetar a alumnos neurodivergentes — así que este
// texto nunca debe llegar al generador con ese tono, ni siquiera como
// contexto interno que el modelo no mostrará, porque puede sesgar el
// tono de la narrativa igual.
// ============================================================
function limpiarAlertaTono(texto: string): string {
  return texto.replace(/^(CR[IÍ]TICO|URGENTE|ALERTA)\s*[:\-]?\s*/i, '').trim()
}

// ============================================================
// [jul 2026, FASE 1.2] Jerarquía explícita de prioridad pedagógica,
// según decisión de producto y el enfoque histórico de la educación
// preescolar en México:
//   - Antes: la maestra decidía la planeación según su propio criterio.
//   - Después: se exigió partir de las necesidades reales del alumno.
//   - Ahora (NEM 2022): se exige combinar necesidad del alumno CON el
//     contexto donde vive — juntos, ambos hacen la planeación más
//     precisa para que el alumno desarrolle su potencial.
// Por eso el 1er orden de esta función combina DOS fuentes, no una:
// evaluación individual (necesidad) + diagnostico_escolar/PMC
// (contexto comunitario). El 2do orden son los PDAs que el directivo
// acordó para todo el jardín — complementario, el directivo puede
// pedir que TAMBIÉN se atiendan, pero nunca en lugar de lo detectado
// individualmente.
//
// No requiere consulta nueva a Supabase — profile ya llega completo
// desde el frontend (select('*') en users), así que evaluacion_
// individual, diagnostico_escolar y pdas_jardin ya viven en el objeto
// profile, igual que alumnos_inclusion.
//
// REQUISITO LEGAL — no etiquetar neurodivergencia: el texto que sale
// de aquí usa "Necesidad de apoyo:" en vez de "Alerta:", y nunca
// incluye diagnósticos ni etiquetas clínicas (esos datos ya vienen
// anonimizados desde analizar-evaluacion-individual, pero se refuerza
// aquí por seguridad). La regla R-SIN-ETIQUETAS en SYSTEM_PROMPT_DIAS
// refuerza esto también en la narrativa final.
//
// IMPORTANTE — alcance de este cambio: esta jerarquía calibra
// ÉNFASIS NARRATIVO dentro del proyecto ya definido por la educadora
// (quien elige el PDA principal en el formulario). NO decide qué PDA
// se selecciona — esa decisión ocurre antes, en el formulario o en
// /api/sugerir-campos (que también se actualizó para respetar esta
// misma jerarquía al sugerir transversales).
// ============================================================
function obtenerPrioridadesPedagogicas(profile: any): string {
  const evalInd = profile?.evaluacion_individual
  const pdasGrupo: string[] = Array.isArray(evalInd?.pdas_prioritarios_grupo)
    ? evalInd.pdas_prioritarios_grupo.map((p: any) => (typeof p === 'string' ? p : p?.pda)).filter(Boolean)
    : []
  const alertasCrudas: string[] = Array.isArray(evalInd?.alertas) ? evalInd.alertas : []
  const alertasSuaves = alertasCrudas.map(limpiarAlertaTono).filter(Boolean)

  const contextoSocial: string = profile?.diagnostico_escolar?.contexto_social || ''

  const pdasJardinRaw = profile?.pdas_jardin
  const pdasJardinLista = !Array.isArray(pdasJardinRaw) && Array.isArray(pdasJardinRaw?.pdas)
    ? pdasJardinRaw.pdas
    : (Array.isArray(pdasJardinRaw) ? pdasJardinRaw : [])
  const pdasJardinTexto: string[] = pdasJardinLista.map((p: any) => (typeof p === 'string' ? p : p?.pda)).filter(Boolean)

  if (pdasGrupo.length === 0 && alertasSuaves.length === 0 && !contextoSocial && pdasJardinTexto.length === 0) return ''

  let bloque = ''
  if (pdasGrupo.length > 0 || alertasSuaves.length > 0 || contextoSocial) {
    bloque += `1er orden — Necesidad del alumno + contexto comunitario (máxima prioridad; la NEM 2022 exige combinar ambos para una planeación precisa):\n`
    if (pdasGrupo.length > 0) bloque += pdasGrupo.map(p => `- Necesidad de aprendizaje detectada: ${p}`).join('\n') + '\n'
    if (alertasSuaves.length > 0) bloque += alertasSuaves.map(a => `- Necesidad de apoyo: ${a}`).join('\n') + '\n'
    if (contextoSocial) bloque += `- Contexto comunitario del grupo: ${contextoSocial}\n`
  }
  if (pdasJardinTexto.length > 0) {
    bloque += `\n2do orden — PDAs acordados por el colectivo del jardín (complementario, nunca sustituye al 1er orden):\n`
    bloque += pdasJardinTexto.slice(0, 8).map((p: string) => `- ${p}`).join('\n')
  }
  return bloque.trim()
}

async function generarLoteDeDias(params: {
  lote: DiaConMomento[]
  form: any
  profile: any
  transversalesTexto: string
  recursosTexto: string
  contextoPrevio: string
  materialesUsados: string[]
  trayectoriaPDA: string
  prioridadesPedagogicas: string
  esUltimoLote: boolean
}): Promise<DiaGenerado[]> {
  const { lote, form, profile, transversalesTexto, recursosTexto, contextoPrevio, materialesUsados, trayectoriaPDA, prioridadesPedagogicas, esUltimoLote } = params

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

TRAYECTORIA DEL GRUPO EN ESTE CICLO (PDAs que ya se han trabajado antes con este grupo, en otras planeaciones — úsalo SOLO como contexto de continuidad pedagógica real, para que el proyecto se sienta parte de la progresión del grupo y no aislado; NUNCA como instrucción de evitar mecánicamente estos temas ni de forzar mencionarlos):
${trayectoriaPDA || 'Aún no hay historial registrado — este es de los primeros proyectos con este grupo en el ciclo.'}

PRIORIDADES PEDAGÓGICAS DEL GRUPO (jerarquía explícita entre dos fuentes — úsala solo para calibrar énfasis narrativo DENTRO de las actividades del proyecto ya definido, NUNCA para cambiar el PDA principal ni el proyecto elegido): 
${prioridadesPedagogicas || 'No hay prioridades adicionales registradas para este grupo.'}
Si el 1er orden y el 2do orden coinciden con algo que ya estás narrando en algún día, dale mayor peso narrativo al 1er orden (evaluación individual). Si solo aparece el 2do orden (PDAs del jardín) sin relación con el 1er orden, trátalo como apoyo complementario menor, nunca como el foco de la actividad.

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

  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 8000,
    system: SYSTEM_PROMPT_DIAS,
    messages: [{ role: 'user', content: userMessage }],
  })

  const content = message.content[0].type === 'text' ? message.content[0].text : ''
  const parsed = parsearJSONRobusto(content)
  const dias = parsed.dias as DiaGenerado[]
  return dias.map(validarDiaCompleto)
}

async function generarRubricaYAjustes(params: {
  form: any
  profile: any
  todosLosDias: DiaGenerado[]
}): Promise<{ rubrica: any; ajustes_por_dia: AjusteDia[] }> {
  const { form, profile, todosLosDias } = params

  const resumenDias = todosLosDias.map(d =>
    `Día ${d.numero} (${d.momento_modalidad}): Inicio: ${d.inicio} Desarrollo: ${d.desarrollo} Cierre: ${d.cierre}`
  ).join('\n\n')

  const alumnosInclusionLista: { codigo: string; acciones?: string }[] = Array.isArray(profile.alumnos_inclusion)
    ? profile.alumnos_inclusion
    : []

  const alumnosInclusionTexto = alumnosInclusionLista.length > 0
    ? JSON.stringify(alumnosInclusionLista)
    : 'No hay alumnos con necesidades de inclusión registrados en este grupo.'

  const userMessage = `PDA principal a evaluar: ${form.pda_principal}
Campo formativo: ${form.campo_formativo}
Contenido: ${form.contenido}

ALUMNOS CON NECESIDADES DE INCLUSIÓN:
${alumnosInclusionTexto}

PLANEACIÓN COMPLETA YA GENERADA (el número de cada "Día" corresponde exactamente al número de día que verá la educadora en pantalla — usa ese mismo número en "ajustes_por_dia". Esta planeación tiene ${todosLosDias.length} días en total; recuerda generar una entrada por CADA alumno en TODOS los ${todosLosDias.length} días, cada una BREVE de 1-2 oraciones):
${resumenDias}

Genera la rúbrica basada en las instancias concretas donde el PDA fue ejecutado en la narrativa de arriba, y los ajustes razonables por día correspondientes — recuerda: todos los alumnos, todos los días, sin excepción, cada uno ligado a su propia necesidad concreta y breve.`

  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 8000,
    system: SYSTEM_PROMPT_CIERRE,
    messages: [{ role: 'user', content: userMessage }],
  })

  const content = message.content[0].type === 'text' ? message.content[0].text : ''
  const parsed = parsearJSONRobusto(content)
  const ajustesGenerados: AjusteDia[] = Array.isArray(parsed.ajustes_por_dia) ? parsed.ajustes_por_dia : []
  const ajustesCompletos = validarAjustesCompletos(ajustesGenerados, todosLosDias.length, alumnosInclusionLista)

  return {
    rubrica: parsed.rubrica,
    ajustes_por_dia: ajustesCompletos,
  }
}

export async function POST(request: NextRequest) {
  let supabaseAdmin: any = null
  let jobId: string | undefined = undefined

  try {
    const { form, profile, job_id } = await request.json()
    jobId = job_id

    const { createClient } = await import('@supabase/supabase-js')
    supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SECRET_KEY!
    )

    if (jobId) {
      await actualizarProgreso(supabaseAdmin, jobId, {
        fase_actual: 'Leyendo el calendario y el contexto de tu grupo...',
        estado: 'en_progreso',
      })
    }

    const estadoCodigo = (profile.cct_primary || '').slice(0, 2)
    const calDatos = await obtenerCalendarioEstatal(supabaseAdmin, estadoCodigo)

    // [jul 2026, FASE 1.1] Trayectoria pedagógica real del grupo — se
    // consulta una sola vez por generación completa (no por lote),
    // ya que no cambia entre lotes de la misma planeación.
    const trayectoriaPDA = await obtenerTrayectoriaPDA(supabaseAdmin, profile?.id)

    // [jul 2026, FASE 1.2] Jerarquía evaluación individual (1er orden)
    // vs PDAs del jardín (2do orden) — no requiere consulta a
    // Supabase, ya viene en el objeto profile.
    const prioridadesPedagogicas = obtenerPrioridadesPedagogicas(profile)

    const todosDias = calcularDiasHabiles(calDatos, form.fecha_inicio, form.fecha_fin)
    const diasHabiles = todosDias.filter(d => !d.esCTE && !d.motivo)
    const diasCTE = todosDias.filter(d => d.esCTE)
    const diasInhabiles = todosDias.filter(d => d.motivo && !d.esCTE)

    const config = MOMENTOS_MODALIDAD[form.metodologia] || MOMENTOS_MODALIDAD['Proyectos']
    const momentos = config.momentos
    const idxDesarrollo = config.desarrollo

    if (diasHabiles.length < momentos.length) {
      const diasExcluidos = todosDias.length - diasHabiles.length
      let msg = `Tu periodo solo tiene ${diasHabiles.length} día(s) hábil(es) dentro del ciclo escolar activo, pero la modalidad "${form.metodologia}" necesita mínimo ${momentos.length} día(s) — uno por cada fase (${momentos.join(', ')}). Ajusta las fechas para que abarquen más días hábiles dentro del ciclo, o elige una modalidad con menos fases.`
      if (diasExcluidos > 0) {
        msg += ` (De los días que elegiste, ${diasExcluidos} cayeron fuera del ciclo escolar o son inhábiles/CTE.)`
      }
      if (jobId) {
        await actualizarProgreso(supabaseAdmin, jobId, {
          estado: 'error',
          error_mensaje: msg,
          fase_actual: 'No hay suficientes días hábiles para esta modalidad.',
        })
      }
      return NextResponse.json({ error: msg }, { status: 400 })
    }

    const diasFijos = momentos.length - 1
    const diasDesarrollo = Math.max(1, diasHabiles.length - diasFijos)

    let diaIdx = 0
    const distribucion: { momento: string; dias: DiaHabil[] }[] = []
    for (let i = 0; i < momentos.length; i++) {
      if (i === idxDesarrollo) {
        distribucion.push({ momento: momentos[i], dias: diasHabiles.slice(diaIdx, diaIdx + diasDesarrollo) })
        diaIdx += diasDesarrollo
      } else {
        distribucion.push({ momento: momentos[i], dias: diasHabiles.slice(diaIdx, diaIdx + 1) })
        diaIdx += 1
      }
    }

    let numeroGlobal = 1
    const diasConMomento: DiaConMomento[] = []
    for (const seg of distribucion) {
      for (const d of seg.dias) {
        diasConMomento.push({ ...d, momento: seg.momento, numeroGlobal: numeroGlobal++ })
      }
    }

    const lotes: DiaConMomento[][] = []
    {
      let i = 0
      while (i < diasConMomento.length) {
        const momentoActual = diasConMomento[i].momento
        const lote: DiaConMomento[] = []
        while (
          i < diasConMomento.length &&
          diasConMomento[i].momento === momentoActual &&
          lote.length < MAX_DIAS_POR_LOTE
        ) {
          lote.push(diasConMomento[i])
          i++
        }
        lotes.push(lote)
      }
    }

    const lotesMomentos: string[] = lotes.map(lote => lote[0]?.momento || '')

    if (jobId) {
      await actualizarProgreso(supabaseAdmin, jobId, {
        total_lotes: lotes.length + 1,
        lotes_completados: 0,
        fase_actual: `Preparando ${diasHabiles.length} días de tu planeación...`,
        fases_lotes: lotesMomentos,
      })
    }

    const transversalesTexto = form.transversales?.length > 0
      ? form.transversales.map((t: any, i: number) => `Transversal ${i+1}: ${t.campo} > ${t.contenido}\nPDA: ${t.pda}`).join('\n\n')
      : 'No se definieron campos transversales.'

    const recursosTexto = form.recursos_materiales
      ? `RECURSOS INDICADOS POR LA DIRECTORA: ${form.recursos_materiales} — integrarlos en al menos una actividad.`
      : ''

    let todasLasDiasGeneradas: DiaGenerado[] = []
    let contextoPrevio = ''
    let materialesUsados: string[] = []
    let loteNum = 0

    for (const lote of lotes) {
      loteNum++
      const esUltimoLote = loteNum === lotes.length
      const primerDia = lote[0]?.numeroGlobal || 1
      const ultimoDia = lote[lote.length - 1]?.numeroGlobal || primerDia

      if (jobId) {
        await actualizarProgreso(supabaseAdmin, jobId, {
          fase_actual: lotes.length > 1
            ? `Escribiendo los días ${primerDia} al ${ultimoDia} de ${diasHabiles.length}...`
            : `Escribiendo tu planeación completa...`,
        })
      }

      const diasGeneradosLote = await generarLoteDeDias({
        lote,
        form,
        profile,
        transversalesTexto,
        recursosTexto,
        contextoPrevio,
        materialesUsados,
        trayectoriaPDA,
        prioridadesPedagogicas,
        esUltimoLote,
      })

      todasLasDiasGeneradas.push(...diasGeneradosLote)

      const ultimoDiaGenerado = diasGeneradosLote[diasGeneradosLote.length - 1]
      if (ultimoDiaGenerado) {
        contextoPrevio = `En el día anterior (${ultimoDiaGenerado.momento_modalidad}), el cierre fue: "${ultimoDiaGenerado.cierre}"`
        const nuevosMateriales = (ultimoDiaGenerado.materiales || '')
          .split('|')
          .map(m => m.trim())
          .filter(Boolean)
        materialesUsados.push(...nuevosMateriales)
      }

      if (jobId) {
        await actualizarProgreso(supabaseAdmin, jobId, { lotes_completados: loteNum })
      }
    }

    todasLasDiasGeneradas = todasLasDiasGeneradas.map((dia, i) => ({ ...dia, numero: i + 1 }))

    if (jobId) {
      await actualizarProgreso(supabaseAdmin, jobId, {
        fase_actual: 'Construyendo tu rúbrica de evaluación...',
      })
    }

    const { rubrica, ajustes_por_dia } = await generarRubricaYAjustes({
      form,
      profile,
      todosLosDias: todasLasDiasGeneradas,
    })

    if (jobId) {
      await actualizarProgreso(supabaseAdmin, jobId, {
        lotes_completados: lotes.length + 1,
        fase_actual: '¡Tu planeación está lista!',
        estado: 'completado',
      })
    }

    const diasFinal = todasLasDiasGeneradas.map((dia, i) => ({
      ...dia,
      numero: i + 1,
      fecha: diasHabiles[i]?.label || '',
      fecha_iso: diasHabiles[i]?.fecha || '',
    }))

    const planeacion: any = {
      dias: diasFinal,
      rubrica,
      ajustes_por_dia,
    }

    planeacion.dias_especiales = [
      ...diasCTE.map(d => ({ fecha: d.label, fecha_iso: d.fecha, tipo: 'CTE' })),
      ...diasInhabiles.map(d => ({ fecha: d.label, fecha_iso: d.fecha, tipo: d.motivo || 'Inhábil' }))
    ].sort((a, b) => a.fecha_iso.localeCompare(b.fecha_iso))

    return NextResponse.json({ planeacion })

  } catch (error: unknown) {
    console.error('Error en Agente NEM:', error)
    const msg = error instanceof Error ? error.message : String(error)
    if (supabaseAdmin && jobId) {
      await actualizarProgreso(supabaseAdmin, jobId, {
        estado: 'error',
        error_mensaje: msg,
        fase_actual: 'Ocurrió un error al generar tu planeación.',
      })
    }
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}