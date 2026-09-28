import { parsearJSONRobusto } from '@/lib/parsearJSON'
import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { verificarUsuario } from '@/lib/verificarUsuario'

// [ago 2026] Sin esto, la función corre con el límite de tiempo por defecto
// de Vercel. Con max_tokens en 48,000 (necesario para cubrir 35 alumnos) y
// el reintento automático si el modelo se trunca, una sola ejecución puede
// tardar bastante más que antes (cuando max_tokens era 8,000 y terminaba
// rápido). Mismo patrón ya usado en generar-planeacion/route.ts y
// extraer-texto/route.ts.
export const maxDuration = 300
import { CICLO_ESCOLAR_ACTIVO } from '@/lib/calendarioEscolar'
const client = new Anthropic()

const SECCION_HISTORIAL = 'diagnostico_individual'

// [ago 2026] 35 = máximo oficial de alumnos por grupo en preescolar México.
// Medido: ~580 tokens por alumno con nivel de detalle real (observaciones,
// NEE, fortalezas, áreas de oportunidad, 3 PDAs sugeridos). 35 alumnos ≈
// 22,300 tokens base; 48,000 da margen de calidad ~2x sin escatimar, y
// queda cómodo bajo el techo real del modelo (Haiku 4.5 soporta 64,000
// tokens de salida). Costo adicional del margen: centavos de dólar.
const MAX_TOKENS_ANALISIS = 48000

// [ago 2026] FIX bug de conteo: el modelo llegó a fabricar alumnos que no
// existen en el documento real (confirmado en sesión: documento con 14
// alumnos → modelo reportó 16, generando 2 perfiles pedagógicos completos
// e inventados). La extracción de mammoth es correcta y sin ambigüedad —
// el problema es 100% del modelo. Solución: cuando el documento use el
// marcador literal "Nombre del Alumno:" (formato base del Jardín Luz María
// Jiménez, usado como referencia de toda la app), contamos en código de
// forma determinística ANTES de llamar al modelo, le entregamos el texto
// ya segmentado en bloques numerados explícitos, y al final forzamos que
// el resultado coincida con el conteo real — el modelo nunca tiene la
// última palabra sobre cuántos alumnos hay. Documentos sin ese marcador
// (otro formato) caen de vuelta al comportamiento anterior, sin cambios.
const MARCADOR_ALUMNO = /Nombre del Alumno:/gi

function segmentarPorAlumno(texto: string): { segmentos: string[]; huboMarcador: boolean } {
  const partes = texto.split(MARCADOR_ALUMNO)
  // partes[0] es el texto antes del primer marcador (encabezados institucionales) — se descarta
  if (partes.length <= 1) {
    return { segmentos: [], huboMarcador: false }
  }
  const segmentos = partes.slice(1).map(seg => seg.trim()).filter(seg => seg.length > 0)
  return { segmentos, huboMarcador: segmentos.length > 0 }
}

// [sep 2026] PROTECCIÓN DE NOMBRES DE ALUMNOS. Antes, los nombres reales viajaban
// a Anthropic pegados al texto y la única defensa era pedirle al modelo (en el
// prompt) que no los repitiera. Ahora el nombre se sustituye por "Alumno N" en
// código ANTES de llamar al modelo, y la respuesta se revisa ANTES de guardarla.
// La lista de nombres vive solo en memoria de esta petición: nunca se guarda en
// base de datos ni se escribe en logs (ningún console.* de este archivo la toca).
// Solo aplica a documentos con el marcador "Nombre del Alumno:"; sin marcador no
// hay forma confiable de saber cuál texto es un nombre, y el flujo queda igual.
const TEXTO_MARCADOR = 'Nombre del Alumno:'
// Se usan RegExp por cadena (no literales) para las propiedades Unicode (\p{L}) y
// los lookbehind, que TypeScript no admite en literales con target ES2017.
const INICIO_DE_BLOQUE = new RegExp('(?=Nombre del Alumno:)', 'i')
const LINEA_DE_NOMBRE = new RegExp('(Nombre del Alumno:[ \\t]*)([^\\r\\n]*)', 'gi')
const SEPARADOR_DE_PALABRAS = new RegExp('[^\\p{L}\\p{N}]+', 'u')
const INICIA_CON_MAYUSCULA = new RegExp('^\\p{Lu}', 'u')
const VARIANTES_ACENTO: Record<string, string> = {
  a: 'aáàâä', e: 'eéèêë', i: 'iíìîï', o: 'oóòôö', u: 'uúùûü', n: 'nñ',
}

