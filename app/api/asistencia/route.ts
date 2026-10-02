// ============================================================
//  PlanIA Digital — API: Asistencia diaria de la educadora
//  app/api/asistencia/route.ts
//
//  [2 oct 2026] Solo CANTIDADES por grupo (nunca nombres).
//  GET  → fecha de hoy (zona horaria del estado del CCT), grupo, total de
//         alumnos (códigos AL-XX activos del ciclo) y lo ya enviado hoy y
//         el día hábil anterior.
//  POST { fecha, presentes } → guarda o corrige. Solo hoy o el día hábil
//         anterior; nunca sábado ni domingo; 0 ≤ presentes ≤ total.
//  Seguridad: verificarUsuario (token Bearer). La tabla tiene RLS sin
//  políticas: el navegador no puede leerla ni escribirla directamente.
//  Limitación conocida: aún no descuenta días inhábiles del calendario.
// ============================================================
import { NextRequest, NextResponse } from 'next/server'
import { verificarUsuario } from '@/lib/verificarUsuario'
import { zonaHorariaPorCCT } from '@/lib/fechaMexico'
import { CICLO_ESCOLAR_ACTIVO } from '@/lib/calendarioEscolar'

function hoyEn(tz: string): string {
  try { return new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date()) }
  catch { return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' }).format(new Date()) }
}
function sumarDias(fecha: string, dias: number): string {
  const d = new Date(`${fecha}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + dias)
  return d.toISOString().slice(0, 10)
}
function esFinDeSemana(fecha: string): boolean {
  const dia = new Date(`${fecha}T12:00:00Z`).getUTCDay()
  return dia === 0 || dia === 6
}
function diaHabilAnterior(fecha: string): string {
  let f = sumarDias(fecha, -1)
  while (esFinDeSemana(f)) f = sumarDias(f, -1)
  return f
}

async function contexto(supabaseAdmin: any, usuarioId: string) {
  const { data: u } = await supabaseAdmin
    .from('users')
    .select('id, role, cct_primary, grado, grupo_letra, total_alumnos')
    .eq('id', usuarioId)
    .single()
  const { count } = await supabaseAdmin
    .from('alumnos_codigo')
    .select('codigo', { count: 'exact', head: true })
    .eq('user_id', usuarioId)
    .eq('ciclo_escolar', CICLO_ESCOLAR_ACTIVO)
    .eq('activo', true)
  const total = (count && count > 0) ? count : (u?.total_alumnos || 0)
  const hoy = hoyEn(zonaHorariaPorCCT(u?.cct_primary) || 'America/Mexico_City')
  return { u, total, hoy, anterior: diaHabilAnterior(hoy) }
}

export async function GET(request: NextRequest) {
  const auth = await verificarUsuario(request)
  if (!auth.autorizado) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { supabaseAdmin, usuario } = auth
  if (usuario.role === 'directivo') return NextResponse.json({ error: 'No aplica para directivos' }, { status: 403 })

  try {
    const { u, total, hoy, anterior } = await contexto(supabaseAdmin, usuario.id)
    const { data: registros } = await supabaseAdmin
      .from('asistencia_diaria')
      .select('fecha, presentes, total, actualizado_en')
      .eq('user_id', usuario.id)
      .in('fecha', [hoy, anterior])
    const de = (f: string) => (registros || []).find((r: any) => r.fecha === f) || null
    return NextResponse.json({
      hoy, anterior,
      hoyEsHabil: !esFinDeSemana(hoy),
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

    const { u, total, hoy, anterior } = await contexto(supabaseAdmin, usuario.id)
    if (!u?.grado) return NextResponse.json({ error: 'Configura tu grupo en Mi grupo antes de enviar asistencia.' }, { status: 400 })
    if (total <= 0) return NextResponse.json({ error: 'Registra tu lista de alumnos en Mi grupo antes de enviar asistencia.' }, { status: 400 })
    if (fecha !== hoy && fecha !== anterior) return NextResponse.json({ error: 'Solo puedes enviar la asistencia de hoy o del día hábil anterior.' }, { status: 400 })
    if (esFinDeSemana(fecha)) return NextResponse.json({ error: 'No se registra asistencia en fin de semana.' }, { status: 400 })
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
