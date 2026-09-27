import { obtenerSchoolYearId } from '@/lib/schoolYear'
import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { obtenerCalendarioEstatal, calcularDiasHabiles, type DiaHabil, CICLO_ESCOLAR_ACTIVO } from '@/lib/calendarioEscolar'
import { verificarUsuario } from '@/lib/verificarUsuario'
import { fechaLocalISO, zonaHorariaPorCCT } from '@/lib/fechaMexico'
const client = new Anthropic()

const MODEL = process.env.CLAUDE_SONNET_MODEL || 'claude-sonnet-4-6'

// [sep 2026] Tarifas de Sonnet 4.6, USD por millón de tokens — verificar
// contra platform.claude.com/docs/en/about-claude/pricing si cambian.
const PRECIO_INPUT_POR_MILLON = 3.00
const PRECIO_OUTPUT_POR_MILLON = 15.00
const PRECIO_CACHE_READ_POR_MILLON = 0.30
const PRECIO_CACHE_WRITE_POR_MILLON = 3.75

// Acumulador de costo real en USD, creado nuevo en cada POST (nunca a
// nivel de módulo) para que peticiones concurrentes de distintas
// educadoras nunca mezclen su costo entre sí.
type AcumuladorCosto = { total: number }

function sumarCostoLlamada(acumulador: AcumuladorCosto, usage: Anthropic.Messages.Usage) {
  const costo =
    (usage.input_tokens / 1_000_000) * PRECIO_INPUT_POR_MILLON +
    (usage.output_tokens / 1_000_000) * PRECIO_OUTPUT_POR_MILLON +
    ((usage.cache_read_input_tokens || 0) / 1_000_000) * PRECIO_CACHE_READ_POR_MILLON +
    ((usage.cache_creation_input_tokens || 0) / 1_000_000) * PRECIO_CACHE_WRITE_POR_MILLON
  acumulador.total += costo
}

const MAX_DIAS_POR_LOTE = 2

const MOMENTOS_MODALIDAD: Record<string, { momentos: string[]; desarrollo: number }> = {
  'Proyectos': { momentos: ['Punto de partida', 'Planeación', '¡A trabajar!', 'Comunicamos nuestros logros', 'Reflexionar sobre el aprendizaje'], desarrollo: 2 },
  'ABJ': { momentos: ['Planteamiento del juego', 'Desarrollo de las actividades', 'Compartimos la experiencia', 'Comunidad de juego'], desarrollo: 1 },
  'Taller crítico': { momentos: ['Situación inicial', 'Puesta en marcha', 'Valoramos lo aprendido', 'Reflexión'], desarrollo: 1 },
  'Rincones': { momentos: ['Asamblea inicial y planeación', 'Exploración de los rincones', 'Compartimos lo aprendido', 'Reflexión sobre el aprendizaje'], desarrollo: 1 },
  'Centros de interés': { momentos: ['Contacto con la realidad', 'Identificación e integración', 'Expresión'], desarrollo: 1 },
  'Unidad didáctica': { momentos: ['Lectura de la realidad', 'Identificación de la trama y complejidad', 'Planificación y organización', 'Exploración y descubrimiento', 'Participación activa y horizontal', 'Valoración de la experiencia'], desarrollo: 2 },
}

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
R6: Cada campo tiene un límite de caracteres estricto (se recorta automáticamente si te excedes, así que respétalo desde el inicio): "inicio" 550-600 caracteres, "desarrollo" 1000-1100 caracteres, "cierre" 450-500 caracteres, "actividad_complementaria" 250-300 caracteres, "materiales" 250-300 caracteres. Escribe oraciones completas que naturalmente terminen cerca de ese límite — no cuentes caracteres mientras escribes, pero mantente dentro del rango.
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

