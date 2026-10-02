// ============================================================
//  PlanIA Digital — API: Semáforo de desempeño (educadora)
//  app/api/semaforo/route.ts
//
//  [2 oct 2026]
//  GET ?momento=m1 → alumnos activos (códigos AL-XX), áreas del jardín,
//                    marcas guardadas y fecha de envío del momento.
//  POST { momento, area, marcas: { "AL-01": "suficiente", ... } } → guarda.
//  POST { momento, accion: "enviar" } → envía a dirección si está completo.
//  Seguridad: verificarUsuario; solo códigos de SU lista activa del ciclo.
// ============================================================
import { NextRequest, NextResponse } from 'next/server'
import { verificarUsuario } from '@/lib/verificarUsuario'
import { zonaHorariaPorCCT } from '@/lib/fechaMexico'
import { CICLO_ESCOLAR_ACTIVO } from '@/lib/calendarioEscolar'
import { MOMENTOS, esMomento, esNivel, momentoSugerido } from '@/lib/semaforo'
import { areasDelMomento } from '@/lib/semaforoServidor'

function hoyEn(tz: string): string {
  try { return new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date()) }
  catch { return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' }).format(new Date()) }
}
const numero = (c: string) => { const m = String(c || '').match(/(\d+)$/); return m ? parseInt(m[1], 10) : 0 }

async function contexto(supabaseAdmin: any, usuarioId: string) {
  const { data: u } = await supabaseAdmin
    .from('users').select('id, role, cct_primary, grado, grupo_letra').eq('id', usuarioId).single()
  const { data: alumnos } = await supabaseAdmin
    .from('alumnos_codigo').select('codigo')
    .eq('user_id', usuarioId).eq('ciclo_escolar', CICLO_ESCOLAR_ACTIVO).eq('activo', true)
  const codigos: string[] = (alumnos || []).map((a: any) => a.codigo).filter(Boolean).sort((a: string, b: string) => numero(a) - numero(b))
  const hoy = hoyEn(zonaHorariaPorCCT(u?.cct_primary) || 'America/Mexico_City')
  return { u, codigos, hoy }
}

function rechazo(usuario: any) {
  return usuario.role === 'directivo' ? NextResponse.json({ error: 'No aplica para directivos' }, { status: 403 }) : null
}

