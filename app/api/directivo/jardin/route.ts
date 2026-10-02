// ============================================================
//  PlanIA Digital — API: Resumen estratégico del jardín (directivo)
//  app/api/directivo/jardin/route.ts
//
//  [2 oct 2026] Dashboard del directivo. Junta las planeaciones del
//  ciclo ACTIVO de todas las docentes de sus CCT y calcula el avance
//  del JARDÍN con las MISMAS funciones que Mi Avance (lib/cobertura.ts):
//  un PDA trabajado por dos docentes cuenta una sola vez.
//  Seguridad: verificarDirectivo(request, 'panel'). Solo salen cifras
//  agregadas y nombres de las docentes (para observaciones); nunca
//  correo, teléfono, diagnósticos ni datos de alumnos.
//  La membresía de la educadora NO filtra (incluye fundadoras).
//  Limitación conocida: el ritmo semanal cuenta lunes a viernes; aún
//  no descuenta días inhábiles del calendario estatal.
// ============================================================
import { NextRequest, NextResponse } from 'next/server'
import { verificarDirectivo } from '@/lib/verificarDirectivo'
import { cargarContextoAvance, type ContextoAvance } from '@/lib/avanceServidor'
import {
  SELECT_PLANNINGS_AVANCE,
  calcularAvance,
  clasificarPlaneaciones,
  construirCanastaPrioritarios,
  calcularPrioritarios,
  ORIGENES_PRIORITARIO,
} from '@/lib/cobertura'
import { CICLO_ESCOLAR_ACTIVO } from '@/lib/calendarioEscolar'

const FORMATO_CCT = /^[0-9A-Z]{10}$/
const CAMPOS = [
  'Lenguajes',
  'Saberes y Pensamiento Científico',
  'Ética, Naturaleza y Sociedades',
  'De lo Humano y lo Comunitario',
]
const SEMANAS_RITMO = 6

// Fecha de hoy en México como YYYY-MM-DD.
function hoyMexico(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
}