const SYSTEM_PROMPT_CIERRE = `Eres el Agente de Evaluación de PlanIA Digital. Recibes una planeación didáctica completa ya generada (todos los días) y produces el instrumento de evaluación y los ajustes razonables.

REGLA CRÍTICA — R4-PDA:
El instrumento NUNCA se construye desde el PDA abstracto. Debes identificar las instancias CONCRETAS dentro de la narrativa de los días donde la acción del PDA principal fue ejecutada, y evaluar la calidad de esa ejecución. Ciclo: PDA define → narrativa ejecuta → instrumento evalúa. Si el PDA principal tiene más de un verbo de acción, el instrumento debe evaluar AMBOS verbos, no solo el más presente en la narrativa.

REGLA CRÍTICA — EL "CRITERIO" ES UNA ETIQUETA CORTA, NO UNA ORACIÓN:
El campo "criterio" es un título breve (4-8 palabras) que nombra la habilidad observable evaluada — no una oración completa ni una descripción. Ejemplo correcto: "Identificación de eventos y celebraciones". Ejemplo incorrecto: "El alumno identifica y nombra por sí mismo diversas celebraciones de su comunidad".

REGLA CRÍTICA — EL "INDICADOR" ES LA CONDUCTA OBSERVABLE DEL PDA EN ESTE PROYECTO:
El campo "indicador" es UNA sola oración (100-180 caracteres) que nombra la conducta concreta y observable que la educadora debe mirar en los niños para saber que este PDA se está logrando en ESTE proyecto. Redáctalo en presente, tercera persona, sin sujeto explícito, iniciando con un verbo de acción observable (ej. 'Nombra...', 'Explica...', 'Separa...'). Debe anclarse a las actividades reales de la narrativa (materiales, situaciones, consignas concretas), nunca copiar ni parafrasear el PDA literal. Es distinto del "criterio" (etiqueta corta que titula la rúbrica) y de los descriptores de nivel (que gradúan el desempeño): el indicador no gradúa, solo nombra qué observar. MAL (paráfrasis del PDA): 'Distingue alimentos y bebidas saludables de los que ponen en riesgo la salud'. BIEN (anclado al proyecto): 'Separa los alimentos del mercadito en los que le dan energía y los que le caen pesado, y explica con sus palabras por qué eligió cada uno'.

REGLA CRÍTICA — LOS 3 NIVELES SON DESCRIPTORES DE DESEMPEÑO OBSERVABLE, EN ORDEN FIJO:
Siempre exactamente 3 niveles, en este orden y con estas etiquetas exactas: "Logrado", "En proceso", "Requiere apoyo". Cada descriptor debe redactarse en tercera persona ("Identifica y nombra por sí mismo...", "Requiere apoyo constante del docente para...") y basarse en las instancias reales de la narrativa de arriba — nunca en el PDA abstracto ni en una plantilla genérica.

REGLA CRÍTICA — LONGITUD Y FORMA DEL DESCRIPTOR (NO OPCIONAL):
Cada descriptor es UNA a DOS oraciones, máximo. Sintetiza el PATRÓN GENERAL de desempeño que viste repetirse en la narrativa — nunca enumeres instancia por instancia ni menciones "Día 1", "Día 2", etc. PROHIBIDO construir el descriptor como una bitácora o resumen cronológico de la planeación. MAL (prohibido, formato bitácora): "El alumno nombra la emoción en el ejercicio de espejo (Día 1); construye acuerdos (Día 2); identifica la zona corporal (Día 3)...". BIEN (correcto, patrón sintetizado): "Identifica y nombra por sí mismo las emociones propias y ajenas, y ofrece ayuda concreta a un compañero sin necesitar que el docente se lo indique". Usa la narrativa de los días solo como evidencia interna para decidir QUÉ tan alto es el nivel de logro — el texto final del descriptor debe leerse como el mismo tipo de frase breve y general que usarías para describir la rúbrica de cualquier otro PDA, sin importar cuántos días tuvo la planeación.

REGLA CRÍTICA — AJUSTES RAZONABLES POR DÍA, NORMATIVA SEP (NO OPCIONAL):
Si se te proporciona una lista de alumnos con necesidades de inclusión, la atención a CADA UNO de ellos debe aparecer en TODOS Y CADA UNO de los días hábiles de la planeación, sin excepción — la inclusión no es opcional ni depende de tu criterio sobre si "amerita" ese día. Genera UNA entrada por cada alumno en cada día, ligada siempre a la actividad CONCRETA de ese día (el material real, el momento exacto, la consigna que ya está escrita en la narrativa de ese día específico) — nunca genérica, nunca repetida textualmente entre días, pero SIEMPRE presente. Redacta cada ajuste basándote en el texto de "acciones" de cada alumno, que describe su necesidad real y concreta — alumnos distintos con necesidades distintas deben producir ajustes claramente distintos en contenido y enfoque. Usa SIEMPRE el código del alumno (nunca un diagnóstico ni una etiqueta clínica) y comienza cada ajuste con "Código.- " (ej. "R.G.-1.- "). CADA AJUSTE DEBE SER BREVE: 300-400 caracteres (aprox. 1-2 oraciones) — no un párrafo largo, ya que en planeaciones con muchos días y varios alumnos el volumen total crece rápido y debe mantenerse manejable. Este límite se aplica automáticamente después si te excedes, pero respétalo desde el inicio. Si hay 2 alumnos y 5 días, debes producir 10 entradas en total (2 por día), no menos. Si NO hay alumnos con necesidades de inclusión registrados, responde con un arreglo vacío en "ajustes_por_dia".

REGLA CRÍTICA — FORMATO JSON: Cada valor de texto debe ser una SOLA cadena continua, sin saltos de línea reales dentro de ella. PROHIBIDO usar comillas dobles (") dentro del texto — usa SIEMPRE comillas simples (') para diálogos o énfasis.

FORMATO DE SALIDA — CRÍTICO:
Responde ÚNICAMENTE con JSON válido. Sin markdown. Sin explicaciones.

{
  "instrumento_evaluacion": {
    "tipo": "rubrica_escala_estimativa",
    "campo": "nombre del campo formativo principal",
    "contenido": "contenido del campo principal",
    "pda": "pda literal",
    "indicador": "una oración de conducta observable anclada al proyecto, 100-180 caracteres",
    "criterio": "etiqueta corta de 4-8 palabras",
    "niveles": [
      { "etiqueta": "Logrado", "descriptor": "El alumno..." },
      { "etiqueta": "En proceso", "descriptor": "El alumno..." },
      { "etiqueta": "Requiere apoyo", "descriptor": "El alumno..." }
    ]
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

// Límites de caracteres por campo -- deben coincidir con las cifras que le
// pedimos al modelo en R6 (SYSTEM_PROMPT_DIAS) y en SYSTEM_PROMPT_CIERRE.
// Esto es la RED DE SEGURIDAD: el modelo casi siempre respeta el rango
// pedido en el prompt, pero los LLM no son 100% precisos con conteos
// exactos -- si se excede, se recorta aquí antes de guardar la planeación.
const LIMITES_CARACTERES: Partial<Record<keyof DiaGenerado, number>> = {
  inicio: 600,
  desarrollo: 1100,
  cierre: 500,
  actividad_complementaria: 300,
  materiales: 300,
}
const LIMITE_AJUSTE = 400

// Recorta al punto/exclamación/pregunta más cercano ANTES del límite, nunca
// a media palabra. Si no hay un cierre de oración razonable cerca (más de
// la mitad del límite), recorta a la última palabra completa en su lugar.
function recortarAlLimite(texto: string, limite: number): string {
  if (!texto || texto.length <= limite) return texto
  const cortado = texto.slice(0, limite)
  const ultimoCierre = Math.max(
    cortado.lastIndexOf('.'),
    cortado.lastIndexOf('!'),
    cortado.lastIndexOf('?')
  )
  if (ultimoCierre > limite * 0.5) {
    return cortado.slice(0, ultimoCierre + 1)
  }
  const ultimoEspacio = cortado.lastIndexOf(' ')
  const base = ultimoEspacio > 0 ? cortado.slice(0, ultimoEspacio) : cortado
  return base.trim() + '...'
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

  // Red de seguridad: recorta cualquier campo que se haya excedido del límite
  for (const campo of Object.keys(LIMITES_CARACTERES) as (keyof DiaGenerado)[]) {
    const limite = LIMITES_CARACTERES[campo]
    const valor = dia[campo]
    if (limite && valor && String(valor).length > limite) {
      console.error(`✂️ RECORTE AUTOMÁTICO — día ${dia.numero}, campo "${campo}" vino con ${String(valor).length} caracteres (límite ${limite}), se recortó.`)
      ;(dia as any)[campo] = recortarAlLimite(String(valor), limite)
    }
  }

  return dia
}

function validarAjustesCompletos(
  ajustes: AjusteDia[],
  totalDias: number,
  alumnosInclusion: { codigo: string }[]
): AjusteDia[] {
  // Red de seguridad: recorta cualquier ajuste que se haya excedido del límite
  for (const a of ajustes) {
    if (a.ajuste && a.ajuste.length > LIMITE_AJUSTE) {
      console.error(`✂️ RECORTE AUTOMÁTICO — ajuste día ${a.numero}, código "${a.codigo}" vino con ${a.ajuste.length} caracteres (límite ${LIMITE_AJUSTE}), se recortó.`)
      a.ajuste = recortarAlLimite(a.ajuste, LIMITE_AJUSTE)
    }
  }
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

async function obtenerTrayectoriaPDA(supabaseAdmin: any, userId: string): Promise<string> {
  if (!userId) return ''
  try {
        const { data, error } = await supabaseAdmin
      .from('pda_coverage_avanzada')
      .select('campo, contenido, pda_literal, is_primary, covered_on, times_used')
      .eq('user_id', userId)
      .eq('ciclo_escolar', CICLO_ESCOLAR_ACTIVO)
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

// [Saneado 27 sep 2026 — Fase 1, NEE] Grupo del ciclo activo desde
// alumnos_codigo (un solo código AL-XX por niño; se retiran las
// iniciales de users.alumnos_inclusion).
//   roster    → lista para rúbricas, en orden de código, con las marcas
//               "(baja)" y "(alta 15 oct)" (criterio del fundador).
//   conApoyos → alumnos ACTIVOS con apoyos CONFIRMADOS por la educadora
//               (misma forma { codigo, acciones } que espera el prompt).
type GrupoAlumnos = { roster: string[]; conApoyos: { codigo: string; acciones: string }[] }

function numeroCodigoAlumno(codigo: string): number {
  const m = String(codigo || '').match(/^AL-(\d+)$/)
  return m ? parseInt(m[1], 10) : 0
}

async function obtenerGrupoAlumnos(supabaseAdmin: any, userId: string): Promise<GrupoAlumnos> {
  const vacio: GrupoAlumnos = { roster: [], conApoyos: [] }
  if (!userId) return vacio
  try {
    const { data, error } = await supabaseAdmin
      .from('alumnos_codigo')
      .select('codigo, activo, fecha_alta, requiere_apoyos, apoyos')
      .eq('user_id', userId)
      .eq('ciclo_escolar', CICLO_ESCOLAR_ACTIVO)

    if (error || !data) return vacio
    const todos = [...data].sort((a: any, b: any) => numeroCodigoAlumno(a.codigo) - numeroCodigoAlumno(b.codigo))
    const inicioGrupo: string | null = todos.reduce(
      (min: string | null, a: any) => (!min || a.fecha_alta < min ? a.fecha_alta : min),
      null
    )
    const roster = todos.map((a: any) => {
      if (!a.activo) return `${a.codigo} (baja)`
      if (inicioGrupo && a.fecha_alta > inicioGrupo) {
        const fecha = new Date(a.fecha_alta + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })
        return `${a.codigo} (alta ${fecha})`
      }
      return a.codigo
    })
    const conApoyos = todos
      .filter((a: any) => a.activo && a.requiere_apoyos && typeof a.apoyos === 'string' && a.apoyos.trim())
      .map((a: any) => ({ codigo: a.codigo, acciones: a.apoyos.trim() }))
    return { roster, conApoyos }
  } catch (e) {
    console.error('No se pudo obtener el grupo de alumnos (no crítico):', e)
    return vacio
  }
}

function limpiarAlertaTono(texto: string): string {
  return texto.replace(/^(CR[IÍ]TICO|URGENTE|ALERTA)\s*[:\-]?\s*/i, '').trim()
}

function obtenerPrioridadesPedagogicas(profile: any): string {
  const evalInd = profile?.evaluacion_individual
  const pdasGrupo: string[] = Array.isArray(evalInd?.pdas_prioritarios_grupo)
    ? evalInd.pdas_prioritarios_grupo.map((p: any) => (typeof p === 'string' ? p : p?.pda)).filter(Boolean)
    : []
  const alertasCrudas: string[] = Array.isArray(evalInd?.alertas) ? evalInd.alertas : []
  const alertasSuaves = alertasCrudas.map(limpiarAlertaTono).filter(Boolean)

  const pdasDiagnosticoGrupal: string[] = Array.isArray(profile?.pdas_prioritarios)
    ? profile.pdas_prioritarios.map((p: any) => {
        const texto = typeof p === 'string' ? p : p?.pda
        const justificacion = typeof p === 'object' ? p?.justificacion : ''
        return texto ? (justificacion ? `${texto} (${justificacion})` : texto) : ''
      }).filter(Boolean)
    : []

  const contextoSocial: string = profile?.diagnostico_escolar?.contexto_social || ''

  const pdasJardinRaw = profile?.pdas_jardin
  const pdasJardinLista = !Array.isArray(pdasJardinRaw) && Array.isArray(pdasJardinRaw?.pdas)
    ? pdasJardinRaw.pdas
    : (Array.isArray(pdasJardinRaw) ? pdasJardinRaw : [])
  const pdasJardinTexto: string[] = pdasJardinLista.map((p: any) => (typeof p === 'string' ? p : p?.pda)).filter(Boolean)

  if (pdasGrupo.length === 0 && alertasSuaves.length === 0 && pdasDiagnosticoGrupal.length === 0 && !contextoSocial && pdasJardinTexto.length === 0) return ''

  let bloque = ''
  if (pdasGrupo.length > 0 || alertasSuaves.length > 0 || pdasDiagnosticoGrupal.length > 0 || contextoSocial) {
    bloque += `1er orden — Necesidad del alumno + contexto comunitario (máxima prioridad; la NEM 2022 exige combinar ambos para una planeación precisa):\n`
    if (pdasGrupo.length > 0) bloque += pdasGrupo.map(p => `- Necesidad de aprendizaje detectada (evaluación individual): ${p}`).join('\n') + '\n'
    if (alertasSuaves.length > 0) bloque += alertasSuaves.map(a => `- Necesidad de apoyo: ${a}`).join('\n') + '\n'
    if (pdasDiagnosticoGrupal.length > 0) bloque += pdasDiagnosticoGrupal.map(p => `- Prioridad del diagnóstico grupal: ${p}`).join('\n') + '\n'
    if (contextoSocial) bloque += `- Contexto comunitario del grupo: ${contextoSocial}\n`
  }
  if (pdasJardinTexto.length > 0) {
    bloque += `\n2do orden — PDAs acordados por el colectivo del jardín (complementario, nunca sustituye al 1er orden):\n`
    bloque += pdasJardinTexto.slice(0, 8).map((p: string) => `- ${p}`).join('\n')
  }
  return bloque.trim()
}

function obtenerRetroalimentacionDireccion(profile: any): string {
  const obs = profile?.observaciones_directivo
  if (!obs) return ''
  const instruccion: string = obs.instruccion_para_agente || ''
  const aspectosFuertes: string[] = Array.isArray(obs.aspectos_fuertes) ? obs.aspectos_fuertes : []
  if (!instruccion && aspectosFuertes.length === 0) return ''
  let texto = instruccion ? instruccion.trim() : ''
  if (aspectosFuertes.length > 0) {
    texto += (texto ? '\n' : '') + `Aspectos que ya funcionan bien y conviene mantener: ${aspectosFuertes.join(', ')}.`
  }
  return texto
}

function obtenerEstiloNarrativo(profile: any): string {
  const estilo = profile?.estilo_narrativo
  if (!estilo) return ''
  const instruccion: string = estilo.instruccion_para_agente || ''
  if (instruccion) return instruccion.trim()
  const partes: string[] = []
  if (estilo.tono) partes.push(`Tono: ${estilo.tono}`)
  if (estilo.vocabulario) partes.push(`Vocabulario: ${estilo.vocabulario}`)
  if (Array.isArray(estilo.caracteristicas) && estilo.caracteristicas.length > 0) {
    partes.push(`Características: ${estilo.caracteristicas.join(', ')}`)
  }
  return partes.join(' | ')
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

async function generarAjustesPorDia(params: {
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
const SYSTEM_PROMPT_EJE = `Eres el Agente de Vinculación Curricular de PlanIA Digital. Recibes un eje articulador y una planeación didáctica completa ya generada, y redactas una descripción breve de cómo ESE PROYECTO ESPECÍFICO favorece ese eje articulador a través de sus actividades reales.

