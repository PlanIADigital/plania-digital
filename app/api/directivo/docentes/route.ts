// ============================================================
//  PlanIA Digital — API: Docentes del directivo (lista con resumen)
//  app/api/directivo/docentes/route.ts
//
//  [Saneado 27 sep 2026 — Fase 1, infraestructura del directivo]
//  GET → docentes de los CCT del directivo (principal o secundario),
//  con un RESUMEN de su avance del ciclo activo, calculado con las
//  mismas funciones que Mi Avance (lib/cobertura.ts vía
//  lib/avanceServidor.ts).
//  Seguridad: verificarDirectivo(request, 'panel'). Solo se devuelven
//  campos necesarios; nunca correo, teléfono ni diagnóstico completo
//  (el diagnóstico se usa aquí dentro para la canasta de prioritarios
//  y no sale del servidor).
//  La membresía de la educadora NO filtra (incluye fundadoras).
// ============================================================
import { NextRequest, NextResponse } from 'next/server'
import { verificarDirectivo } from '@/lib/verificarDirectivo'
import { cargarContextoAvance, calcularAvanceDocente, obtenerApoyosConfirmados, type ContextoAvance } from '@/lib/avanceServidor'
import { CICLO_ESCOLAR_ACTIVO } from '@/lib/calendarioEscolar'

const FORMATO_CCT = /^[0-9A-Z]{10}$/

export async function GET(request: NextRequest) {
  const auth = await verificarDirectivo(request, 'panel')
  if (!auth.autorizado) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }
  const { supabaseAdmin, directivo } = auth

  try {
    const ccts = [directivo.cct_primary, directivo.cct_secondary]
      .filter((c): c is string => !!c && FORMATO_CCT.test(c))
    if (ccts.length === 0) {
      return NextResponse.json({ ciclo: CICLO_ESCOLAR_ACTIVO, docentes: [] })
    }
    const lista = ccts.join(',')

    const { data: docentes, error } = await supabaseAdmin
      .from('users')
      .select('id, full_name, avatar_url, role, grado, grupo_letra, total_alumnos, cct_primary, cct_secondary, evaluacion_individual, pdas_prioritarios, pdas_jardin')
      .or(`cct_primary.in.(${lista}),cct_secondary.in.(${lista})`)
      .neq('role', 'directivo')
      .eq('profile_completed', true)
      .order('full_name', { ascending: true })

    if (error) {
      console.error('Error al leer docentes del directivo:', error.message)
      return NextResponse.json({ error: 'No se pudieron cargar las docentes' }, { status: 500 })
    }

    // Contexto (fechas del ciclo + catálogo) una sola vez por estado.
    const contextos: Record<string, ContextoAvance> = {}
    const resultado = []

    for (const d of docentes || []) {
      const estado = String(d.cct_primary || '').slice(0, 2)
      if (!contextos[estado]) {
        contextos[estado] = await cargarContextoAvance(supabaseAdmin, estado, CICLO_ESCOLAR_ACTIVO)
      }
      const r = await calcularAvanceDocente(supabaseAdmin, d, contextos[estado])

      const alumnosConApoyos = (await obtenerApoyosConfirmados(supabaseAdmin, d.id, CICLO_ESCOLAR_ACTIVO)).length

      resultado.push({
        id: d.id,
        full_name: d.full_name,
        avatar_url: d.avatar_url ?? null,
        role: d.role,
        grado: d.grado ?? null,
        grupo_letra: d.grupo_letra ?? null,
        total_alumnos: d.total_alumnos ?? null,
        cct_primary: d.cct_primary,
        resumen: {
          pdaDistintos: r.avance.pdaDistintos,
          campos: Object.keys(r.avance.porCampo),
          planeaciones: r.planeaciones.length,
          planeacionesActivas: r.planeaciones.filter(p => p.status === 'active').length,
          ejesCubiertos: r.avance.ejes.cubiertos.length,
          prioritarios: {
            hayDiagnostico: r.prioritarios.hayDiagnostico,
            total: r.prioritarios.total,
            atendidos: r.prioritarios.atendidos,
          },
          alumnosConApoyos,
        },
      })
    }

    return NextResponse.json({ ciclo: CICLO_ESCOLAR_ACTIVO, docentes: resultado })
  } catch (e: any) {
    console.error('Error en /api/directivo/docentes:', e?.message)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
