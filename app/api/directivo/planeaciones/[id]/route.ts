// ============================================================
//  PlanIA Digital — API: Planeación de una docente (solo lectura, directivo)
//  app/api/directivo/planeaciones/[id]/route.ts
//
//  [2 oct 2026] GET → la planeación, sus rúbricas vigentes y las posiciones
//  de sus PDA en el catálogo (para los códigos LEN-12, etc.).
//  Seguridad: verificarDirectivo(request, 'panel') + la DUEÑA de la
//  planeación debe compartir CCT con el directivo (compartenCct).
//  Las descartadas no se entregan. Misma respuesta 404 si no existe o es
//  de otro jardín: no se revela la existencia de planeaciones ajenas.
//  Los alumnos aparecen solo con su código AL-XX (nunca nombres).
//  El directivo SOLO VE: esta ruta no modifica nada.
// ============================================================
import { NextRequest, NextResponse } from 'next/server'
import { verificarDirectivo, compartenCct } from '@/lib/verificarDirectivo'

const FORMATO_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const NO_ENCONTRADA = { error: 'Planeación no encontrada' }

export async function GET(request: NextRequest) {
  const auth = await verificarDirectivo(request, 'panel')
  if (!auth.autorizado) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }
  const { supabaseAdmin, directivo } = auth

  try {
    const partes = new URL(request.url).pathname.split('/').filter(Boolean)
    const planeacionId = partes[partes.length - 1] || ''
    if (!FORMATO_UUID.test(planeacionId)) {
      return NextResponse.json({ error: 'Identificador inválido' }, { status: 400 })
    }

    const { data: planeacion } = await supabaseAdmin
      .from('plannings')
      .select('*')
      .eq('id', planeacionId)
      .maybeSingle()
    if (!planeacion || planeacion.status === 'discarded') {
      return NextResponse.json(NO_ENCONTRADA, { status: 404 })
    }

    const { data: duena } = await supabaseAdmin
      .from('users')
      .select('id, full_name, role, cct_primary, cct_secondary, profile_completed')
      .eq('id', planeacion.user_id)
      .maybeSingle()
    if (!duena || duena.role === 'directivo' || !duena.profile_completed || !compartenCct(directivo, duena)) {
      return NextResponse.json(NO_ENCONTRADA, { status: 404 })
    }

    const { data: rubricas } = await supabaseAdmin
      .from('rubrics')
      .select('*')
      .eq('planning_id', planeacionId)
      .eq('descartada', false)
      .order('created_at', { ascending: true })

    const idsPDA: string[] = [planeacion.pda_id, planeacion.pda_2_id, planeacion.transversal_1_id, planeacion.transversal_2_id, planeacion.transversal_3_id]
      .filter((id: any): id is string => !!id)
    const posiciones: Record<string, number> = {}
    if (idsPDA.length > 0) {
      const { data: catalogo } = await supabaseAdmin
        .from('pda_catalog')
        .select('id, posicion_campo')
        .in('id', idsPDA)
      for (const r of catalogo || []) posiciones[(r as any).id] = (r as any).posicion_campo
    }

    return NextResponse.json({
      planeacion,
      rubricas: rubricas || [],
      posiciones,
      docente: { id: duena.id, full_name: duena.full_name },
    })
  } catch (e: any) {
    console.error('Error en /api/directivo/planeaciones/[id]:', e?.message)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