REGLA CRÍTICA: La descripción debe basarse en las actividades CONCRETAS que ya ocurren en la narrativa de los días — nunca una definición genérica del eje articulador. Ejemplo MAL (genérico): "Este eje promueve la inclusión de todos los alumnos en el aula". Ejemplo BIEN (concreto, anclado al proyecto real): "A través de la Botella de la Calma y las adecuaciones diseñadas para cada alumno, el proyecto garantiza que cada niño participe de la autorregulación emocional según su propio ritmo y necesidad."

REGLA CRÍTICA — LONGITUD: 250 a 300 caracteres, 1-2 oraciones. Sin comillas dobles dentro del texto — usa comillas simples si necesitas énfasis.

FORMATO DE SALIDA — CRÍTICO: Responde ÚNICAMENTE con el texto de la descripción. Sin JSON, sin markdown, sin comillas envolventes, sin explicaciones.`

const SYSTEM_PROMPT_EVALUACION_FORMATIVA = `Eres el Agente de Evaluación Formativa de PlanIA Digital. Recibes una planeación didáctica completa ya generada y redactas una descripción breve de CÓMO esta planeación aborda la evaluación formativa a lo largo del proyecto, y cómo eso beneficia a los alumnos.

REGLA CRÍTICA: Basa la descripción en los mecanismos reales presentes en la planeación (observación durante las actividades, preguntas detonadoras, la rúbrica/escala estimativa por PDA, los ajustes razonables por alumno) — no una definición genérica de "evaluación formativa".

