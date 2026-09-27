// ============================================================
//  PlanIA Digital — API: Usar calendario federal como estatal
//  app/api/admin/calendario/usar-federal/route.ts
//  [Saneado 27 sep 2026 — Fase 2] El ciclo sale de CICLO_ESCOLAR_ACTIVO
//  (antes estaba escrito '2025-2026' en la búsqueda, el guardado y la nota).
// ============================================================
import { NextResponse } from 'next/server'
import { verificarSuperAdmin } from '@/lib/verificarSuperAdmin'
import { CICLO_ESCOLAR_ACTIVO } from '@/lib/calendarioEscolar'

export async function POST(request: Request) {
  try {
    const auth = await verificarSuperAdmin(request)
    if (!auth.autorizado) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }
    const { supabaseAdmin } = auth

    const { estado, nombreEstado, nota } = await request.json()
    if (!estado) {
      return NextResponse.json({ error: 'Falta el estado' }, { status: 400 })
    }

    // 1. Leer el calendario federal ya cargado del ciclo activo
    const { data: federalRow, error: errorLectura } = await supabaseAdmin
      .from('calendarios_sep')
      .select('datos')
      .eq('tipo', 'federal')
      .eq('estado', 'FED')
      .eq('ciclo', CICLO_ESCOLAR_ACTIVO)
      .single()

    if (errorLectura || !federalRow) {
      return NextResponse.json(
        { error: `No se encontró el calendario federal ${CICLO_ESCOLAR_ACTIVO}. Cárgalo primero antes de usar esta opción.` },
        { status: 404 }
      )
    }

    // 2. Clonar los datos del federal, marcar el origen y agregar la nota de justificación
    const datosOriginales = federalRow.datos as any
    const notaDefault = `Este estado no publicó calendario estatal propio para el ciclo ${CICLO_ESCOLAR_ACTIVO}; se usa el calendario federal sin modificaciones (Art. 87 de la Ley General de Educación: el ajuste estatal es una facultad opcional, no obligatoria).`

    const datosClonados = {
      ...datosOriginales,
      entidad: nombreEstado || datosOriginales.entidad,
      origen_calendario: 'federal_sin_cambios',
      notas: [
        ...(Array.isArray(datosOriginales.notas) ? datosOriginales.notas : []),
        nota && nota.trim() ? nota.trim() : notaDefault,
      ],
    }

    // 3. Guardar como calendario estatal de ese estado
    const { error: errorGuardado } = await supabaseAdmin
      .from('calendarios_sep')
      .upsert({
        tipo: 'estatal',
        estado,
        ciclo: CICLO_ESCOLAR_ACTIVO,
        datos: datosClonados,
        actualizado_en: new Date().toISOString(),
      }, { onConflict: 'tipo,ciclo,estado' })

    if (errorGuardado) {
      return NextResponse.json({ error: errorGuardado.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
