import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

const SECCION_HISTORIAL = 'observaciones_directivo'

export async function POST(req: NextRequest) {
  try {
    const { texto, auth_uid } = await req.json()
    if (!texto || !auth_uid) {
      return NextResponse.json({ error: 'Faltan datos requeridos' }, { status: 400 })
    }

    const response = await anthropic.messages.create({
      model: process.env.CLAUDE_HAIKU_MODEL || 'claude-haiku-4-5-20251001',
      max_tokens: 800,
      system: `Eres un agente pedagógico especializado en educación preescolar mexicana NEM 2022.
Recibes observaciones que un directivo ha hecho a una educadora durante visitas de aula o Consejos Técnicos Escolares.
Tu tarea es extraer las áreas de mejora pedagógica concretas para que el sistema las integre como criterios de cuidado en las planeaciones didácticas.

Reglas:
- Nunca incluir nombres reales de personas
- Enfocarte solo en aspectos pedagógicos y didácticos
- Transformar críticas en áreas de oportunidad constructivas
- Ignorar aspectos administrativos o personales

Responde ÚNICAMENTE con JSON puro, sin markdown ni backticks:
{
  "areas_mejora": ["área concreta 1", "área concreta 2", "área concreta 3"],
  "aspectos_fuertes": ["aspecto positivo 1", "aspecto positivo 2"],
  "instruccion_para_agente": "instrucción directa de 2-3 oraciones que el agente generador usará para cuidar estos aspectos en cada planeación"
}`,
      messages: [{
        role: 'user',
        content: `Analiza estas observaciones del directivo:\n\n${texto.substring(0, 6000)}`
      }]
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    const clean = text.replace(/```json|```/g, '').trim()
    const resultado = JSON.parse(clean)

    const { error } = await supabaseAdmin
      .from('users')
      .update({ observaciones_directivo: resultado })
      .eq('auth_uid', auth_uid)

    if (error) {
      return NextResponse.json({ error: 'Error al guardar' }, { status: 500 })
    }

    // Historial versionado — sección 3.1 (Observaciones de dirección)
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

        const totalAreas = Array.isArray(resultado.areas_mejora) ? resultado.areas_mejora.length : 0
        const resumenCorto = totalAreas > 0
          ? `${totalAreas} áreas de mejora: ${resultado.areas_mejora.slice(0, 2).join(', ')}${totalAreas > 2 ? '…' : ''}`
          : 'Observaciones de dirección procesadas'

        const { error: historialError } = await supabaseAdmin
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
          console.error('Error guardando historial de observaciones de dirección:', historialError)
        }
      }
    } catch (historialCatchError) {
      // El historial es complementario — un fallo aquí nunca debe tumbar la respuesta al usuario
      console.error('Error inesperado en historial de observaciones de dirección:', historialCatchError)
    }

    return NextResponse.json({ ok: true, resultado })
  } catch (error) {
    console.error('Error analizar-observaciones-directivo:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}