// ============================================================
//  PlanIA Digital — API: Áreas del semáforo (directivo)
//  app/api/directivo/semaforo/areas/route.ts
//
//  [2 oct 2026] POST { momento, areas: string[] } → guarda las áreas del
//  jardín (CCT principal del directivo) para ese momento del ciclo activo.
//  Bloqueo: si alguna docente de sus CCT ya marcó ese momento, se rechaza
//  (las marcas quedarían con áreas que no corresponden).
//  Validación: 1–6 áreas, sin vacíos ni repetidas, máximo 60 caracteres.
// ============================================================
import { NextRequest, NextResponse } from 'next/server'
import { verificarDirectivo } from '@/lib/verificarDirectivo'
import { CICLO_ESCOLAR_ACTIVO } from '@/lib/calendarioEscolar'
import { esMomento } from '@/lib/semaforo'

const FORMATO_CCT = /^[0-9A-Z]{10}$/

export async function POST(request: NextRequest) {
  const auth = await verificarDirectivo(request, 'panel')
  if (!auth.autorizado) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { supabaseAdmin, directivo } = auth

  try {
    const body = await request.json().catch(() => ({}))
    const momento = body?.momento
    if (!esMomento(momento)) return NextResponse.json({ error: 'Momento inválido.' }, { status: 400 })
    if (!directivo.cct_primary || !FORMATO_CCT.test(directivo.cct_primary)) {
      return NextResponse.json({ error: 'Tu cuenta no tiene un CCT válido.' }, { status: 400 })
    }

    const limpias: string[] = (Array.isArray(body?.areas) ? body.areas : [])
      .map((a: any) => String(a || '').replace(/\s+/g, ' ').trim())
      .filter((a: string) => a.length > 0)
    if (limpias.length < 1 || limpias.length > 6) return NextResponse.json({ error: 'Debe haber entre 1 y 6 áreas.' }, { status: 400 })
    if (limpias.some(a => a.length > 60)) return NextResponse.json({ error: 'Cada área puede tener hasta 60 caracteres.' }, { status: 400 })
    const unicas = new Set(limpias.map(a => a.toLowerCase()))
    if (unicas.size !== limpias.length) return NextResponse.json({ error: 'Hay áreas repetidas.' }, { status: 400 })

    // ¿Ya hay capturas de este momento en el jardín?
    const ccts = [directivo.cct_primary, directivo.cct_secondary].filter((c): c is string => !!c && FORMATO_CCT.test(c))
    const { data: docentes } = await supabaseAdmin
      .from('users').select('id')
      .or(`cct_primary.in.(${ccts.join(',')}),cct_secondary.in.(${ccts.join(',')})`)
      .neq('role', 'directivo')
    const ids = (docentes || []).map((d: any) => d.id)
    if (ids.length > 0) {
      const { count } = await supabaseAdmin
        .from('semaforo_registros').select('id', { count: 'exact', head: true })
        .in('user_id', ids).eq('ciclo_escolar', CICLO_ESCOLAR_ACTIVO).eq('momento', momento)
      if ((count || 0) > 0) {
        return NextResponse.json({ error: 'Las áreas de este momento ya están fijas porque hay capturas. Puedes cambiarlas en el siguiente momento.' }, { status: 409 })
      }
    }

    const { error } = await supabaseAdmin
      .from('semaforo_areas_jardin')
      .upsert({
        cct: directivo.cct_primary,
        ciclo_escolar: CICLO_ESCOLAR_ACTIVO,
        momento,
        areas: limpias,
        actualizado_en: new Date().toISOString(),
        actualizado_por: directivo.id,
      }, { onConflict: 'cct,ciclo_escolar,momento' })
    if (error) {
      console.error('semaforo areas: error al guardar:', error.message)
      return NextResponse.json({ error: 'No se pudo guardar. Intenta de nuevo.' }, { status: 500 })
    }
    return NextResponse.json({ ok: true, areas: limpias })
  } catch (e: any) {
    console.error('Error en /api/directivo/semaforo/areas:', e?.message)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