function sumarDias(fecha: string, dias: number): string {
  const d = new Date(`${fecha}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + dias)
  return d.toISOString().slice(0, 10)
}

function lunesDe(fecha: string): string {
  const dia = new Date(`${fecha}T12:00:00Z`).getUTCDay() // 0 dom … 6 sáb
  return sumarDias(fecha, dia === 0 ? -6 : 1 - dia)
}

// Días de lunes a viernes donde [ini, fin] se cruza con [desde, hasta].
function diasHabilesCruce(ini: string, fin: string, desde: string, hasta: string): number {
  const a = ini > desde ? ini : desde
  const b = fin < hasta ? fin : hasta
  if (a > b) return 0
  let n = 0
  for (let f = a; f <= b; f = sumarDias(f, 1)) {
    const dia = new Date(`${f}T12:00:00Z`).getUTCDay()
    if (dia !== 0 && dia !== 6) n++
  }
  return n
}

// "3er Grado", "3°", "3" → "3°". Sin dígito → null.
function gradoCorto(grado: string | null | undefined): string | null {
  const m = String(grado || '').match(/[1-3]/)
  return m ? `${m[0]}°` : null
}

export async function GET(request: NextRequest) {
  const auth = await verificarDirectivo(request, 'panel')
  if (!auth.autorizado) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }
  const { supabaseAdmin, directivo } = auth

  try {
    const hoy = hoyMexico()
    const mesActual = hoy.slice(0, 7)
    const mesAnterior = sumarDias(`${mesActual}-01`, -1).slice(0, 7)

    const ccts = [directivo.cct_primary, directivo.cct_secondary]
      .filter((c): c is string => !!c && FORMATO_CCT.test(c))
    const vacio = {
      ciclo: CICLO_ESCOLAR_ACTIVO, hoy, meses: { anterior: mesAnterior, actual: mesActual },
      docentes: { total: 0, conPlaneaciones: 0 }, planeaciones: 0, pdaDistintos: 0,
      campos: CAMPOS.map(nombre => ({ nombre, distintos: 0, total: 0 })),
      porGrado: [], ejes: { conteo: {}, planeaciones: 0 }, modalidades: [], ritmo: [],
      prioritarios: { total: 0, atendidos: 0, porOrigen: [] }, observaciones: [],
    }
    if (ccts.length === 0) return NextResponse.json(vacio)
    const lista = ccts.join(',')

    // 1) Docentes de sus CCT (cualquier membresía).
    const { data: docentes, error: errDoc } = await supabaseAdmin
      .from('users')
      .select('id, full_name, role, grado, total_alumnos, cct_primary, evaluacion_individual, pdas_prioritarios, pdas_jardin')
      .or(`cct_primary.in.(${lista}),cct_secondary.in.(${lista})`)
      .neq('role', 'directivo')
      .eq('profile_completed', true)
    if (errDoc) {
      console.error('jardin: error al leer docentes:', errDoc.message)
      return NextResponse.json({ error: 'No se pudo cargar la información del jardín' }, { status: 500 })
    }
    const listaDocentes = docentes || []
    if (listaDocentes.length === 0) return NextResponse.json(vacio)

    // 2) Contexto del ciclo (fechas + catálogo). Un jardín está en un solo estado.
    const estado = String(directivo.cct_primary || listaDocentes[0].cct_primary || '').slice(0, 2)
    const ctx: ContextoAvance = await cargarContextoAvance(supabaseAdmin, estado, CICLO_ESCOLAR_ACTIVO)

    // 3) Todas las planeaciones del ciclo de esas docentes, en una sola consulta.
    const { data: plans, error: errPlan } = await supabaseAdmin
      .from('plannings')
      .select(`${SELECT_PLANNINGS_AVANCE}, user_id, metodologia, ends_on`)
      .in('user_id', listaDocentes.map(d => d.id))
      .eq('ciclo_escolar', CICLO_ESCOLAR_ACTIVO)
    if (errPlan) {
      console.error('jardin: error al leer planeaciones:', errPlan.message)
      return NextResponse.json({ error: 'No se pudo cargar la información del jardín' }, { status: 500 })
    }
    const todas: any[] = plans || []
    const contadas: any[] = clasificarPlaneaciones(todas, ctx.periodo).contadas

    // 4) Avance del jardín completo (unión de PDA).
    const avanceJardin = calcularAvance(todas, ctx.catalogo, ctx.periodo)
    const totalCatalogo: Record<string, number> = {}
    for (const p of ctx.catalogo) totalCatalogo[p.campo] = (totalCatalogo[p.campo] || 0) + 1
    const campos = CAMPOS.map(nombre => ({
      nombre,
      distintos: avanceJardin.porCampo[nombre]?.distintos || 0,
      total: totalCatalogo[nombre] || 0,
    }))

    // 5) Por docente: planeaciones y prioritarios (suma por origen).
    const planesDe: Record<string, any[]> = {}
    for (const p of todas) (planesDe[p.user_id] ||= []).push(p)
    const contadasDe: Record<string, number> = {}
    for (const p of contadas) contadasDe[p.user_id] = (contadasDe[p.user_id] || 0) + 1

    const porOrigen: Record<string, { total: number; atendidos: number }> = {}
    for (const o of ORIGENES_PRIORITARIO) porOrigen[o.clave] = { total: 0, atendidos: 0 }
    let prioTotal = 0
    let prioAtendidos = 0
    for (const d of listaDocentes) {
      const avanceDoc = calcularAvance(planesDe[d.id] || [], ctx.catalogo, ctx.periodo)
      const pr = calcularPrioritarios(construirCanastaPrioritarios(d, ctx.catalogo), avanceDoc)
      if (!pr.hayDiagnostico) continue
      prioTotal += pr.total
      prioAtendidos += pr.atendidos
      for (const o of ORIGENES_PRIORITARIO) {
        porOrigen[o.clave].total += pr.porOrigen[o.clave]?.total || 0
        porOrigen[o.clave].atendidos += pr.porOrigen[o.clave]?.atendidos || 0
      }
    }

    // 6) Por grado: reparto entre campos, alumnos y PDA por mes.
    const gradoDe: Record<string, string | null> = {}
    for (const d of listaDocentes) gradoDe[d.id] = gradoCorto(d.grado)
    const porGrado = ['1°', '2°', '3°'].map(grado => {
      const docsGrado = listaDocentes.filter(d => gradoDe[d.id] === grado)
      const planesGrado = todas.filter(p => gradoDe[p.user_id] === grado)
      const avance = calcularAvance(planesGrado, ctx.catalogo, ctx.periodo)
      const delMes = (mes: string) =>
        calcularAvance(planesGrado.filter(p => String(p.starts_on || '').startsWith(mes)), ctx.catalogo, ctx.periodo).pdaDistintos
      return {
        grado,
        docentes: docsGrado.length,
        alumnos: docsGrado.reduce((s, d) => s + (d.total_alumnos || 0), 0),
        campos: Object.fromEntries(CAMPOS.map(c => [c, avance.porCampo[c]?.distintos || 0])),
        pdaMesAnterior: delMes(mesAnterior),
        pdaMesActual: delMes(mesActual),
      }
    }).filter(g => g.docentes > 0)

    // 7) Modalidades de las planeaciones que cuentan.
    const conteoMod: Record<string, number> = {}
    for (const p of contadas) {
      const m = (p.metodologia || 'Sin registrar').trim()
      conteoMod[m] = (conteoMod[m] || 0) + 1
    }
    const modalidades = Object.entries(conteoMod)
      .map(([nombre, cantidad]) => ({ nombre, cantidad }))
      .sort((a, b) => b.cantidad - a.cantidad)

    // 8) Ritmo: días planeados (lun-vie) en las últimas semanas del ciclo.
    const lunesActual = lunesDe(hoy)
    const ritmo: Array<{ semana: string; dias: number }> = []
    for (let i = SEMANAS_RITMO - 1; i >= 0; i--) {
      const desde = sumarDias(lunesActual, -7 * i)
      const hasta = sumarDias(desde, 4)
      if (ctx.periodo.inicio && hasta < ctx.periodo.inicio) continue
      let dias = 0
      for (const p of contadas) {
        if (!p.starts_on) continue
        const ini = String(p.starts_on).slice(0, 10)
        const fin = String(p.ends_on || p.starts_on).slice(0, 10)
        dias += diasHabilesCruce(ini, fin, desde, hasta)
      }
      ritmo.push({ semana: desde, dias })
    }

    // 9) Observaciones relevantes (reglas fijas, sin IA).
    const observaciones: string[] = []
    for (const d of listaDocentes) {
      const nombre = d.full_name || 'Una docente'
      if (!gradoDe[d.id]) observaciones.push(`${nombre} aún no configura su grupo.`)
      else if (!contadasDe[d.id]) observaciones.push(`${nombre} aún no genera planeaciones este ciclo.`)
    }
    if (contadas.length > 0) {
      const conPct = campos.filter(c => c.total > 0).map(c => ({ ...c, pct: c.distintos / c.total }))
      const menor = conPct.sort((a, b) => a.pct - b.pct)[0]
      if (menor) observaciones.push(`${menor.nombre} es el campo menos trabajado del jardín (${Math.round(menor.pct * 100)}% de sus PDA).`)
    }
    if (porOrigen.jardin.total > 0) {
      observaciones.push(`De los ${porOrigen.jardin.total} PDA prioritarios del jardín, ${porOrigen.jardin.atendidos} ya se abordaron.`)
    }

    return NextResponse.json({
      ciclo: CICLO_ESCOLAR_ACTIVO,
      hoy,
      meses: { anterior: mesAnterior, actual: mesActual },
      docentes: {
        total: listaDocentes.length,
        conPlaneaciones: listaDocentes.filter(d => contadasDe[d.id]).length,
      },
      planeaciones: contadas.length,
      pdaDistintos: avanceJardin.pdaDistintos,
      campos,
      porGrado,
      ejes: { conteo: avanceJardin.ejes.conteo, planeaciones: contadas.length },
      modalidades,
      ritmo,
      prioritarios: {
        total: prioTotal,
        atendidos: prioAtendidos,
        porOrigen: ORIGENES_PRIORITARIO.map(o => ({ clave: o.clave, etiqueta: o.etiqueta, ...porOrigen[o.clave] })),
      },
      observaciones,
    })
  } catch (e: any) {
    console.error('Error en /api/directivo/jardin:', e?.message)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