interface NombreAlumno {
  n: number            // el N de "Alumno N" (mismo número que el bloque "ALUMNO N DE M")
  clave: string        // nombre completo normalizado, para reconocer al mismo alumno
  completo: string
  palabras: string[]   // palabras del nombre de 4 letras o más, sin repetir
}

function sinAcentos(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

function claveDeNombre(nombre: string): string {
  return sinAcentos(nombre).replace(/\s+/g, ' ').trim()
}

// Convierte una palabra en patrón de regex tolerante a acentos ("Maria" = "María")
function patronFlexible(token: string): string {
  return Array.from(token).map(ch => {
    const variantes = VARIANTES_ACENTO[sinAcentos(ch)]
    return variantes ? `[${variantes}]` : ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }).join('')
}

// Reemplaza cada patrón como palabra completa por su etiqueta ("Alumno N", o
// "[alumno]" cuando la palabra es de más de un alumno). Con soloMayuscula solo se
// reemplazan las coincidencias que empiezan con mayúscula (así "Rosa" se protege
// pero "una rosa roja" no se toca).
type ObjetivoNombre = { patron: string; etiqueta: string }
const ETIQUETA_AMBIGUA = '[alumno]'

function reemplazarNombres(
  texto: string,
  objetivos: ObjetivoNombre[],
  soloMayuscula: boolean,
  alReemplazar?: () => void,
): string {
  let resultado = texto
  for (const { patron, etiqueta } of objetivos) {
    const regex = new RegExp(`(?<![\\p{L}\\p{N}])(?:${patron})(?![\\p{L}\\p{N}])`, 'giu')
    resultado = resultado.replace(regex, (coincidencia: string) => {
      if (soloMayuscula && !INICIA_CON_MAYUSCULA.test(coincidencia)) return coincidencia
      alReemplazar?.()
      return etiqueta
    })
  }
  return resultado
}

// El nombre es el resto del renglón después de "Nombre del Alumno:" (sin espacios
// al inicio ni al final). Renglón vacío = ese alumno queda sin mapeo (no se adivina).
// La numeración cuenta bloques igual que segmentarPorAlumno (un bloque totalmente
// vacío no cuenta), así "Alumno N" coincide con "=== ALUMNO N DE M ===".
function extraerNombresAlumnos(texto: string): NombreAlumno[] {
  const nombres: NombreAlumno[] = []
  const claves = new Set<string>()
  let n = 0
  for (const pieza of texto.split(INICIO_DE_BLOQUE)) {
    if (!pieza.toLowerCase().startsWith(TEXTO_MARCADOR.toLowerCase())) continue
    if (pieza.slice(TEXTO_MARCADOR.length).trim().length === 0) continue
    n++
    const completo = (pieza.slice(TEXTO_MARCADOR.length).split(/\r|\n/)[0] || '').trim()
    if (!completo) continue
    const clave = claveDeNombre(completo)
    if (claves.has(clave)) continue // mismo nombre = mismo número en todo el documento
    claves.add(clave)
    const vistas = new Set<string>()
    const palabras: string[] = []
    for (const palabra of completo.split(SEPARADOR_DE_PALABRAS)) {
      const k = sinAcentos(palabra)
      if (palabra.length < 4 || vistas.has(k)) continue
      vistas.add(k)
      palabras.push(palabra)
    }
    nombres.push({ n, clave, completo, palabras })
  }
  return nombres
}

// Pasada global (fuera del bloque de cada alumno, y campos generales de la
// respuesta): una palabra que pertenece a UN solo alumno se cambia por su
// "Alumno N"; una que pertenece a más de uno ("María", "José") no se puede
// atribuir con certeza, así que se cambia por "[alumno]".
function palabrasGlobales(nombres: NombreAlumno[]): ObjetivoNombre[] {
  const dueños = new Map<string, { palabra: string; ns: Set<number> }>()
  for (const alumno of nombres) {
    for (const palabra of alumno.palabras) {
      const k = sinAcentos(palabra)
      const previo = dueños.get(k)
      if (previo) previo.ns.add(alumno.n)
      else dueños.set(k, { palabra, ns: new Set([alumno.n]) })
    }
  }
  return Array.from(dueños.values()).map(({ palabra, ns }) => ({
    patron: patronFlexible(palabra),
    etiqueta: ns.size > 1 ? ETIQUETA_AMBIGUA : `Alumno ${Array.from(ns)[0]}`,
  }))
}

function palabrasPropias(alumno: NombreAlumno): ObjetivoNombre[] {
  return alumno.palabras.map(p => ({ patron: patronFlexible(p), etiqueta: `Alumno ${alumno.n}` }))
}

function anonimizarTextoEvaluacion(texto: string, nombres: NombreAlumno[]): string {
  if (nombres.length === 0) return texto

  // 0) El renglón "Nombre del Alumno: ..." se reescribe siempre, sin importar
  //    mayúsculas: sabemos con certeza que ese renglón ES un nombre.
  let resultado = texto.replace(LINEA_DE_NOMBRE, (completo: string, prefijo: string, linea: string) => {
    const dueno = nombres.find(x => x.clave === claveDeNombre(linea))
    return dueno ? `${prefijo}Alumno ${dueno.n}` : completo
  })

  // 1) Nombre completo en cualquier otro lugar del documento (el más largo primero)
  const completos = [...nombres]
    .sort((a, b) => b.completo.length - a.completo.length)
    .map(x => ({ patron: x.completo.split(/\s+/).map(patronFlexible).join('\\s+'), etiqueta: `Alumno ${x.n}` }))
  resultado = reemplazarNombres(resultado, completos, true)

  // 2) Palabras del nombre: primero dentro del bloque de su propio alumno (así dos
  //    "María" distintas no se confunden entre sí)…
  resultado = resultado.split(INICIO_DE_BLOQUE).map(bloque => {
    const m = bloque.match(/^Nombre del Alumno:[ \t]*Alumno (\d+)/i)
    const dueno = m ? nombres.find(x => x.n === Number(m[1])) : undefined
    return dueno ? reemplazarNombres(bloque, palabrasPropias(dueno), true) : bloque
  }).join('')

  // 3) …y después en todo el texto, para nombres que aparezcan fuera de su bloque
  return reemplazarNombres(resultado, palabrasGlobales(nombres), true)
}

// Revisa TODOS los textos del resultado (no solo alumnos[]) y, si el modelo dejó
// pasar alguna palabra de un nombre, la cambia por su "Alumno N". Modifica el
// objeto en sitio y devuelve true si tuvo que corregir algo.
function anonimizarResultado(resultado: any, nombres: NombreAlumno[]): boolean {
  if (nombres.length === 0 || !resultado || typeof resultado !== 'object') return false
  let huboCambio = false
  const marcar = () => { huboCambio = true }
  const globales = palabrasGlobales(nombres)

  const limpiar = (valor: any, n?: number): any => {
    if (typeof valor === 'string') {
      const dueno = n ? nombres.find(x => x.n === n) : undefined
      const propio = dueno ? reemplazarNombres(valor, palabrasPropias(dueno), false, marcar) : valor
      return reemplazarNombres(propio, globales, false, marcar)
    }
    if (Array.isArray(valor)) return valor.map(v => limpiar(v, n))
    if (valor && typeof valor === 'object') {
      for (const k of Object.keys(valor)) valor[k] = limpiar(valor[k], n)
    }
    return valor
  }

  // resultado.alumnos[i] corresponde al bloque i+1, o sea al "Alumno i+1"
  const alumnosEsArreglo = Array.isArray(resultado.alumnos)
  if (alumnosEsArreglo) {
    resultado.alumnos = resultado.alumnos.map((a: any, i: number) => limpiar(a, i + 1))
  }
  for (const k of Object.keys(resultado)) {
    if (k === 'alumnos' && alumnosEsArreglo) continue
    resultado[k] = limpiar(resultado[k])
  }

  if (huboCambio) {
    console.error('[analizar-evaluacion-individual] nombre detectado y anonimizado en la respuesta')
  }
  return huboCambio
}

// [ago 2026] FIX truncamiento silencioso: con max_tokens insuficiente, el
// modelo se quedó a la mitad del alumno 12 de 14 y el resto del análisis
// (alumnos 13-14, pdas_prioritarios_grupo, alumnos_con_nee, alertas) nunca
// se generó — pero como cerrarJSONTruncado() cierra el JSON a la fuerza,
// el error pasó completamente silencioso y el conteo determinístico de
// arriba mostró "14 alumnos" con confianza total sobre un análisis
// incompleto. Ahora se revisa message.stop_reason: si el SDK confirma que
// la respuesta se cortó por límite de tokens, se reintenta una vez antes
// de rendirse — nunca se guarda silenciosamente un resultado truncado.
async function llamarModeloConReintento(params: {
  system: string
  userContent: string
}): Promise<{ responseText: string; truncado: boolean }> {
  for (let intento = 1; intento <= 2; intento++) {
    // [ago 2026] Con max_tokens alto (48000), el SDK de Anthropic exige modo
    // streaming — estima que una respuesta tan larga podría tardar más de
    // 10 minutos y bloquea la petición no-streaming ANTES de enviarla (por
    // eso el error anterior fallaba en <1s, sin tocar la red). stream()
    // + finalMessage() da el mismo resultado que create(), solo que por
    // streaming internamente — el resto del código no cambia.
    const stream = client.messages.stream({
      model: process.env.CLAUDE_HAIKU_MODEL || 'claude-haiku-4-5-20251001',
      max_tokens: MAX_TOKENS_ANALISIS,
      system: params.system,
      messages: [{ role: 'user', content: params.userContent }],
    }, {
      headers: { 'anthropic-beta': 'output-128k-2025-02-19' }
    })
    const finalMessage = await stream.finalMessage()
    const responseText = finalMessage.content[0]?.type === 'text' ? finalMessage.content[0].text : ''
    if (finalMessage.stop_reason !== 'max_tokens') {
      return { responseText, truncado: false }
    }
    console.error(`[analizar-evaluacion-individual] Intento ${intento}: respuesta truncada por max_tokens (stop_reason='max_tokens').`)
    if (intento === 2) {
      return { responseText, truncado: true }
    }
  }
  // Inalcanzable, pero TypeScript necesita un retorno explícito
  return { responseText: '', truncado: true }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await verificarUsuario(request)
    if (!auth.autorizado) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }
    const { supabaseAdmin: supabase, usuario } = auth

    const { texto_evaluacion, grado } = await request.json()

    if (!texto_evaluacion) {
      return NextResponse.json({ error: 'Faltan datos requeridos' }, { status: 400 })
    }

    const { data: catalogo } = await supabase
      .from('pda_catalog')
      .select('campo, contenido, pda, grado')
      .eq('grado', grado || '2°')
      .order('campo')

    // [jul 2026] Se agrega CONTENIDO al catálogo que ve el modelo (antes solo
    // recibía CAMPO + PDA) — necesario para que pdas_prioritarios_grupo pueda
    // devolver campo y contenido junto con el PDA, igual que ya hace 2.1
    // (Diagnóstico Grupal), y así la tarjeta se vea con el mismo badge.
    const resumenPDAs = (catalogo || []).map((r: any) =>
      `CAMPO: ${r.campo} | CONTENIDO: ${r.contenido} | PDA: ${r.pda}`
    ).join('\n')

    // [sep 2026] Los nombres reales se sustituyen por "Alumno N" ANTES de que el
    // texto llegue al modelo. La lista vive solo en esta petición (memoria).
    const nombresAlumnos = extraerNombresAlumnos(texto_evaluacion)
    const textoEvaluacionProtegido = anonimizarTextoEvaluacion(texto_evaluacion, nombresAlumnos)

    // [ago 2026] Conteo determinístico ANTES de llamar al modelo
    const { segmentos, huboMarcador } = segmentarPorAlumno(textoEvaluacionProtegido)
    const totalAlumnosReal = huboMarcador ? segmentos.length : null

    const textoParaModelo = huboMarcador
      ? segmentos
          .map((seg, i) => `=== ALUMNO ${i + 1} DE ${segmentos.length} ===\nNombre del Alumno:${seg}`)
          .join('\n\n')
      : textoEvaluacionProtegido

    const notaSegmentacion = huboMarcador
      ? `\n\nNOTA CRÍTICA DE CONTEO: el texto ya viene dividido en exactamente ${segmentos.length} bloques delimitados por "=== ALUMNO N DE ${segmentos.length} ===". Debes generar EXACTAMENTE ${segmentos.length} objetos en el arreglo "alumnos" — ni uno más, ni uno menos, uno por cada bloque. Nunca generes un alumno adicional que no corresponda a uno de estos ${segmentos.length} bloques delimitados.`
      : ''

    const systemPrompt = `Eres un agente pedagógico especializado en el Programa de Preescolar NEM 2022 Fase 2 de México.

Tu tarea es analizar la evaluación individual de alumnos de una educadora y extraer información pedagógica útil.

REGLA CRÍTICA DE CONTEO: cuenta el número real de alumnos DISTINTOS que identifiques en el documento, basándote únicamente en lo que el texto describe. No asumas ni redondees a ningún número "esperado" — reporta el conteo exacto que encuentres, aunque sea un número inusual. Si el texto viene dividido en bloques delimitados explícitamente (ver nota al final de este mensaje), el número de bloques ES el número de alumnos — no cuentes de ninguna otra forma.

REGLA CRÍTICA DE EXCLUSIÓN: el documento puede incluir entradas, filas o secciones que NO corresponden a un alumno — por ejemplo, notas, firmas, comentarios generales, o entradas etiquetadas explícitamente como "Educadora", "Docente", "Maestra", "Observaciones generales del grupo", o similar. NUNCA cuentes estas entradas como si fueran un alumno. Antes de contar, identifica primero cuáles entradas realmente describen a un niño o niña, y descarta cualquier entrada que se refiera a un adulto, al personal escolar, o a observaciones generales sin nombre de un alumno específico.

REGLAS CRÍTICAS DE PRIVACIDAD:
- NUNCA incluyas nombres reales de alumnos en tu respuesta
- Si el documento tiene nombres, sustitúyelos por referencias anónimas: "Alumno 1", "Alumno 2", etc.
- Solo extrae información pedagógica: necesidades de aprendizaje, NEE, fortalezas, áreas de oportunidad
- Ignora datos administrativos, fechas de nacimiento, CURP, domicilios, nombres de padres

REGLA CRÍTICA PARA pdas_prioritarios_grupo: cada PDA que incluyas aquí debe venir acompañado de su "campo" y "contenido" exactamente como aparecen en el CATÁLOGO PDAs que se te proporciona. El texto del PDA debe ser LITERAL y EXACTO del catálogo — nunca parafrasear ni modificar el texto. Nunca inventes un campo o contenido que no corresponda al PDA seleccionado.

REGLA CRÍTICA DE ENFOQUE BAP (Barreras para el Aprendizaje y la Participación, NEM): en "nee", "observaciones", "alertas" y "resumen_general" describe SOLO barreras observables en el contexto del aula (qué se observa, en qué situación y qué dificulta la participación), NUNCA diagnósticos, términos clínicos ni etiquetas médicas o psicológicas — por ejemplo, NO escribas "dislalia", "TDAH", "TEA", "autismo", "Asperger", "dislexia", "trastorno", "síndrome", "déficit" ni "hiperactividad", aunque el documento de la educadora los mencione. Tradúcelos a la barrera observable (ejemplo MAL: "Dislalia"; ejemplo BIEN: "Dificultad para pronunciar r y rr en juegos orales"). Cada elemento de "nee" debe ser una frase breve que describa la barrera, no una categoría de diagnóstico.

REGLA CRÍTICA DE LENGUAJE NEUTRO: en "nee", "observaciones", "alertas" y "resumen_general" usa lenguaje neutro que no revele el género del alumno: evita adjetivos y participios con marca de género y usa construcciones neutras (ejemplo MAL: "permanece callada", "se muestra tímido"; ejemplo BIEN: "permanece en silencio", "muestra timidez"). Nunca escribas "alumna", "alumno", "niña", "niño", "él" ni "ella".

REGLA CRÍTICA PARA apoyos_sugeridos: llénalo SOLO para alumnos cuyo "nee" no esté vacío; si "nee" está vacío, deja apoyos_sugeridos como "". Redacta de 2 a 3 acciones CONCRETAS que la educadora hará en el aula para reducir las barreras observadas (qué hacer, en qué momento y con qué material o estrategia), en infinitivo y separadas por punto y coma (ejemplo: "Anticipar cada consigna con apoyo visual; ofrecer primero trabajo individual antes de compartir en grupo; nombrar juntos la emoción cuando aparezca la frustración"). Usa lenguaje neutro: NUNCA escribas "alumna", "alumno", "niña", "niño", "él" ni "ella". Nunca menciones diagnósticos clínicos, etiquetas médicas ni nombres. Apóyate en sus fortalezas cuando sea posible. Máximo 400 caracteres.

Responde SOLO con JSON válido, sin texto adicional:
{
  "total_alumnos_detectados": 0,
  "resumen_general": "párrafo breve",
  "alumnos": [
    {
      "referencia": "Alumno 1",
      "observaciones": "necesidades pedagógicas",
      "nee": [],
      "apoyos_sugeridos": "",
      "fortalezas": [],
      "areas_oportunidad": [],
      "pdas_sugeridos": []
    }
  ],
  "pdas_prioritarios_grupo": [
    {
      "campo": "...",
      "contenido": "...",
      "pda": "..."
    }
  ],
  "alumnos_con_nee": 0,
  "alertas": []
}`

    const userContent = `Analiza esta evaluación individual de ${grado || '2°'} grado preescolar.\n\nCATÁLOGO PDAs:\n${resumenPDAs}${notaSegmentacion}\n\nEVALUACIÓN:\n${textoParaModelo}`

    const { responseText, truncado } = await llamarModeloConReintento({
      system: systemPrompt,
      userContent,
    })

    if (truncado) {
      return NextResponse.json(
        { error: 'El análisis quedó incompleto (documento muy extenso). Por favor intenta de nuevo — si el problema persiste, contacta soporte.' },
        { status: 500 }
      )
    }

    let resultado
    try {
      resultado = parsearJSONRobusto(responseText)
    } catch {
      return NextResponse.json({ error: 'Error al procesar la evaluación. Intenta de nuevo.' }, { status: 500 })
    }

    // [ago 2026] El conteo determinístico SIEMPRE gana sobre lo que el
    // modelo haya declarado o generado — nunca confiamos en la autoevaluación
    // del modelo cuando tenemos evidencia literal del documento.
    if (huboMarcador && totalAlumnosReal !== null) {
      if (Array.isArray(resultado.alumnos) && resultado.alumnos.length !== totalAlumnosReal) {
        console.error(
          `[analizar-evaluacion-individual] Discrepancia detectada: el modelo generó ${resultado.alumnos.length} alumnos pero el documento tiene ${totalAlumnosReal} marcadores reales ("Nombre del Alumno:"). Se recorta el arreglo al conteo real.`
        )
        resultado.alumnos = resultado.alumnos.slice(0, totalAlumnosReal)
      }
      resultado.total_alumnos_detectados = totalAlumnosReal
    }

    // [sep 2026] Última barrera antes de guardar: si el modelo repitió alguna palabra
    // de un nombre real, se cambia por su "Alumno N" (el aviso no incluye el nombre).
    anonimizarResultado(resultado, nombresAlumnos)

    const { error } = await supabase
      .from('users')
      .update({ evaluacion_individual: resultado })
      .eq('id', usuario.id)
    if (error) {
      return NextResponse.json({ error: 'Error al guardar: ' + error.message }, { status: 500 })
    }
    // Historial versionado — sección 2.2 (Diagnóstico individual)
    try {
      // documentos_historial.user_id referencia public.users.id (NO auth_uid) —
      // el id interno viene ya verificado desde el token (usuario.id)
      const userIdInterno = usuario.id
      const { data: versionesPrevias } = await supabase
        .from('documentos_historial')
        .select('version_numero')
        .eq('user_id', userIdInterno)
        .eq('seccion', SECCION_HISTORIAL)
        .order('version_numero', { ascending: false })
        .limit(1)
      const nuevaVersion = versionesPrevias && versionesPrevias.length > 0
        ? versionesPrevias[0].version_numero + 1
        : 1
      await supabase
        .from('documentos_historial')
        .update({ activo: false })
        .eq('user_id', userIdInterno)
        .eq('seccion', SECCION_HISTORIAL)
        .eq('activo', true)
      const totalAlumnos = typeof resultado.total_alumnos_detectados === 'number' ? resultado.total_alumnos_detectados : 0
      const alumnosConNEE = typeof resultado.alumnos_con_nee === 'number' ? resultado.alumnos_con_nee : 0
      const resumenCorto = `${totalAlumnos} alumnos analizados${alumnosConNEE > 0 ? `, ${alumnosConNEE} con NEE` : ''}`
      const { error: historialError } = await supabase
        .from('documentos_historial')
        .insert({
          user_id: userIdInterno,
          seccion: SECCION_HISTORIAL,
          ciclo_escolar: CICLO_ESCOLAR_ACTIVO,
          version_numero: nuevaVersion,
          contenido: JSON.stringify(resultado),
          resumen: resumenCorto,
          archivo_formato: 'texto',
          activo: true,
        })
      if (historialError) {
        console.error('Error guardando historial de evaluación individual:', historialError)
      }
    } catch (historialCatchError) {
      // El historial es complementario — un fallo aquí nunca debe tumbar la respuesta al usuario
      console.error('Error inesperado en historial de evaluación individual:', historialCatchError)
    }
    return NextResponse.json({ resultado })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 })
  }
}