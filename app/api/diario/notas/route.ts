// ============================================================
//  PlanIA Digital — API: Mi diario · notas
//  app/api/diario/notas/route.ts
//
//  [2 oct 2026]
//  GET  ?dias=14 → { alumnos, notas } (notas activas y anuladas del
//                  periodo, con el texto de su versión más reciente)
//  POST { destinatario, tipo, texto, sucedido_en } → crea la nota.
//       Versión 1 = el texto que la educadora VALIDÓ (la transcripción
//       en bruto no se guarda: podría traer un nombre dictado por error).
//  Seguridad: verificarUsuario; destinatario 'grupo' o un código de
//  SU lista activa; registrado_en lo pone el servidor.
// ============================================================
import { NextRequest, NextResponse } from 'next/server'
import { verificarUsuario } from '@/lib/verificarUsuario'
import { CICLO_ESCOLAR_ACTIVO } from '@/lib/calendarioEscolar'

const MAX_TEXTO = 4000
const numero = (c: string) => { const m = String(c || '').match(/(\d+)$/); return m ? parseInt(m[1], 10) : 0 }

async function codigosActivos(supabaseAdmin: any, userId: string): Promise<string[]> {
  const { data } = await supabaseAdmin
    .from('alumnos_codigo').select('codigo')
    .eq('user_id', userId).eq('ciclo_escolar', CICLO_ESCOLAR_ACTIVO).eq('activo', true)
  return (data || []).map((a: any) => String(a.codigo)).sort((a: string, b: string) => numero(a) - numero(b))
}

export async function GET(request: NextRequest) {
  const auth = await verificarUsuario(request)
  if (!auth.autorizado) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { supabaseAdmin, usuario } = auth
  if (usuario.role === 'directivo') return NextResponse.json({ error: 'Mi diario es para educadoras.' }, { status: 403 })

  try {
    const dias = Math.min(Math.max(Number(new URL(request.url).searchParams.get('dias')) || 14, 1), 400)
    const desde = new Date(Date.now() - dias * 24 * 60 * 60 * 1000).toISOString()
    const alumnos = await codigosActivos(supabaseAdmin, usuario.id)

    const { data: notas, error } = await supabaseAdmin
      .from('diario_notas')
      .select('id, destinatario, tipo, sucedido_en, registrado_en, estado, anulada_en, motivo_anulacion, version_actual')
      .eq('user_id', usuario.id).eq('ciclo_escolar', CICLO_ESCOLAR_ACTIVO)
      .gte('sucedido_en', desde)
      .order('sucedido_en', { ascending: false })
    if (error) throw error

    const ids = (notas || []).map((n: any) => n.id)
    const textos: Record<string, { texto: string; creado_en: string }> = {}
    if (ids.length) {
      const { data: versiones } = await supabaseAdmin
        .from('diario_versiones').select('nota_id, numero, texto, creado_en').in('nota_id', ids)
      for (const v of versiones || []) {
        const n = (notas || []).find((x: any) => x.id === v.nota_id)
        if (n && v.numero === n.version_actual) textos[v.nota_id] = { texto: v.texto, creado_en: v.creado_en }
      }
    }

    return NextResponse.json({
      ciclo: CICLO_ESCOLAR_ACTIVO,
      alumnos,
      notas: (notas || []).map((n: any) => ({
        ...n,
        texto: textos[n.id]?.texto ?? '',
        editada_en: n.version_actual > 1 ? textos[n.id]?.creado_en ?? null : null,
      })),
    })
  } catch (e: any) {
    console.error('Error en GET /api/diario/notas:', e?.message)
    return NextResponse.json({ error: 'No se pudieron cargar las notas.' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const auth = await verificarUsuario(request)
  if (!auth.autorizado) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { supabaseAdmin, usuario } = auth
  if (usuario.role === 'directivo') return NextResponse.json({ error: 'Mi diario es para educadoras.' }, { status: 403 })

  try {
    const body = await request.json().catch(() => ({}))
    const destinatario = String(body?.destinatario || '')
    const tipo = String(body?.tipo || '')
    const texto = String(body?.texto || '').trim()
    const sucedido = new Date(String(body?.sucedido_en || ''))

    if (!['observacion', 'incidente'].includes(tipo)) return NextResponse.json({ error: 'Tipo de nota no válido.' }, { status: 400 })
    if (!texto) return NextResponse.json({ error: 'La nota está vacía.' }, { status: 400 })
    if (texto.length > MAX_TEXTO) return NextResponse.json({ error: 'La nota es demasiado larga.' }, { status: 400 })
    if (isNaN(sucedido.getTime())) return NextResponse.json({ error: 'La hora de lo sucedido no es válida.' }, { status: 400 })
    const ahora = Date.now()
    if (sucedido.getTime() > ahora + 5 * 60 * 1000) return NextResponse.json({ error: 'La hora de lo sucedido no puede ser futura.' }, { status: 400 })
    if (sucedido.getTime() < ahora - 7 * 24 * 60 * 60 * 1000) return NextResponse.json({ error: 'Solo puedes registrar lo sucedido en los últimos 7 días.' }, { status: 400 })

    if (destinatario !== 'grupo') {
      const alumnos = await codigosActivos(supabaseAdmin, usuario.id)
      if (!alumnos.includes(destinatario)) return NextResponse.json({ error: 'Ese código no está en tu lista activa.' }, { status: 400 })
    }

    const { data: u } = await supabaseAdmin.from('users').select('cct_primary').eq('id', usuario.id).single()
    const { data: nota, error } = await supabaseAdmin
      .from('diario_notas')
      .insert({
        user_id: usuario.id,
        cct: u?.cct_primary ?? null,
        ciclo_escolar: CICLO_ESCOLAR_ACTIVO,
        destinatario,
        tipo,
        sucedido_en: sucedido.toISOString(),
      })
      .select('id, destinatario, tipo, sucedido_en, registrado_en, estado, version_actual')
      .single()
    if (error) throw error

    const { error: errorVersion } = await supabaseAdmin
      .from('diario_versiones').insert({ nota_id: nota.id, numero: 1, texto, origen: 'transcripcion' })
    if (errorVersion) {
      await supabaseAdmin.from('diario_notas').delete().eq('id', nota.id)
      throw errorVersion
    }

    return NextResponse.json({ ok: true, nota: { ...nota, texto, editada_en: null } })
  } catch (e: any) {
    console.error('Error en POST /api/diario/notas:', e?.message)
    return NextResponse.json({ error: 'No se pudo guardar la nota.' }, { status: 500 })
  }
}