REGLA CRÍTICA — LONGITUD: 250 a 300 caracteres, 1-2 oraciones. Sin comillas dobles dentro del texto.

FORMATO DE SALIDA — CRÍTICO: Responde ÚNICAMENTE con el texto de la descripción. Sin JSON, sin markdown, sin explicaciones.`

const LIMITE_DESCRIPCION_CIERRE = 300

async function generarDescripcionEje(params: {
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

async function generarDescripcionEvaluacionFormativa(params: {
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
async function generarUnaRubrica(params: {
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
export const maxDuration = 700;
export async function POST(request: NextRequest) {
  let supabaseAdmin: any = null
  let jobId: string | undefined = undefined
  const acumuladorCosto: AcumuladorCosto = { total: 0 }

  try {
        // [sep 2026, saneamiento Fase 0] Identidad verificada en el SERVIDOR.
    // Antes el navegador mandaba el `profile` completo y se le creía todo
    // (incluido profile.id, usado como user_id al guardar). Ahora el
    // navegador solo manda el formulario + su token de sesión; el perfil
    // se lee de la base de datos con el id VERIFICADO, y se revisa la
    // membresía ANTES de gastar un solo token de Anthropic.
    const auth = await verificarUsuario(request)
    if (!auth.autorizado) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }
    supabaseAdmin = auth.supabaseAdmin

    const { data: profile, error: errorPerfil } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', auth.usuario.id)
      .single()
    if (errorPerfil || !profile) {
      return NextResponse.json({ error: 'No se encontró tu perfil.' }, { status: 403 })
    }

    const MEMBRESIAS_CON_ACCESO = ['trial', 'active', 'founder']
    if (!MEMBRESIAS_CON_ACCESO.includes(profile.membership_status)) {
      return NextResponse.json(
        { error: 'Tu membresía no está activa. Puedes seguir consultando y descargando tus planeaciones anteriores; para generar nuevas, renueva tu membresía.' },
        { status: 403 }
      )
    }

    const { form, job_id } = await request.json()
    jobId = job_id

    // [sep 2026, saneamiento Fase 0] Regla de negocio: solo se puede planear
    // desde el INICIO del ciclo de membresía actual (v_estado_cuenta.ciclo_inicio),
    // nunca antes. Se revisa ANTES de cualquier llamada a Anthropic. Si la
    // consulta falla, se bloquea (500); si ciclo_inicio viene vacío, la fecha
    // mínima es hoy — misma regla de respaldo que la pantalla. Las fechas se
    // comparan como YYYY-MM-DD en la zona horaria del CCT (lib/fechaMexico.ts).
    const zonaHoraria = zonaHorariaPorCCT(profile.cct_primary)
    const { data: estadoCuenta, error: errorEstadoCuenta } = await supabaseAdmin
      .from('v_estado_cuenta')
      .select('ciclo_inicio')
      .eq('auth_uid', profile.auth_uid)
      .single()
    if (errorEstadoCuenta || !estadoCuenta) {
      const msg = 'No se pudo verificar tu ciclo de membresía. Intenta de nuevo en un momento.'
      await actualizarProgreso(supabaseAdmin, jobId, {
        estado: 'error',
        error_mensaje: msg,
        fase_actual: 'No se pudo verificar tu ciclo de membresía.',
      })
      return NextResponse.json({ error: msg }, { status: 500 })
    }
    const fechaMinimaPlaneacion =
      fechaLocalISO(estadoCuenta.ciclo_inicio, zonaHoraria) || fechaLocalISO(new Date(), zonaHoraria)
    const fechaInicioPlaneacion = fechaLocalISO(form?.fecha_inicio, zonaHoraria)
    if (!fechaInicioPlaneacion || !fechaMinimaPlaneacion || fechaInicioPlaneacion < fechaMinimaPlaneacion) {
      const msg = 'Solo puedes planear desde el inicio de tu ciclo de membresía actual.'
      await actualizarProgreso(supabaseAdmin, jobId, {
        estado: 'error',
        error_mensaje: msg,
        fase_actual: msg,
      })
      return NextResponse.json({ error: msg }, { status: 400 })
    }

    if (jobId) {
      await actualizarProgreso(supabaseAdmin, jobId, {
        fase_actual: 'Leyendo el calendario y el contexto de tu grupo...',
        estado: 'en_progreso',
      })
    }

    const estadoCodigo = (profile.cct_primary || '').slice(0, 2)
    const calDatos = await obtenerCalendarioEstatal(supabaseAdmin, estadoCodigo, CICLO_ESCOLAR_ACTIVO)

    const trayectoriaPDA = await obtenerTrayectoriaPDA(supabaseAdmin, profile?.id)
    const prioridadesPedagogicas = obtenerPrioridadesPedagogicas(profile)
    const retroalimentacionDireccion = obtenerRetroalimentacionDireccion(profile)
    const estiloNarrativo = obtenerEstiloNarrativo(profile)

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
        const lote: DiaConMomento[] = []
        while (i < diasConMomento.length && lote.length < MAX_DIAS_POR_LOTE) {
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
        retroalimentacionDireccion,
        estiloNarrativo,
        esUltimoLote,
        acumuladorCosto,
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

            // [sep 2026] Arma la lista de PDAs activos ANTES de lanzar las llamadas
    // en paralelo — la necesita el bloque de rúbricas de abajo.
    const pdasActivos: { pdaTexto: string; campoFormativo: string; contenido: string; esPrincipal: boolean }[] = [
      { pdaTexto: form.pda_principal, campoFormativo: form.campo_formativo, contenido: form.contenido, esPrincipal: true },
    ]
    if (form.pda_principal_2) {
      pdasActivos.push({
        pdaTexto: form.pda_principal_2,
        campoFormativo: form.campo_formativo,
        contenido: form.pda_principal_2_contenido || form.contenido,
        esPrincipal: true,
      })
    }
    if (form.transversales?.length > 0) {
      for (const t of form.transversales) {
        pdasActivos.push({ pdaTexto: t.pda, campoFormativo: t.campo, contenido: t.contenido, esPrincipal: false })
      }
    }
    const ejesTexto = [form.eje_principal, form.eje_secundario].filter(Boolean)

    if (jobId) {
      await actualizarProgreso(supabaseAdmin, jobId, {
        fase_actual: pdasActivos.length > 1
          ? 'Construyendo tus rúbricas y la evaluación formativa...'
          : 'Construyendo tu rúbrica y la evaluación formativa...',
      })
    }

    // [sep 2026, Opción A — paralelización] Ajustes por día, cada rúbrica,
    // cada descripción de eje, y la evaluación formativa NO dependen unas
    // de otras — todas solo necesitan la narrativa ya generada
    // (todasLasDiasGeneradas). Antes corrían una tras otra (for...await),
    // sumando varios minutos completos en planeaciones con varios PDA o
    // ejes. Lanzarlas juntas con Promise.all reduce el tiempo total al de
    // la llamada MÁS LENTA del grupo, no a la suma de todas ellas. Los
    // lotes de días (arriba, generarLoteDeDias) siguen siendo secuenciales
    // a propósito — necesitan el contexto del lote anterior para dar
    // continuidad narrativa; eso no se puede paralelizar sin sacrificar
    // calidad, así que esa parte del tiempo total sigue siendo irreducible.
    const grupoAlumnos = await obtenerGrupoAlumnos(supabaseAdmin, profile.id)
    const [ajustes_por_dia, rubricas, ejesFinal, evaluacionFormativa] = await Promise.all([
      generarAjustesPorDia({
        alumnosConApoyos: grupoAlumnos.conApoyos,
        todosLosDias: todasLasDiasGeneradas,
        acumuladorCosto,
      }),
      Promise.all(pdasActivos.map(async (p) => {
        const instrumento = await generarUnaRubrica({
          pdaTexto: p.pdaTexto,
          campoFormativo: p.campoFormativo,
          contenido: p.contenido,
          todosLosDias: todasLasDiasGeneradas,
          acumuladorCosto,
        })
        return { ...instrumento, pda_evaluado: p.pdaTexto, es_principal: p.esPrincipal }
      })),
      Promise.all(ejesTexto.map(async (ejeNombre) => {
        const descripcion = await generarDescripcionEje({
          ejeNombre,
          proyecto: form,
          todosLosDias: todasLasDiasGeneradas,
          acumuladorCosto,
        })
        return { nombre: ejeNombre, descripcion }
      })),
      generarDescripcionEvaluacionFormativa({
        proyecto: form,
        todosLosDias: todasLasDiasGeneradas,
        acumuladorCosto,
      }),
    ])
    const rosterCompleto = grupoAlumnos.roster

    const rubricasConRegistro = rubricas.map(r => ({
      ...r,
      registro_alumnos: rosterCompleto.map(codigo => ({ codigo, nivel_marcado: null })),
    }))

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
      instrumentos_evaluacion: rubricasConRegistro,
      ajustes_por_dia,
      ejes: ejesFinal,
      evaluacion_formativa: evaluacionFormativa,
    }

        planeacion.dias_especiales = [
      ...diasCTE.map(d => ({ fecha: d.label, fecha_iso: d.fecha, tipo: 'CTE' })),
      ...diasInhabiles.map(d => ({ fecha: d.label, fecha_iso: d.fecha, tipo: d.motivo || 'Inhábil' }))
    ].sort((a, b) => a.fecha_iso.localeCompare(b.fecha_iso))

    console.error(`💰 Costo total real de esta generación: $${acumuladorCosto.total.toFixed(6)} USD`)

    // [sep 2026, Opción B] Guardado en el SERVIDOR, ya no depende de que
    // el navegador reciba esta respuesta — antes, si la conexión se
    // cortaba después de generar (educadora cambia de pestaña, WiFi
    // inestable, teléfono se bloquea), el trabajo ya pagado en tokens de
    // Anthropic se perdía por completo, sin quedar guardado en ningún
    // lado. Ahora el INSERT ocurre aquí, incondicionalmente, apenas
    // termina de generar — y se avisa por generacion_progreso.planning_id,
    // que el frontend ya está sondeando cada 1.5s para mostrar el avance.
    const transversalesActivos: any[] = Array.isArray(form.transversales) ? form.transversales : []
    const todasPdasSeleccionadas: any[] = Array.isArray(form.pdas_seleccionados) ? form.pdas_seleccionados : []

    const { data: savedData, error: saveError } = await supabaseAdmin.from('plannings').insert({
      user_id: profile.id,
      project_name: form.nombre_proyecto,
      situacion_problema: form.situacion_problema,
      finalidad: form.finalidad,
      metodologia: form.metodologia,
      pda_campo: form.campo_formativo,
      pda_contenido: form.contenido || '',
      pda_literal: form.pda_principal || '',
      pda_id: todasPdasSeleccionadas[0]?.id || null,
      pda_2_contenido: form.pda_principal_2_contenido || null,
      pda_2_pda: form.pda_principal_2 || null,
      pda_2_id: todasPdasSeleccionadas[1]?.id || null,
      pda_2_activo: !!form.pda_principal_2,
      recursos_materiales: form.recursos_materiales || null,
      transversal_1_campo: transversalesActivos[0]?.campo || null,
      transversal_1_contenido: transversalesActivos[0]?.contenido || null,
      transversal_1_pda: transversalesActivos[0]?.pda || null,
      transversal_1_id: transversalesActivos[0]?.id || null,
      transversal_1_activo: !!transversalesActivos[0],
      transversal_2_campo: transversalesActivos[1]?.campo || null,
      transversal_2_contenido: transversalesActivos[1]?.contenido || null,
      transversal_2_pda: transversalesActivos[1]?.pda || null,
      transversal_2_id: transversalesActivos[1]?.id || null,
      transversal_2_activo: !!transversalesActivos[1],
      transversal_3_campo: transversalesActivos[2]?.campo || null,
      transversal_3_contenido: transversalesActivos[2]?.contenido || null,
      transversal_3_pda: transversalesActivos[2]?.pda || null,
      transversal_3_id: transversalesActivos[2]?.id || null,
      transversal_3_activo: !!transversalesActivos[2],
      starts_on: form.fecha_inicio || null,
      ends_on: form.fecha_fin || null,
      duration_days: diasHabiles.length,
      grade: profile.grado || '2°',
      content_json: planeacion,
      eje_principal: form.eje_principal || null,
      eje_secundario: form.eje_secundario || null,
      school_year_id: await obtenerSchoolYearId(supabaseAdmin, CICLO_ESCOLAR_ACTIVO),
      ciclo_escolar: CICLO_ESCOLAR_ACTIVO,
      status: 'active',
      costo_generacion_usd: acumuladorCosto.total,
    }).select('id').single()

    if (saveError) {
      console.error('❌ Error al guardar la planeación en el servidor:', saveError)
      if (jobId) {
        await actualizarProgreso(supabaseAdmin, jobId, {
          estado: 'error',
          error_mensaje: 'La planeación se generó pero no se pudo guardar: ' + saveError.message,
          fase_actual: 'Error al guardar.',
        })
      }
      return NextResponse.json({ error: 'La planeación se generó pero no se pudo guardar: ' + saveError.message }, { status: 500 })
    }

    if (savedData?.id && rubricasConRegistro.length > 0) {
      const { error: rubricasError } = await supabaseAdmin.from('rubrics').insert(
        rubricasConRegistro.map((r: any) => ({
          planning_id: savedData.id,
          user_id: profile.id,
          pda_evaluated: r.pda_evaluado,
          content_json: r,
          original_json: r,
          descartada: false,
        }))
      )
      if (rubricasError) {
        console.error('No se pudieron guardar las rúbricas (no crítico, la planeación sí se guardó):', rubricasError)
      }
    }

    if (jobId && savedData?.id) {
      await actualizarProgreso(supabaseAdmin, jobId, {
        estado: 'completado',
        fase_actual: '¡Tu planeación está lista!',
        planning_id: savedData.id,
      } as any)
    }

    return NextResponse.json({ planeacion, costo_generacion_usd: acumuladorCosto.total, planning_id: savedData?.id })

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