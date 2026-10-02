// ============================================================
//  PlanIA Digital — API: Semáforo del jardín (directivo)
//  app/api/directivo/semaforo/route.ts
//
//  [2 oct 2026] GET ?momento=m1 → estado por grupo (enviado / en captura /
//  sin iniciar) y concentrado por área, por grado y del jardín.
//  El concentrado SOLO cuenta grupos que ya ENVIARON (datos oficiales).
//  Solo cantidades; nunca códigos ni nombres de alumnos.
//  Seguridad: verificarDirectivo(request, 'panel'); docentes de sus CCT.
// ============================================================
import { NextRequest, NextResponse } from 'next/server'
import { verificarDirectivo } from '@/lib/verificarDirectivo'
import { zonaHorariaPorCCT } from '@/lib/fechaMexico'
import { CICLO_ESCOLAR_ACTIVO } from '@/lib/calendarioEscolar'
import { MOMENTOS, NIVELES, esMomento, momentoSugerido } from '@/lib/semaforo'
import { areasDelMomento } from '@/lib/semaforoServidor'

const FORMATO_CCT = /^[0-9A-Z]{10}$/
type Conteo = Record<string, number>
const vacio = (): Conteo => Object.fromEntries(NIVELES.map(n => [n.clave, 0]))

function hoyEn(tz: string): string {
  try { return new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date()) }
  catch { return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' }).format(new Date()) }
}
function gradoCorto(g: string | null): string {
  const m = String(g || '').match(/[1-3]/)
  return m ? `${m[0]}°` : String(g || '')
}

export async function GET(request: NextRequest) {
  const auth = await verificarDirectivo(request, 'panel')
  if (!auth.autorizado) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { supabaseAdmin, directivo } = auth

  try {
    const hoy = hoyEn(zonaHorariaPorCCT(directivo.cct_primary) || 'America/Mexico_City')
    const pedido = new URL(request.url).searchParams.get('momento')
    const momento = esMomento(pedido) ? pedido : momentoSugerido(hoy)

    const areas = await areasDelMomento(supabaseAdmin, directivo.cct_primary, CICLO_ESCOLAR_ACTIVO, momento)
    const base = { ciclo: CICLO_ESCOLAR_ACTIVO, momento, momentoSugerido: momentoSugerido(hoy), momentos: MOMENTOS, areas }

    const ccts = [directivo.cct_primary, directivo.cct_secondary].filter((c): c is string => !!c && FORMATO_CCT.test(c))
    if (ccts.length === 0) return NextResponse.json({ ...base, grupos: [], concentrado: [] })
    const lista = ccts.join(',')

    const { data: docentes } = await supabaseAdmin
      .from('users').select('id, full_name, grado, grupo_letra')
      .or(`cct_primary.in.(${lista}),cct_secondary.in.(${lista})`)
      .neq('role', 'directivo').eq('profile_completed', true)
    const conGrupo = (docentes || []).filter((d: any) => !!d.grado)
    const ids = conGrupo.map((d: any) => d.id)
    if (ids.length === 0) return NextResponse.json({ ...base, grupos: [], concentrado: [] })

    const [{ data: alumnos }, { data: regs }, { data: envios }] = await Promise.all([
      supabaseAdmin.from('alumnos_codigo').select('user_id').in('user_id', ids).eq('ciclo_escolar', CICLO_ESCOLAR_ACTIVO).eq('activo', true),
      supabaseAdmin.from('semaforo_registros').select('user_id, area, nivel').in('user_id', ids).eq('ciclo_escolar', CICLO_ESCOLAR_ACTIVO).eq('momento', momento),
      supabaseAdmin.from('semaforo_envios').select('user_id, enviado_en').in('user_id', ids).eq('ciclo_escolar', CICLO_ESCOLAR_ACTIVO).eq('momento', momento),
    ])

    const alumnosDe: Record<string, number> = {}
    for (const a of alumnos || []) alumnosDe[a.user_id] = (alumnosDe[a.user_id] || 0) + 1
    const envioDe: Record<string, string> = {}
    for (const e of envios || []) envioDe[e.user_id] = e.enviado_en

    // Marcas por docente y área
    const marcas: Record<string, Record<string, Conteo>> = {}
    for (const r of regs || []) {
      if (!areas.includes(r.area)) continue
      marcas[r.user_id] ||= {}
      marcas[r.user_id][r.area] ||= vacio()
      marcas[r.user_id][r.area][r.nivel] = (marcas[r.user_id][r.area][r.nivel] || 0) + 1
    }

    const grupos = conGrupo.map((d: any) => {
      const total = alumnosDe[d.id] || 0
      const porArea = marcas[d.id] || {}
      const areasCompletas = areas.filter(a => total > 0 && Object.values(porArea[a] || {}).reduce((s, n) => s + n, 0) >= total).length
      const enviado_en = envioDe[d.id] || null
      const hayMarcas = Object.keys(porArea).length > 0
      return {
        grupo: `${gradoCorto(d.grado)}${d.grupo_letra ? ` ${d.grupo_letra}` : ''}`,
        grado: gradoCorto(d.grado),
        docente: d.full_name || '',
        alumnos: total,
        estado: enviado_en ? 'enviado' : hayMarcas ? 'en_captura' : 'sin_iniciar',
        enviado_en,
        areasCompletas,
      }
    }).sort((a: any, b: any) => a.grupo.localeCompare(b.grupo, 'es'))

    // Concentrado: solo grupos ENVIADOS
    const enviados = conGrupo.filter((d: any) => envioDe[d.id])
    const grados = Array.from(new Set(enviados.map((d: any) => gradoCorto(d.grado)))).sort()
    const concentrado = areas.map(area => {
      const porGrado = grados.map(grado => {
        const c = vacio()
        for (const d of enviados) {
          if (gradoCorto(d.grado) !== grado) continue
          const m = marcas[d.id]?.[area]
          if (m) for (const k of Object.keys(c)) c[k] += m[k] || 0
        }
        return { grado, conteo: c }
      })
      const jardin = vacio()
      for (const g of porGrado) for (const k of Object.keys(jardin)) jardin[k] += g.conteo[k]
      return { area, porGrado, jardin }
    })

    return NextResponse.json({ ...base, grupos, concentrado, areasBloqueadas: (regs || []).length > 0 })
  } catch (e: any) {
    console.error('Error en /api/directivo/semaforo:', e?.message)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
