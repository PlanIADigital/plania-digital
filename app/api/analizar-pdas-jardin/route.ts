import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

const SECCION_HISTORIAL = 'pdas_jardin'

const CAMPOS_VALIDOS = [
  'Lenguajes',
  'Saberes y Pensamiento Científico',
  'Ética, Naturaleza y Sociedades',
  'De lo Humano y lo Comunitario',
]

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

export async function POST(req: NextRequest) {
  try {
    const { texto, auth_uid } = await req.json()

    if (!texto || !auth_uid) {
      return NextResponse.json({ error: 'Faltan datos requeridos' }, { status: 400 })
    }

    const { data: catalogo } = await supabaseAdmin
      .from('pda_catalog')
      .select('id, campo, pda, posicion_campo')

    if (!catalogo || catalogo.length === 0) {
      return NextResponse.json({ error: 'Catálogo no disponible' }, { status: 500 })
    }

    const catalogoPorCampo: Record<string, typeof catalogo> = {}
    CAMPOS_VALIDOS.forEach(campo => {
      catalogoPorCampo[campo] = catalogo.filter((c: any) => c.campo === campo)
    })

    const listadoParaPrompt = CAMPOS_VALIDOS.map(campo => {
      const items = catalogoPorCampo[campo].map((c: any, i: number) => `[${i}] ${c.pda}`).join('\n')
      return `CAMPO: ${campo}\n${items}`
    }).join('\n\n')

    const response = await anthropic.messages.create({
      model: process.env.CLAUDE_SONNET_MODEL || 'claude-sonnet-4-6',
      max_tokens: 2000,
      system: `Eres un agente pedagógico especializado en el Programa de Preescolar NEM 2022 Fase 2 de México.

Recibes: (1) el catálogo oficial completo de PDAs de la Fase 2, agrupado por campo formativo, cada uno con un número de índice; y (2) el texto de un documento donde el colectivo docente de un jardín de niños declaró ciertos PDAs como PRIORITARIOS para este ciclo escolar.

TU TAREA: identifica cuáles PDAs del catálogo corresponden a los que el documento señala como prioritarios. El documento puede parafrasear, resumir, o tener pequeños errores de redacción respecto al texto oficial — tu trabajo es reconocer CUÁL PDA oficial es, por su significado, no exigir coincidencia literal del texto del documento.

REGLA CRÍTICA: solo puedes señalar "campo" + "indice" de la lista que te doy. NUNCA escribas el texto del PDA tú mismo, y NUNCA inventes un índice que no exista en la lista de ese campo. Si el documento menciona algo que no corresponde claramente a ningún PDA del catálogo, ignóralo — no fuerces una coincidencia dudosa.

Responde ÚNICAMENTE con JSON puro, sin markdown ni backticks.

FORMATO DE SALIDA:
{
  "coincidencias": [
    { "campo": "Lenguajes", "indice": 12 }
  ],
  "resumen": "una oración breve describiendo qué se detectó, para mostrar en pantalla"
}`,
      messages: [{
        role: 'user',
        content: `CATÁLOGO OFICIAL (por campo, con índice):\n${listadoParaPrompt}\n\nTEXTO DEL DOCUMENTO DE PDAs DEL JARDÍN:\n${texto.substring(0, 8000)}`
      }]
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    const resultado = parsearJSONRobusto(text)
    const coincidencias: { campo: string; indice: number }[] = Array.isArray(resultado.coincidencias) ? resultado.coincidencias : []

    const pdasVinculados = coincidencias
      .filter(c => CAMPOS_VALIDOS.includes(c.campo) && catalogoPorCampo[c.campo]?.[c.indice])
      .map(c => {
        const item: any = catalogoPorCampo[c.campo][c.indice]
        return {
          id: item.id,
          campo: item.campo,
          posicion_campo: item.posicion_campo,
          pda: item.pda,
          vinculado: true,
        }
      })

    const vistos = new Set<string>()
    const pdasFinal = pdasVinculados.filter(p => {
      if (vistos.has(p.id)) return false
      vistos.add(p.id)
      return true
    })

    // [jul 2026] Se guarda el resumen JUNTO con la lista, en un solo
    // objeto — antes solo se guardaba el arreglo de PDAs y el resumen
    // vivía únicamente en la respuesta HTTP de esta llamada, así que
    // se perdía al refrescar la página (la tarjeta se veía "reducida"
    // después de recargar, aunque los PDAs seguían ahí). Con esta
    // estructura, resumen y lista viajan y se recuperan juntos siempre.
    const paraGuardar = {
      pdas: pdasFinal,
      resumen: resultado.resumen || '',
      fecha_analisis: new Date().toISOString(),
    }

    await supabaseAdmin
      .from('users')
      .update({ pdas_jardin: paraGuardar })
      .eq('auth_uid', auth_uid)

    // Historial versionado — sección 1.3 (PDAs del jardín)
    try {
      // documentos_historial.user_id referencia public.users.id (NO auth_uid) —
      // hay que resolver primero el id interno del usuario
      const { data: usuarioRow, error: usuarioError } = await supabaseAdmin
        .from('users')
        .select('id')
        .eq('auth_uid', auth_uid)
        .maybeSingle()

      if (usuarioError || !usuarioRow) {
        console.error('No se pudo resolver users.id a partir de auth_uid para historial:', usuarioError)
      } else {
        const userIdInterno = usuarioRow.id

        const { data: versionesPrevias } = await supabaseAdmin
          .from('documentos_historial')
          .select('version_numero')
          .eq('user_id', userIdInterno)
          .eq('seccion', SECCION_HISTORIAL)
          .order('version_numero', { ascending: false })
          .limit(1)

        const nuevaVersion = versionesPrevias && versionesPrevias.length > 0
          ? versionesPrevias[0].version_numero + 1
          : 1

        await supabaseAdmin
          .from('documentos_historial')
          .update({ activo: false })
          .eq('user_id', userIdInterno)
          .eq('seccion', SECCION_HISTORIAL)
          .eq('activo', true)

        const resumenCorto = paraGuardar.resumen
          ? paraGuardar.resumen.slice(0, 200)
          : `${pdasFinal.length} PDAs del jardín vinculados`

        const { error: historialError } = await supabaseAdmin
          .from('documentos_historial')
          .insert({
            user_id: userIdInterno,
            seccion: SECCION_HISTORIAL,
            version_numero: nuevaVersion,
            contenido: JSON.stringify(paraGuardar),
            resumen: resumenCorto,
            archivo_formato: 'texto',
            activo: true,
          })

        if (historialError) {
          console.error('Error guardando historial de PDAs del jardín:', historialError)
        }
      }
    } catch (historialCatchError) {
      // El historial es complementario — un fallo aquí nunca debe tumbar la respuesta al usuario
      console.error('Error inesperado en historial de PDAs del jardín:', historialCatchError)
    }

    return NextResponse.json({
      ok: true,
      pdas_jardin: pdasFinal,
      total_vinculados: pdasFinal.length,
      resumen: paraGuardar.resumen,
    })

  } catch (error) {
    console.error('Error analizar-pdas-jardin:', error)
    const msg = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}