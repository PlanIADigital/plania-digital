// ============================================================
//  PlanIA Digital — API: Códigos de alumnos del grupo
//  app/api/alumnos-codigo/route.ts
//
//  [Saneado 27 sep 2026 — Fase 1, NEE y ajustes razonables]
//  Un solo código por niño: AL-XX (se retiran las iniciales de
//  users.alumnos_inclusion). Reglas (criterio del fundador):
//    - El código NUNCA se recorre ni se reutiliza dentro del ciclo:
//      una baja conserva su número; un niño que llega después recibe
//      el siguiente número (incluye bajas al calcularlo).
//    - Cada ciclo escolar es un grupo nuevo (empieza en AL-01).
//    - Los apoyos (enfoque BAP: barreras y apoyos observables, nunca
//      diagnósticos) son un dato del alumno: requiere_apoyos, apoyos,
//      apoyos_origen ('mia' | 'educadora'), apoyos_confirmado_en.
//      MÍA sugiere; solo lo que la educadora CONFIRMA llega a las
//      planeaciones.
//  Corrección: ciclo_escolar es obligatoria en la tabla y el endpoint
//  no la enviaba, así que el alta de alumnos fallaba para todas las
//  cuentas nuevas.
//  El usuario se identifica por el token Bearer (verificarUsuario).
// ============================================================
import { NextRequest, NextResponse } from 'next/server'
import { verificarUsuario } from '@/lib/verificarUsuario'
import { CICLO_ESCOLAR_ACTIVO } from '@/lib/calendarioEscolar'

const MAX_ALUMNOS = 60
const MAX_LARGO_APOYOS = 600
const ORIGENES_APOYOS = ['mia', 'educadora']
const COLUMNAS = 'id, codigo, fecha_alta, fecha_baja, activo, requiere_apoyos, apoyos, apoyos_origen, apoyos_confirmado_en'

function numeroDeCodigo(codigo: string): number {
  const m = codigo.match(/^AL-(\d+)$/)
  return m ? parseInt(m[1], 10) : 0
}

function siguienteCodigo(codigosExistentes: string[]): string {
  const max = codigosExistentes.reduce((m, c) => Math.max(m, numeroDeCodigo(c)), 0)
  return `AL-${String(max + 1).padStart(2, '0')}`
}

// Registra la decisión de la educadora sobre una sugerencia de MÍA
// DENTRO de la evaluación individual (alumnos[].revision), para que el
// aviso de pendientes funcione en cualquier dispositivo. Al subir una
// evaluación nueva, esta reemplaza a la anterior y las sugerencias
// nuevas vuelven a quedar pendientes (recordatorio natural).
async function marcarRevisionSugerencia(
  supabase: any,
  userId: string,
  referencia: string,
  revision: { estado: 'confirmada' | 'descartada'; codigo?: string; fecha: string }
): Promise<any | null> {
  const { data: u } = await supabase.from('users').select('evaluacion_individual').eq('id', userId).maybeSingle()
  const ev = u?.evaluacion_individual
  if (!ev || !Array.isArray(ev.alumnos)) return null
  let encontrado = false
  const alumnos = ev.alumnos.map((a: any) => {
    if (a?.referencia === referencia) { encontrado = true; return { ...a, revision } }
    return a
  })
  if (!encontrado) return null
  const nueva = { ...ev, alumnos }
  const { error } = await supabase.from('users').update({ evaluacion_individual: nueva }).eq('id', userId)
  if (error) {
    console.error('No se pudo registrar la revisión de la sugerencia:', error.message)
    return null
  }
  return nueva
}

function referenciaValida(r: unknown): r is string {
  return typeof r === 'string' && r.trim().length > 0 && r.length <= 40
}

