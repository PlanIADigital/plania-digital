// ============================================================
//  PlanIA Digital — API: Fechas de inicio y fin de clases por estado
//  app/api/calendario/fin-ciclo/route.ts
//
//  [Saneado 26 sep 2026 — Fase 1, Mi Avance]
//  Contrato de respuesta: { inicioClases: string | null, finClases: string | null }
//  (fechas YYYY-MM-DD del calendario estatal; null si no hay dato).
//  Se agregó inicioClases para que Mi Avance cuente solo planeaciones
//  dentro del ciclo real. finClases se conserva igual (compatibilidad).
//
//  Corre en el servidor con la llave de servicio — necesario porque
//  "calendarios_sep" tiene RLS activado (relrowsecurity = true) sin
//  ninguna política definida, así que cualquier consulta directa desde
//  el navegador (rol anon/authenticated) recibe 0 filas en silencio,
//  sin error. Este endpoint entrega ÚNICAMENTE las fechas de inicio y
//  fin de clases del estado solicitado — nunca el resto de los datos
//  administrativos de esa tabla.
// ============================================================
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { CICLO_ESCOLAR_ACTIVO } from '@/lib/calendarioEscolar'

const SIN_DATOS = { inicioClases: null, finClases: null }

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const estado = searchParams.get('estado')
    const ciclo = searchParams.get('ciclo') || CICLO_ESCOLAR_ACTIVO
    if (!estado) {
      return NextResponse.json({ error: 'Falta estado' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('calendarios_sep')
      .select('datos')
      .eq('ciclo', ciclo)
      .eq('tipo', 'estatal')
      .eq('estado', estado)
      .maybeSingle()

    if (error) {
      console.error(`Error al leer fechas de ciclo para estado "${estado}":`, error.message)
      return NextResponse.json(SIN_DATOS)
    }
    return NextResponse.json({
      inicioClases: data?.datos?.inicio_clases || null,
      finClases: data?.datos?.fin_clases || null,
    })
  } catch {
    return NextResponse.json(SIN_DATOS)
  }
}
