// ============================================================
//  PlanIA Digital — API: Mi diario · transcripción
//  app/api/diario/transcribir/route.ts
//
//  [2 oct 2026]
//  GET  → minutos usados del periodo y tope (para el panel).
//  POST multipart { audio, tipo: 'observacion'|'incidente', segundos }
//       → { texto, segundos, usadosMin, topeMin }
//  - El audio NO se guarda: se manda a OpenAI y se descarta.
//  - Cada transcripción cuenta para el tope mensual (300 min) y
//    registra su costo real en diario_transcripciones.
//  - Periodo: aniversario mensual de fecha_pago; si no existe,
//    los últimos 30 días.
// ============================================================
import { NextRequest, NextResponse } from 'next/server'
import { verificarUsuario } from '@/lib/verificarUsuario'
import { CICLO_ESCOLAR_ACTIVO } from '@/lib/calendarioEscolar'
import Anthropic from '@anthropic-ai/sdk'

export const runtime = 'nodejs'
export const maxDuration = 60

const MODELO = 'gpt-4o-mini-transcribe'
const MODELO_FILTRO = 'claude-haiku-4-5-20251001'
const USD_POR_MINUTO = 0.003
const TOPE_MINUTOS = 300
const MAX_SEGUNDOS: Record<string, number> = { observacion: 60, incidente: 180 }
const MAX_BYTES = 6 * 1024 * 1024 // 6 MB: de sobra para 3 min de voz comprimida

function inicioDelPeriodo(fechaPago: string | null | undefined, ahora = new Date()): Date {
  if (fechaPago) {
    const base = new Date(fechaPago)
    if (!isNaN(base.getTime()) && base <= ahora) {
      const inicio = new Date(base)
      inicio.setFullYear(ahora.getFullYear(), ahora.getMonth(), base.getDate())
      if (inicio > ahora) inicio.setMonth(inicio.getMonth() - 1)
      return inicio
    }
  }
  return new Date(ahora.getTime() - 30 * 24 * 60 * 60 * 1000)
}

async function minutosUsados(supabaseAdmin: any, userId: string): Promise<number> {
  const { data: u } = await supabaseAdmin.from('users').select('*').eq('id', userId).single()
  const desde = inicioDelPeriodo(u?.fecha_pago)
  const { data } = await supabaseAdmin
    .from('diario_transcripciones').select('segundos')
    .eq('user_id', userId).gte('creado_en', desde.toISOString())
  const segundos = (data || []).reduce((s: number, r: any) => s + Number(r.segundos || 0), 0)
  return Math.round((segundos / 60) * 10) / 10
}

function extensionDe(tipoMime: string): string {
  if (tipoMime.includes('mp4') || tipoMime.includes('m4a') || tipoMime.includes('aac')) return 'm4a'
  if (tipoMime.includes('ogg')) return 'ogg'
  if (tipoMime.includes('wav')) return 'wav'
  if (tipoMime.includes('mpeg') || tipoMime.includes('mp3')) return 'mp3'
  return 'webm'
}

export async function GET(request: NextRequest) {
  const auth = await verificarUsuario(request)
  if (!auth.autorizado) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { supabaseAdmin, usuario } = auth
  const usadosMin = await minutosUsados(supabaseAdmin, usuario.id)
  return NextResponse.json({ usadosMin, topeMin: TOPE_MINUTOS })
}

