import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

const client = new Anthropic()
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

const SECCION_HISTORIAL = 'diagnostico_individual'

// [ago 2026] 35 = máximo oficial de alumnos por grupo en preescolar México.
// Medido: ~580 tokens por alumno con nivel de detalle real (observaciones,
// NEE, fortalezas, áreas de oportunidad, 3 PDAs sugeridos). 35 alumnos ≈
// 22,300 tokens base; 48,000 da margen de calidad ~2x sin escatimar, y
// queda cómodo bajo el techo real del modelo (Haiku 4.5 soporta 64,000
// tokens de salida). Costo adicional del margen: centavos de dólar.
const MAX_TOKENS_ANALISIS = 48000

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
    if (escapando) { resultado += ch; escapando = false; continue }
    if (ch === '\\') { resultado += ch; escapando = true; continue }
    if (ch === '\n') { resultado += '\\n'; continue }
    if (ch === '\r') { resultado += '\\r'; continue }
    if (ch === '\t') { resultado += '\\t'; continue }
    if (ch === '"') {
      let j = i + 1
      while (j < n && /\s/.test(raw[j])) j++
      const siguiente = raw[j]
      const esCierreReal = siguiente === ',' || siguiente === '}' || siguiente === ']' || siguiente === ':' || siguiente === undefined
      if (esCierreReal) { resultado += ch; dentroDeString = false }
      else resultado += '\\"'
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
  } catch {
    return JSON.parse(cerrarJSONTruncado(reparado))
  }
}

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
    const message = await client.messages.create({
      model: process.env.CLAUDE_HAIKU_MODEL || 'claude-haiku-4-5-20251001',
      max_tokens: MAX_TOKENS_ANALISIS,
      system: params.system,
      messages: [{ role: 'user', content: params.userContent }],
    })
    const responseText = message.content[0].type === 'text' ? message.content[0].text : ''
    if (message.stop_reason !== 'max_tokens') {
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
    const { texto_evaluacion, grado, auth_uid } = await request.json()

    if (!texto_evaluacion || !auth_uid) {
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

    // [ago 2026] Conteo determinístico ANTES de llamar al modelo
    const { segmentos, huboMarcador } = segmentarPorAlumno(texto_evaluacion)
    const totalAlumnosReal = huboMarcador ? segmentos.length : null

    const textoParaModelo = huboMarcador
      ? segmentos
          .map((seg, i) => `=== ALUMNO ${i + 1} DE ${segmentos.length} ===\nNombre del Alumno:${seg}`)
          .join('\n\n')
      : texto_evaluacion

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

Responde SOLO con JSON válido, sin texto adicional:
{
  "total_alumnos_detectados": 0,
  "resumen_general": "párrafo breve",
  "alumnos": [
    {
      "referencia": "Alumno 1",
      "observaciones": "necesidades pedagógicas",
      "nee": [],
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

    const { error } = await supabase
      .from('users')
      .update({ evaluacion_individual: resultado })
      .eq('auth_uid', auth_uid)
    if (error) {
      return NextResponse.json({ error: 'Error al guardar: ' + error.message }, { status: 500 })
    }
    // Historial versionado — sección 2.2 (Diagnóstico individual)
    try {
      // documentos_historial.user_id referencia public.users.id (NO auth_uid) —
      // hay que resolver primero el id interno del usuario
      const { data: usuarioRow, error: usuarioError } = await supabase
        .from('users')
        .select('id')
        .eq('auth_uid', auth_uid)
        .maybeSingle()
      if (usuarioError || !usuarioRow) {
        console.error('No se pudo resolver users.id a partir de auth_uid para historial:', usuarioError)
      } else {
        const userIdInterno = usuarioRow.id
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
            version_numero: nuevaVersion,
            contenido: JSON.stringify(resultado),
            resumen: resumenCorto,
            archivo_formato: 'texto',
            activo: true,
          })
        if (historialError) {
          console.error('Error guardando historial de evaluación individual:', historialError)
        }
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