export async function GET(request: NextRequest) {
  const auth = await verificarUsuario(request)
  if (!auth.autorizado) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { supabaseAdmin, usuario } = auth
  const r = rechazo(usuario); if (r) return r

  try {
    const { u, codigos, hoy } = await contexto(supabaseAdmin, usuario.id)
    const pedido = new URL(request.url).searchParams.get('momento')
    const momento = esMomento(pedido) ? pedido : momentoSugerido(hoy)
    const areas = await areasDelMomento(supabaseAdmin, u?.cct_primary, CICLO_ESCOLAR_ACTIVO, momento)

    const { data: regs } = await supabaseAdmin
      .from('semaforo_registros').select('area, alumno_codigo, nivel')
      .eq('user_id', usuario.id).eq('ciclo_escolar', CICLO_ESCOLAR_ACTIVO).eq('momento', momento)
    const marcas: Record<string, Record<string, string>> = {}
    for (const a of areas) marcas[a] = {}
    for (const x of regs || []) {
      if (marcas[x.area] && codigos.includes(x.alumno_codigo)) marcas[x.area][x.alumno_codigo] = x.nivel
    }
    const { data: envio } = await supabaseAdmin
      .from('semaforo_envios').select('enviado_en')
      .eq('user_id', usuario.id).eq('ciclo_escolar', CICLO_ESCOLAR_ACTIVO).eq('momento', momento).maybeSingle()

    return NextResponse.json({
      ciclo: CICLO_ESCOLAR_ACTIVO,
      momento,
      momentoSugerido: momentoSugerido(hoy),
      momentos: MOMENTOS,
      grado: u?.grado ?? null,
      grupo_letra: u?.grupo_letra ?? null,
      alumnos: codigos,
      areas,
      marcas,
      enviado_en: envio?.enviado_en ?? null,
    })
  } catch (e: any) {
    console.error('Error en GET /api/semaforo:', e?.message)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const auth = await verificarUsuario(request)
  if (!auth.autorizado) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { supabaseAdmin, usuario } = auth
  const r = rechazo(usuario); if (r) return r

  try {
    const body = await request.json().catch(() => ({}))
    const momento = body?.momento
    if (!esMomento(momento)) return NextResponse.json({ error: 'Momento inválido.' }, { status: 400 })
    const { u, codigos } = await contexto(supabaseAdmin, usuario.id)
    const areas = await areasDelMomento(supabaseAdmin, u?.cct_primary, CICLO_ESCOLAR_ACTIVO, momento)
    if (!u?.grado) return NextResponse.json({ error: 'Configura tu grupo en Mi grupo antes de llenar el semáforo.' }, { status: 400 })
    if (codigos.length === 0) return NextResponse.json({ error: 'Registra tu lista de alumnos en Mi grupo antes de llenar el semáforo.' }, { status: 400 })

    // Enviar a dirección
    if (body?.accion === 'enviar') {
      const { data: regs } = await supabaseAdmin
        .from('semaforo_registros').select('area, alumno_codigo')
        .eq('user_id', usuario.id).eq('ciclo_escolar', CICLO_ESCOLAR_ACTIVO).eq('momento', momento)
      const hechas = new Set((regs || []).map((x: any) => `${x.area}|${x.alumno_codigo}`))
      const faltan = areas.filter(a => codigos.some(c => !hechas.has(`${a}|${c}`)))
      if (faltan.length > 0) {
        return NextResponse.json({ error: `Aún faltan niños por marcar en: ${faltan.join(', ')}.` }, { status: 400 })
      }
      const { data, error } = await supabaseAdmin
        .from('semaforo_envios')
        .upsert({ user_id: usuario.id, ciclo_escolar: CICLO_ESCOLAR_ACTIVO, momento, enviado_en: new Date().toISOString() }, { onConflict: 'user_id,ciclo_escolar,momento' })
        .select('enviado_en').single()
      if (error) return NextResponse.json({ error: 'No se pudo enviar. Intenta de nuevo.' }, { status: 500 })
      return NextResponse.json({ ok: true, enviado_en: data.enviado_en })
    }

    // Guardar marcas de un área
    const area = String(body?.area || '')
    if (!areas.includes(area)) return NextResponse.json({ error: 'Área inválida.' }, { status: 400 })
    const marcas = body?.marcas && typeof body.marcas === 'object' ? body.marcas : {}
    const filas = Object.entries(marcas)
      .filter(([codigo, nivel]) => codigos.includes(codigo) && esNivel(nivel))
      .map(([codigo, nivel]) => ({
        user_id: usuario.id, ciclo_escolar: CICLO_ESCOLAR_ACTIVO, momento, area,
        alumno_codigo: codigo, nivel, grado: u.grado, grupo_letra: u.grupo_letra ?? null,
        actualizado_en: new Date().toISOString(),
      }))
    if (filas.length === 0) return NextResponse.json({ error: 'No hay marcas válidas para guardar.' }, { status: 400 })
    const { error } = await supabaseAdmin
      .from('semaforo_registros')
      .upsert(filas, { onConflict: 'user_id,ciclo_escolar,momento,area,alumno_codigo' })
    if (error) {
      console.error('semaforo: error al guardar:', error.message)
      return NextResponse.json({ error: 'No se pudo guardar. Intenta de nuevo.' }, { status: 500 })
    }
    return NextResponse.json({ ok: true, guardadas: filas.length })
  } catch (e: any) {
    console.error('Error en POST /api/semaforo:', e?.message)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
