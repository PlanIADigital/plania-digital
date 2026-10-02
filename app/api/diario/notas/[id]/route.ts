// ============================================================
//  PlanIA Digital — API: Mi diario · una nota
//  app/api/diario/notas/[id]/route.ts
//
//  [2 oct 2026]
//  GET   → versiones de la nota (de la más reciente a la original).
//  PATCH { accion: 'editar', texto }  → crea una versión nueva (nunca
//        sobrescribe); MÍA quita nombres escritos por error.
//  PATCH { accion: 'anular', motivo } → la nota queda visible como
//        anulada, con motivo y fecha (nunca se borra).
//  Seguridad: verificarUsuario; solo notas propias.
// ============================================================
import { NextRequest, NextResponse } from 'next/server'
import { verificarUsuario } from '@/lib/verificarUsuario'
import { quitarNombres } from '@/lib/diarioPrivacidad'

const MAX_TEXTO = 4000

async function notaPropia(supabaseAdmin: any, id: string, userId: string) {
  const { data } = await supabaseAdmin
    .from('diario_notas')
    .select('id, user_id, destinatario, tipo, sucedido_en, registrado_en, estado, anulada_en, motivo_anulacion, version_actual')
    .eq('id', id).maybeSingle()
  return data && data.user_id === userId ? data : null
}

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await verificarUsuario(request)
  if (!auth.autorizado) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { supabaseAdmin, usuario } = auth
  const { id } = await context.params

  const nota = await notaPropia(supabaseAdmin, id, usuario.id)
  if (!nota) return NextResponse.json({ error: 'Nota no encontrada.' }, { status: 404 })
  const { data: versiones } = await supabaseAdmin
    .from('diario_versiones').select('numero, texto, origen, creado_en')
    .eq('nota_id', id).order('numero', { ascending: false })
  return NextResponse.json({ versiones: versiones || [] })
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await verificarUsuario(request)
  if (!auth.autorizado) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { supabaseAdmin, usuario } = auth
  const { id } = await context.params

  try {
    const nota = await notaPropia(supabaseAdmin, id, usuario.id)
    if (!nota) return NextResponse.json({ error: 'Nota no encontrada.' }, { status: 404 })
    if (nota.estado === 'anulada') return NextResponse.json({ error: 'Esta nota ya está anulada.' }, { status: 409 })
    const body = await request.json().catch(() => ({}))

    if (body?.accion === 'anular') {
      const motivo = String(body?.motivo || '').trim()
      if (motivo.length < 5) return NextResponse.json({ error: 'Escribe brevemente el motivo (al menos 5 letras).' }, { status: 400 })
      if (motivo.length > 300) return NextResponse.json({ error: 'El motivo es demasiado largo.' }, { status: 400 })
      const filtro = await quitarNombres(motivo, '[nombre omitido]')
      const { data, error } = await supabaseAdmin
        .from('diario_notas')
        .update({ estado: 'anulada', anulada_en: new Date().toISOString(), motivo_anulacion: filtro.texto })
        .eq('id', id).eq('estado', 'activa')
        .select('id, estado, anulada_en, motivo_anulacion').single()
      if (error) throw error
      return NextResponse.json({ ok: true, nota: data })
    }

    if (body?.accion === 'editar') {
      const texto = String(body?.texto || '').trim()
      if (!texto) return NextResponse.json({ error: 'La nota no puede quedar vacía.' }, { status: 400 })
      if (texto.length > MAX_TEXTO) return NextResponse.json({ error: 'La nota es demasiado larga.' }, { status: 400 })

      const { data: actual } = await supabaseAdmin
        .from('diario_versiones').select('texto')
        .eq('nota_id', id).eq('numero', nota.version_actual).maybeSingle()
      if (actual?.texto === texto) return NextResponse.json({ error: 'No hay cambios que guardar.' }, { status: 400 })

      const filtro = await quitarNombres(texto, nota.destinatario === 'grupo' ? '[nombre omitido]' : nota.destinatario)
      const numero = nota.version_actual + 1
      const { data: version, error: errorVersion } = await supabaseAdmin
        .from('diario_versiones')
        .insert({ nota_id: id, numero, texto: filtro.texto, origen: 'edicion' })
        .select('numero, texto, creado_en').single()
      if (errorVersion) throw errorVersion
      const { error: errorNota } = await supabaseAdmin
        .from('diario_notas').update({ version_actual: numero })
        .eq('id', id).eq('version_actual', nota.version_actual)
      if (errorNota) throw errorNota

      return NextResponse.json({
        ok: true,
        texto: version.texto,
        editada_en: version.creado_en,
        version_actual: numero,
        nombresQuitados: filtro.nombresQuitados,
        revisionNombres: filtro.revision,
      })
    }

    return NextResponse.json({ error: 'Acción no válida.' }, { status: 400 })
  } catch (e: any) {
    console.error('Error en PATCH /api/diario/notas/[id]:', e?.message)
    return NextResponse.json({ error: 'No se pudo actualizar la nota.' }, { status: 500 })
  }
}