export async function POST(request: NextRequest) {
  const auth = await verificarUsuario(request)
  if (!auth.autorizado) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { supabaseAdmin, usuario } = auth
  if (usuario.role === 'directivo') return NextResponse.json({ error: 'Mi diario es para educadoras.' }, { status: 403 })
  if (!process.env.OPENAI_API_KEY) {
    console.error('Mi diario: falta OPENAI_API_KEY')
    return NextResponse.json({ error: 'La transcripción no está configurada.' }, { status: 500 })
  }

  try {
    const form = await request.formData()
    const audio = form.get('audio')
    const tipo = String(form.get('tipo') || 'observacion')
    const destinatario = String(form.get('destinatario') || 'grupo')
    if (!(audio instanceof Blob) || audio.size === 0) {
      return NextResponse.json({ error: 'No llegó el audio. Intenta grabar de nuevo.' }, { status: 400 })
    }
    if (!MAX_SEGUNDOS[tipo]) return NextResponse.json({ error: 'Tipo de nota no válido.' }, { status: 400 })
    if (audio.size > MAX_BYTES) return NextResponse.json({ error: 'La grabación es demasiado larga.' }, { status: 413 })
    const segundos = Math.min(Math.max(Number(form.get('segundos')) || 0, 1), MAX_SEGUNDOS[tipo])

    const usadosMin = await minutosUsados(supabaseAdmin, usuario.id)
    if (usadosMin + segundos / 60 > TOPE_MINUTOS) {
      return NextResponse.json({
        error: `Llegaste a tus ${TOPE_MINUTOS} minutos de Mi diario de este periodo. Se renuevan con tu siguiente mes de membresía.`,
        usadosMin, topeMin: TOPE_MINUTOS,
      }, { status: 429 })
    }

    const tipoMime = (audio as any).type || 'audio/webm'
    const envio = new FormData()
    envio.append('file', audio, `nota.${extensionDe(tipoMime)}`)
    envio.append('model', MODELO)
    envio.append('language', 'es')
    envio.append('response_format', 'json')
    envio.append('prompt', 'Observaciones de una educadora de preescolar en México sobre niñas y niños de su grupo. Los alumnos se mencionan por código, por ejemplo AL-03.')

    const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: envio,
    })
    if (!res.ok) {
      const detalle = await res.text().catch(() => '')
      console.error('Mi diario: OpenAI respondió', res.status, detalle.slice(0, 300))
      return NextResponse.json({ error: 'No se pudo transcribir. Intenta de nuevo en un momento.' }, { status: 502 })
    }
    const json: any = await res.json()
    let texto = String(json?.text || '').trim()

    // "al 03" / "AL 3" / "a l 3" → "AL-03", solo si ese código existe en su lista.
    const { data: lista } = await supabaseAdmin
      .from('alumnos_codigo').select('codigo')
      .eq('user_id', usuario.id).eq('ciclo_escolar', CICLO_ESCOLAR_ACTIVO).eq('activo', true)
    const codigos = new Set<string>((lista || []).map((a: any) => String(a.codigo)))
    texto = texto.replace(/\ba\s?l[\s-]*(\d{1,2})\b/gi, (original: string, n: string) => {
      const codigo = `AL-${n.padStart(2, '0')}`
      return codigos.has(codigo) ? codigo : original
    })

    // [2 oct 2026] Filtro de privacidad (prompt autorizado por el fundador):
    // MÍA quita nombres dictados por error ANTES de mostrar el texto. El texto
    // en bruto nunca se guarda, así que el nombre no llega a la base.
    const reemplazo = destinatario !== 'grupo' && codigos.has(destinatario) ? destinatario : '[nombre omitido]'
    let nombresQuitados = 0
    let revisionNombres: 'ok' | 'fallo' = 'ok'
    let costoFiltro = 0
    if (texto) {
      try {
        const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
        const r = await anthropic.messages.create({
          model: MODELO_FILTRO,
          max_tokens: 2000,
          temperature: 0,
          system: `Eres un filtro de privacidad para notas de una educadora de preescolar en México. Recibes una transcripción de voz. Reemplaza CADA nombre propio de persona (niñas, niños, familiares, docentes) por ${reemplazo}. No cambies ninguna otra palabra, ni la puntuación, ni el orden. No reemplaces códigos como AL-03, ni nombres de lugares, materiales o actividades. Si no hay nombres, devuelve el texto idéntico. Responde solo JSON: {"texto":"...","nombres_quitados":N}`,
          messages: [{ role: 'user', content: texto }],
        })
        costoFiltro = (r.usage.input_tokens * 1 + r.usage.output_tokens * 5) / 1_000_000
        const bloque: any = r.content.find((b: any) => b.type === 'text')
        const crudo = String(bloque?.text || '')
        const j = JSON.parse(crudo.slice(crudo.indexOf('{'), crudo.lastIndexOf('}') + 1))
        const limpio = String(j?.texto || '').trim()
        const n = Number(j?.nombres_quitados) || 0
        if (limpio && limpio.length > texto.length * 0.5 && limpio.length < texto.length * 1.5) {
          if (n > 0) { texto = limpio; nombresQuitados = n }
        } else {
          revisionNombres = 'fallo'
        }
      } catch (e: any) {
        console.error('Mi diario: el filtro de nombres falló:', e?.message)
        revisionNombres = 'fallo'
      }
    }

    await supabaseAdmin.from('diario_transcripciones').insert({
      user_id: usuario.id,
      segundos,
      costo_usd: Number(((segundos / 60) * USD_POR_MINUTO + costoFiltro).toFixed(6)),
      modelo: MODELO,
    })

    if (!texto) return NextResponse.json({ error: 'No se escuchó nada. Acerca el teléfono y vuelve a grabar.' }, { status: 422 })
    return NextResponse.json({ texto, segundos, nombresQuitados, revisionNombres, usadosMin: Math.round((usadosMin + segundos / 60) * 10) / 10, topeMin: TOPE_MINUTOS })
  } catch (e: any) {
    console.error('Error en POST /api/diario/transcribir:', e?.message)
    return NextResponse.json({ error: 'Error interno al transcribir.' }, { status: 500 })
  }
}
