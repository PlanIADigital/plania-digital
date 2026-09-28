// ============================================================
//  PlanIA Digital — API: Estilos de aprendizaje del grupo
//  app/api/estilos-aprendizaje/route.ts
//
//  [Saneado 28 sep 2026 — Fase 2, Parte 10] Decisión del fundador:
//  la educadora escribe CUÁNTOS niños salieron kinestésicos, visuales y
//  auditivos en su evaluación. Se guarda SOLO el resumen del grupo (sin
//  datos por niño) en users.estilos_aprendizaje y una versión en
//  documentos_historial (sección 'estilos_aprendizaje'), igual que las
//  demás tarjetas de Mi Grupo. MÍA lo usa para calibrar la PROPORCIÓN de
//  actividades, siempre con variedad multisensorial (DUA).
//  POST body: { kinestesico, visual, auditivo }  (enteros ≥ 0)
// ============================================================
import { NextRequest, NextResponse } from 'next/server'
import { verificarUsuario } from '@/lib/verificarUsuario'
import { CICLO_ESCOLAR_ACTIVO } from '@/lib/calendarioEscolar'
import { fechaLocalISO, zonaHorariaPorCCT } from '@/lib/fechaMexico'

const SECCION_HISTORIAL = 'estilos_aprendizaje'
const MAX_ALUMNOS = 60

function entero(v: unknown): number | null {
  const n = Number(v)
  return Number.isInteger(n) && n >= 0 && n <= MAX_ALUMNOS ? n : null
}

export async function POST(request: NextRequest) {
  try {
    const auth = await verificarUsuario(request)
    if (!auth.autorizado) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }
    const { supabaseAdmin: supabase, usuario } = auth

    const body = await request.json()
    const kinestesico = entero(body?.kinestesico)
    const visual = entero(body?.visual)
    const auditivo = entero(body?.auditivo)
    if (kinestesico === null || visual === null || auditivo === null) {
      return NextResponse.json({ error: 'Escribe números enteros de 0 en adelante.' }, { status: 400 })
    }
    const total = kinestesico + visual + auditivo
    if (total === 0) {
      return NextResponse.json({ error: 'Escribe al menos un alumno en algún estilo.' }, { status: 400 })
    }
    if (total > MAX_ALUMNOS) {
      return NextResponse.json({ error: `La suma no puede pasar de ${MAX_ALUMNOS} alumnos.` }, { status: 400 })
    }

    const estilos = {
      kinestesico,
      visual,
      auditivo,
      total,
      ciclo_escolar: CICLO_ESCOLAR_ACTIVO,
      fecha: fechaLocalISO(new Date(), zonaHorariaPorCCT(usuario.cct_primary)),
    }

    const { error: saveError } = await supabase
      .from('users')
      .update({ estilos_aprendizaje: estilos })
      .eq('id', usuario.id)
    if (saveError) {
      return NextResponse.json({ error: 'No se pudo guardar: ' + saveError.message }, { status: 500 })
    }

    // Historial versionado (mismo patrón que las demás tarjetas; complementario)
    try {
      const { data: previas } = await supabase
        .from('documentos_historial')
        .select('version_numero')
        .eq('user_id', usuario.id)
        .eq('seccion', SECCION_HISTORIAL)
        .order('version_numero', { ascending: false })
        .limit(1)
      const nuevaVersion = previas && previas.length > 0 ? previas[0].version_numero + 1 : 1
      await supabase
        .from('documentos_historial')
        .update({ activo: false })
        .eq('user_id', usuario.id)
        .eq('seccion', SECCION_HISTORIAL)
        .eq('activo', true)
      const { error: historialError } = await supabase.from('documentos_historial').insert({
        user_id: usuario.id,
        seccion: SECCION_HISTORIAL,
        ciclo_escolar: CICLO_ESCOLAR_ACTIVO,
        version_numero: nuevaVersion,
        contenido: estilos,
        resumen: `Kinestésico ${kinestesico} · Visual ${visual} · Auditivo ${auditivo} (total ${total})`,
        archivo_formato: 'captura',
        activo: true,
      })
      if (historialError) console.error('Error guardando historial de estilos:', historialError)
    } catch (e) {
      console.error('Error inesperado en historial de estilos (no crítico):', e)
    }

    return NextResponse.json({ ok: true, estilos })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
