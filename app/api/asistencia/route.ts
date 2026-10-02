// ============================================================
//  PlanIA Digital — API: Asistencia diaria de la educadora
//  app/api/asistencia/route.ts
//
//  [2 oct 2026] Solo CANTIDADES por grupo (nunca nombres).
//  GET  → fecha de hoy (zona horaria del estado del CCT), si hay clases hoy
//         (calendario estatal), grupo, total (códigos AL-XX activos) y lo
//         enviado hoy y el día de clases anterior.
//  POST { fecha, presentes } → guarda o corrige. Solo hoy o el día de
//         clases anterior; nunca un día sin clases; 0 ≤ presentes ≤ total.
//  Una sola fuente del total: la lista de códigos AL-XX activos.
//  Seguridad: verificarUsuario (token Bearer). Tabla con RLS sin políticas.
// ============================================================
import { NextRequest, NextResponse } from 'next/server'
import { verificarUsuario } from '@/lib/verificarUsuario'
import { zonaHorariaPorCCT } from '@/lib/fechaMexico'
import { CICLO_ESCOLAR_ACTIVO } from '@/lib/calendarioEscolar'
import { cargarDiasDeClase, type InfoDia } from '@/lib/diasDeClase'

function hoyEn(tz: string): string {
  try { return new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date()) }
  catch { return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' }).format(new Date()) }
}
function sumarDias(fecha: string, dias: number): string {
  const d = new Date(`${fecha}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + dias)
  return d.toISOString().slice(0, 10)
}
// Día de clases anterior (salta fines de semana y días sin clases; máximo 30 días atrás).
function diaDeClasesAnterior(fecha: string, info: (f: string) => InfoDia): string {
  let f = sumarDias(fecha, -1)
  for (let i = 0; i < 30 && !info(f).habil; i++) f = sumarDias(f, -1)
  return f
}

async function contexto(supabaseAdmin: any, usuarioId: string) {
  const { data: u } = await supabaseAdmin
    .from('users')
    .select('id, role, cct_primary, grado, grupo_letra')
    .eq('id', usuarioId)
    .single()
  const { count } = await supabaseAdmin
    .from('alumnos_codigo')
    .select('codigo', { count: 'exact', head: true })
    .eq('user_id', usuarioId)
    .eq('ciclo_escolar', CICLO_ESCOLAR_ACTIVO)
    .eq('activo', true)
  const total = count || 0
  const hoy = hoyEn(zonaHorariaPorCCT(u?.cct_primary) || 'America/Mexico_City')
  const info = await cargarDiasDeClase(supabaseAdmin, u?.cct_primary, CICLO_ESCOLAR_ACTIVO)
  return { u, total, hoy, info, anterior: diaDeClasesAnterior(hoy, info) }
}

export async function GET(request: NextRequest) {
  const auth = await verificarUsuario(request)
  if (!auth.autorizado) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { supabaseAdmin, usuario } = auth
  if (usuario.role === 'directivo') return NextResponse.json({ error: 'No aplica para directivos' }, { status: 403 })

  try {
    const { u, total, hoy, info, anterior } = await contexto(supabaseAdmin, usuario.id)
    const { data: registros } = await supabaseAdmin
      .from('asistencia_diaria')
      .select('fecha, presentes, total, actualizado_en')
      .eq('user_id', usuario.id)
      .in('fecha', [hoy, anterior])
    const de = (f: string) => (registros || []).find((r: any) => r.fecha === f) || null
    const infoHoy = info(hoy)
    return NextResponse.json({
      hoy, anterior,
      hoyEsHabil: infoHoy.habil,
      motivoHoy: infoHoy.habil ? null : infoHoy.motivo,
      grado: u?.grado ?? null,
      grupo_letra: u?.grupo_letra ?? null,
      total,
      registroHoy: de(hoy),
      registroAnterior: de(anterior),
    })
  } catch (e: any) {
    console.error('Error en GET /api/asistencia:', e?.message)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const auth = await verificarUsuario(request)
  if (!auth.autorizado) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { supabaseAdmin, usuario } = auth
  if (usuario.role === 'directivo') return NextResponse.json({ error: 'No aplica para directivos' }, { status: 403 })

  try {
    const body = await request.json().catch(() => ({}))
    const fecha = String(body?.fecha || '')
    const presentes = Number(body?.presentes)

    const { u, total, hoy, info, anterior } = await contexto(supabaseAdmin, usuario.id)
    if (!u?.grado) return NextResponse.json({ error: 'Configura tu grupo en Mi grupo antes de enviar asistencia.' }, { status: 400 })
    if (total <= 0) return NextResponse.json({ error: 'Registra tu lista de alumnos en Mi grupo antes de enviar asistencia.' }, { status: 400 })
    if (fecha !== hoy && fecha !== anterior) return NextResponse.json({ error: 'Solo puedes enviar la asistencia de hoy o del día de clases anterior.' }, { status: 400 })
    const infoFecha = info(fecha)
    if (!infoFecha.habil) return NextResponse.json({ error: `Ese día no hay clases (${infoFecha.motivo}).` }, { status: 400 })
    if (!Number.isInteger(presentes) || presentes < 0 || presentes > total) {
      return NextResponse.json({ error: `Los presentes deben estar entre 0 y ${total}.` }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('asistencia_diaria')
      .upsert({
        user_id: usuario.id,
        fecha,
        ciclo_escolar: CICLO_ESCOLAR_ACTIVO,
        grado: u.grado,
        grupo_letra: u.grupo_letra ?? null,
        presentes,
        total,
        actualizado_en: new Date().toISOString(),
      }, { onConflict: 'user_id,fecha' })
      .select('fecha, presentes, total, actualizado_en')
      .single()
    if (error) {
      console.error('asistencia: error al guardar:', error.message)
      return NextResponse.json({ error: 'No se pudo guardar. Intenta de nuevo.' }, { status: 500 })
    }
    return NextResponse.json({ ok: true, registro: data })
  } catch (e: any) {
    console.error('Error en POST /api/asistencia:', e?.message)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