// GET /api/alumnos-codigo
// Regresa el grupo del ciclo activo:
//   alumnos → activos (mismo significado que antes), en orden de código
//   bajas   → dados de baja en este ciclo (para la marca "(baja)")
//   Cada alumno trae alta_posterior = true si llegó después del inicio
//   del grupo (para la marca "(alta)").
export async function GET(request: NextRequest) {
  const auth = await verificarUsuario(request)
  if (!auth.autorizado) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }
  const { supabaseAdmin: supabase, usuario } = auth

  const { data, error } = await supabase
    .from('alumnos_codigo')
    .select(COLUMNAS)
    .eq('user_id', usuario.id)
    .eq('ciclo_escolar', CICLO_ESCOLAR_ACTIVO)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const todos = (data || []).sort((a: any, b: any) => numeroDeCodigo(a.codigo) - numeroDeCodigo(b.codigo))
  const fechaInicioGrupo = todos.reduce<string | null>(
    (min, a: any) => (!min || a.fecha_alta < min ? a.fecha_alta : min),
    null
  )
  const conMarcas = todos.map((a: any) => ({
    ...a,
    alta_posterior: !!fechaInicioGrupo && a.fecha_alta > fechaInicioGrupo,
  }))

  // [Saneado 27 sep 2026 — Fase 2] Fuente única del tamaño del grupo: los códigos
  // activos. users.total_alumnos queda como espejo (lo leen MÍA, el Word y el
  // directivo) y se actualiza aquí después de cada alta o baja.
  const totalActivos = conMarcas.filter((a: any) => a.activo).length
  if (totalActivos > 0) {
    const { error: errorTotal } = await supabase
      .from('users')
      .update({ total_alumnos: totalActivos })
      .eq('id', usuario.id)
      .or(`total_alumnos.is.null,total_alumnos.neq.${totalActivos}`)
    if (errorTotal) console.error('No se pudo sincronizar total_alumnos:', errorTotal.message)
  }

  return NextResponse.json({
    ok: true,
    ciclo: CICLO_ESCOLAR_ACTIVO,
    alumnos: conMarcas.filter((a: any) => a.activo),
    bajas: conMarcas.filter((a: any) => !a.activo),
  })
}

