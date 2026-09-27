// ============================================================
//  PlanIA Digital — API: Detalle de una docente para el directivo
//  app/api/directivo/docentes/[id]/route.ts
//
//  [Saneado 27 sep 2026 — Fase 1, infraestructura del directivo]
//  GET → avance COMPLETO del ciclo activo de una docente (mismas
//  funciones que Mi Avance), prioritarios por etiqueta, planeaciones
//  que cuentan y alumnos con NEE (solo código de referencia, NEE y
//  observaciones; nunca nombres).
//  Seguridad: verificarDirectivo(request, 'panel') + la docente debe
//  compartir CCT con el directivo (compartenCct). Cambiar el id en la
//  URL para ver a una docente de otro jardín devuelve 404.
//  El id se toma de la URL (compatible con cualquier versión de Next).
// ============================================================
import { NextRequest, NextResponse } from 'next/server'
import { verificarDirectivo, compartenCct } from '@/lib/verificarDirectivo'
import { cargarContextoAvance, calcularAvanceDocente } from '@/lib/avanceServidor'
import { CICLO_ESCOLAR_ACTIVO } from '@/lib/calendarioEscolar'

const FORMATO_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET(request: NextRequest) {
  const auth = await verificarDirectivo(request, 'panel')
  if (!auth.autorizado) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }
  const { supabaseAdmin, directivo } = auth

  try {
    const partes = new URL(request.url).pathname.split('/').filter(Boolean)
    const docenteId = partes[partes.length - 1] || ''
    if (!FORMATO_UUID.test(docenteId)) {
      return NextResponse.json({ error: 'Identificador inválido' }, { status: 400 })
    }

    const { data: d } = await supabaseAdmin
      .from('users')
      .select('id, full_name, role, grado, grupo_letra, total_alumnos, cct_primary, cct_secondary, profile_completed, evaluacion_individual, pdas_prioritarios, pdas_jardin')
      .eq('id', docenteId)
      .maybeSingle()

    // Misma respuesta si no existe o si no es de su jardín: no se revela
    // la existencia de docentes de otros CCT.
    if (!d || d.role === 'directivo' || !d.profile_completed || !compartenCct(directivo, d)) {
      return NextResponse.json({ error: 'Docente no encontrada' }, { status: 404 })
    }

    const estado = String(d.cct_primary || '').slice(0, 2)
    const ctx = await cargarContextoAvance(supabaseAdmin, estado, CICLO_ESCOLAR_ACTIVO)
    const r = await calcularAvanceDocente(supabaseAdmin, d, ctx)

    const alumnos = Array.isArray(d.evaluacion_individual?.alumnos) ? d.evaluacion_individual.alumnos : []
    const alumnosConNee = alumnos
      .filter((a: any) => Array.isArray(a?.nee) && a.nee.length > 0)
      .map((a: any) => ({
        referencia: a.referencia ?? null,
        nee: a.nee,
        observaciones: a.observaciones ?? null,
      }))

    return NextResponse.json({
      ciclo: CICLO_ESCOLAR_ACTIVO,
      periodo: ctx.periodo,
      docente: {
        id: d.id,
        full_name: d.full_name,
        role: d.role,
        grado: d.grado ?? null,
        grupo_letra: d.grupo_letra ?? null,
        total_alumnos: d.total_alumnos ?? null,
        cct_primary: d.cct_primary,
      },
      avance: r.avance,
      prioritarios: r.prioritarios,
      planeaciones: r.planeaciones,
      alumnosConNee,
    })
  } catch (e: any) {
    console.error('Error en /api/directivo/docentes/[id]:', e?.message)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
