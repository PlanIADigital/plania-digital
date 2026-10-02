// ============================================================
//  PlanIA Digital — API: Asistencia del jardín (directivo)
//  app/api/directivo/asistencia/route.ts
//
//  [2 oct 2026] GET → asistencia de HOY por grupo (presentes/total o
//  "sin reporte") y de la SEMANA en curso (lunes a viernes, total del
//  jardín por día). Solo cantidades, nunca nombres de alumnos.
//  Seguridad: verificarDirectivo(request, 'panel'); docentes de sus CCT
//  (cualquier membresía). La fecha usa la zona horaria del estado del CCT.
// ============================================================
import { NextRequest, NextResponse } from 'next/server'
import { verificarDirectivo } from '@/lib/verificarDirectivo'
import { zonaHorariaPorCCT } from '@/lib/fechaMexico'

const FORMATO_CCT = /^[0-9A-Z]{10}$/

function hoyEn(tz: string): string {
  try { return new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date()) }
  catch { return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' }).format(new Date()) }
}
function sumarDias(fecha: string, dias: number): string {
  const d = new Date(`${fecha}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + dias)
  return d.toISOString().slice(0, 10)
}
// "3er Grado" → "3°" (misma forma corta que el encabezado de la educadora)
function gradoCorto(grado: string): string {
  const m = String(grado || '').match(/[1-3]/)
  return m ? `${m[0]}°` : String(grado || '')
}
function lunesDe(fecha: string): string {
  const dia = new Date(`${fecha}T12:00:00Z`).getUTCDay()
  return sumarDias(fecha, dia === 0 ? -6 : 1 - dia)
}

export async function GET(request: NextRequest) {
  const auth = await verificarDirectivo(request, 'panel')
  if (!auth.autorizado) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { supabaseAdmin, directivo } = auth

  try {
    const hoy = hoyEn(zonaHorariaPorCCT(directivo.cct_primary) || 'America/Mexico_City')
    const lunes = lunesDe(hoy)
    const dias = [0, 1, 2, 3, 4].map(i => sumarDias(lunes, i))

    const ccts = [directivo.cct_primary, directivo.cct_secondary]
      .filter((c): c is string => !!c && FORMATO_CCT.test(c))
    if (ccts.length === 0) return NextResponse.json({ hoy, grupos: [], semana: dias.map(fecha => ({ fecha, presentes: 0, total: 0, grupos: 0 })) })
    const lista = ccts.join(',')

    const { data: docentes } = await supabaseAdmin
      .from('users')
      .select('id, full_name, grado, grupo_letra')
      .or(`cct_primary.in.(${lista}),cct_secondary.in.(${lista})`)
      .neq('role', 'directivo')
      .eq('profile_completed', true)
    const conGrupo = (docentes || []).filter((d: any) => !!d.grado)
    const ids = conGrupo.map((d: any) => d.id)

    const { data: registros } = ids.length === 0 ? { data: [] as any[] } : await supabaseAdmin
      .from('asistencia_diaria')
      .select('user_id, fecha, presentes, total')
      .in('user_id', ids)
      .gte('fecha', dias[0])
      .lte('fecha', dias[4])

    const regs: any[] = registros || []
    const grupos = conGrupo
      .map((d: any) => {
        const r = regs.find(x => x.user_id === d.id && x.fecha === hoy)
        return {
          grupo: `${gradoCorto(d.grado)}${d.grupo_letra ? ` ${d.grupo_letra}` : ''}`,
          docente: d.full_name || '',
          presentes: r ? r.presentes : null,
          total: r ? r.total : null,
        }
      })
      .sort((a: any, b: any) => a.grupo.localeCompare(b.grupo, 'es'))

    const semana = dias.map(fecha => {
      const delDia = regs.filter(x => x.fecha === fecha)
      return {
        fecha,
        presentes: delDia.reduce((s, x) => s + x.presentes, 0),
        total: delDia.reduce((s, x) => s + x.total, 0),
        grupos: delDia.length,
      }
    })

    return NextResponse.json({ hoy, grupos, semana })
  } catch (e: any) {
    console.error('Error en /api/directivo/asistencia:', e?.message)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