// POST /api/alumnos-codigo
// body: { accion: 'bootstrap', total }  → AL-01..AL-N (solo si el grupo del ciclo está vacío)
// body: { accion: 'agregar' }           → siguiente código (alta posterior)
// body: { accion: 'confirmar_apoyos', id, apoyos, origen, referencia? } → guarda apoyos confirmados
//        (referencia = "Alumno N" de la evaluación, si viene de una sugerencia de MÍA)
// body: { accion: 'quitar_apoyos', id } → retira los apoyos de ese alumno
// body: { accion: 'descartar_sugerencia', referencia } → la educadora decide que ese niño no requiere apoyos
export async function POST(request: NextRequest) {
  const auth = await verificarUsuario(request)
  if (!auth.autorizado) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }
  const { supabaseAdmin: supabase, usuario } = auth
  const userId = usuario.id

  const body = await request.json()
  const accion = body?.accion
  if (!accion) {
    return NextResponse.json({ error: 'Faltan datos requeridos' }, { status: 400 })
  }

  // ── Alta de códigos ─────────────────────────────────────────
  if (accion === 'bootstrap' || accion === 'agregar') {
    const { data: existentes, error: errorExistentes } = await supabase
      .from('alumnos_codigo')
      .select('codigo')
      .eq('user_id', userId)
      .eq('ciclo_escolar', CICLO_ESCOLAR_ACTIVO)

    if (errorExistentes) {
      return NextResponse.json({ error: errorExistentes.message }, { status: 500 })
    }
    const codigosExistentes = (existentes || []).map((r: any) => r.codigo)

    if (accion === 'bootstrap') {
      if (codigosExistentes.length > 0) {
        return NextResponse.json({ error: 'Ya existen alumnos registrados en este ciclo, no se puede pre-poblar.' }, { status: 400 })
      }
      const total = Number(body?.total)
      const totalNum = Number.isFinite(total) && total > 0 ? Math.min(Math.floor(total), MAX_ALUMNOS) : 0
      if (totalNum === 0) {
        return NextResponse.json({ error: 'Total inválido para pre-poblar.' }, { status: 400 })
      }
      const filas = Array.from({ length: totalNum }, (_, i) => ({
        user_id: userId,
        ciclo_escolar: CICLO_ESCOLAR_ACTIVO,
        codigo: `AL-${String(i + 1).padStart(2, '0')}`,
      }))
      const { data, error } = await supabase.from('alumnos_codigo').insert(filas).select(COLUMNAS)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ ok: true, alumnos: data })
    }

    // agregar
    if (codigosExistentes.length >= MAX_ALUMNOS) {
      return NextResponse.json({ error: `El grupo ya tiene el máximo de ${MAX_ALUMNOS} códigos.` }, { status: 400 })
    }
    const { data, error } = await supabase
      .from('alumnos_codigo')
      .insert({ user_id: userId, ciclo_escolar: CICLO_ESCOLAR_ACTIVO, codigo: siguienteCodigo(codigosExistentes) })
      .select(COLUMNAS)
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, alumno: data })
  }

  // ── Apoyos (MÍA sugiere, la educadora confirma) ─────────────
  if (accion === 'confirmar_apoyos' || accion === 'quitar_apoyos') {
    const id = body?.id
    if (!id) {
      return NextResponse.json({ error: 'Falta el alumno' }, { status: 400 })
    }

    let cambios: Record<string, any>
    if (accion === 'confirmar_apoyos') {
      const apoyos = typeof body?.apoyos === 'string' ? body.apoyos.trim() : ''
      const origen = body?.origen
      if (!apoyos) {
        return NextResponse.json({ error: 'Describe los apoyos antes de confirmar.' }, { status: 400 })
      }
      if (apoyos.length > MAX_LARGO_APOYOS) {
        return NextResponse.json({ error: `Los apoyos no deben pasar de ${MAX_LARGO_APOYOS} caracteres.` }, { status: 400 })
      }
      if (!ORIGENES_APOYOS.includes(origen)) {
        return NextResponse.json({ error: 'Origen de apoyos inválido.' }, { status: 400 })
      }
      cambios = {
        requiere_apoyos: true,
        apoyos,
        apoyos_origen: origen,
        apoyos_confirmado_en: new Date().toISOString(),
      }
    } else {
      cambios = { requiere_apoyos: false, apoyos: null, apoyos_origen: null, apoyos_confirmado_en: null }
    }

    // Solo alumnos activos del ciclo actual y de esta educadora.
    const { data, error } = await supabase
      .from('alumnos_codigo')
      .update(cambios)
      .eq('id', id)
      .eq('user_id', userId)
      .eq('ciclo_escolar', CICLO_ESCOLAR_ACTIVO)
      .eq('activo', true)
      .select(COLUMNAS)
      .maybeSingle()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!data) {
      return NextResponse.json({ error: 'Alumno no encontrado, dado de baja o de otro ciclo.' }, { status: 404 })
    }

    // Si la confirmación viene de una sugerencia de MÍA ("Alumno N"),
    // se registra en la evaluación qué código eligió la educadora.
    let evaluacion_individual = null
    if (accion === 'confirmar_apoyos' && referenciaValida(body?.referencia)) {
      evaluacion_individual = await marcarRevisionSugerencia(supabase, userId, body.referencia, {
        estado: 'confirmada',
        codigo: data.codigo,
        fecha: new Date().toISOString(),
      })
    }
    return NextResponse.json({ ok: true, alumno: data, evaluacion_individual })
  }

  // ── Descartar una sugerencia de MÍA (sin apoyos para ese niño) ─
  if (accion === 'descartar_sugerencia') {
    if (!referenciaValida(body?.referencia)) {
      return NextResponse.json({ error: 'Falta la referencia de la sugerencia.' }, { status: 400 })
    }
    const evaluacion_individual = await marcarRevisionSugerencia(supabase, userId, body.referencia, {
      estado: 'descartada',
      fecha: new Date().toISOString(),
    })
    if (!evaluacion_individual) {
      return NextResponse.json({ error: 'No se encontró esa sugerencia en tu evaluación actual.' }, { status: 404 })
    }
    return NextResponse.json({ ok: true, evaluacion_individual })
  }

  return NextResponse.json({ error: 'Acción no reconocida' }, { status: 400 })
}
