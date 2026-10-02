// ============================================================
//  PlanIA Digital — API: Word del Semáforo (educadora)
//  app/api/semaforo/word/route.ts
//
//  [2 oct 2026] GET ?momento=diagnostico → .docx imprimible del
//  semáforo de SU grupo en ese momento (enviado o en captura).
//  Seguridad: verificarUsuario; solo su lista activa del ciclo.
//  Solo códigos AL-XX: la columna de nombre va vacía.
// ============================================================
import { NextRequest, NextResponse } from 'next/server'
import { verificarUsuario } from '@/lib/verificarUsuario'
import { zonaHorariaPorCCT } from '@/lib/fechaMexico'
import { CICLO_ESCOLAR_ACTIVO } from '@/lib/calendarioEscolar'
import { MOMENTOS, NIVELES, esMomento } from '@/lib/semaforo'
import { areasDelMomento } from '@/lib/semaforoServidor'
import { construirSemaforoWord } from '@/lib/semaforoWord'

export const runtime = 'nodejs'

const numero = (c: string) => { const m = String(c || '').match(/(\d+)$/); return m ? parseInt(m[1], 10) : 0 }
const sinAcentos = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '')

function gradoCorto(grado: any, letra: any): string {
  const g = String(grado ?? '').toLowerCase()
  const dig = g.match(/\d/)?.[0]
    ?? (g.includes('prim') ? '1' : g.includes('seg') ? '2' : g.includes('terc') ? '3' : '')
  const l = String(letra ?? '').trim().toUpperCase()
  return [dig ? `${dig}°` : String(grado ?? '').trim(), l].filter(Boolean).join(' ') || 'Grupo'
}

function fechaLarga(iso: string, tz: string): string {
  try {
    return new Intl.DateTimeFormat('es-MX', { timeZone: tz, day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(iso))
  } catch {
    return iso.slice(0, 10)
  }
}

export async function GET(request: NextRequest) {
  const auth = await verificarUsuario(request)
  if (!auth.autorizado) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { supabaseAdmin, usuario } = auth
  if (usuario.role === 'directivo') return NextResponse.json({ error: 'No aplica para directivos' }, { status: 403 })

  try {
    const pedido = new URL(request.url).searchParams.get('momento')
    if (!esMomento(pedido)) return NextResponse.json({ error: 'Momento no válido' }, { status: 400 })
    const momento = pedido
    const infoMomento = MOMENTOS.find(m => m.clave === momento)!

    const { data: u } = await supabaseAdmin
      .from('users').select('full_name, school_name, cct_primary, grado, grupo_letra, zona, sector, region').eq('id', usuario.id).single()

    const { data: alumnosDb } = await supabaseAdmin
      .from('alumnos_codigo').select('codigo')
      .eq('user_id', usuario.id).eq('ciclo_escolar', CICLO_ESCOLAR_ACTIVO).eq('activo', true)
    const alumnos: string[] = (alumnosDb || []).map((a: any) => a.codigo).filter(Boolean)
      .sort((a: string, b: string) => numero(a) - numero(b))
    if (alumnos.length === 0) {
      return NextResponse.json({ error: 'Primero registra la lista de tu grupo en Mi grupo.' }, { status: 400 })
    }

    const areas = await areasDelMomento(supabaseAdmin, u?.cct_primary, CICLO_ESCOLAR_ACTIVO, momento)
    const { data: regs } = await supabaseAdmin
      .from('semaforo_registros').select('area, alumno_codigo, nivel')
      .eq('user_id', usuario.id).eq('ciclo_escolar', CICLO_ESCOLAR_ACTIVO).eq('momento', momento)
    const marcas: Record<string, Record<string, string>> = {}
    for (const a of areas) marcas[a] = {}
    for (const x of regs || []) {
      if (marcas[x.area] && alumnos.includes(x.alumno_codigo)) marcas[x.area][x.alumno_codigo] = x.nivel
    }
    if (!(regs || []).length) {
      return NextResponse.json({ error: 'Aún no hay capturas en este momento.' }, { status: 400 })
    }

    const { data: envio } = await supabaseAdmin
      .from('semaforo_envios').select('enviado_en')
      .eq('user_id', usuario.id).eq('ciclo_escolar', CICLO_ESCOLAR_ACTIVO).eq('momento', momento).maybeSingle()

    const tz = zonaHorariaPorCCT(u?.cct_primary) || 'America/Mexico_City'
    const grupo = gradoCorto(u?.grado, u?.grupo_letra)
    const buffer = await construirSemaforoWord({
      jardin: u?.school_name || 'Jardín de Niños',
      cct: u?.cct_primary || '—',
      zona: u?.zona ?? null,
      sector: u?.sector ?? null,
      region: u?.region ?? null,
      ciclo: CICLO_ESCOLAR_ACTIVO,
      educadora: u?.full_name || usuario.full_name || '—',
      gradoTexto: String(u?.grado ?? '').trim(),
      grupoLetra: String(u?.grupo_letra ?? '').trim().toUpperCase(),
      grupoCorto: grupo,
      momentoNombre: infoMomento.nombre,
      momentoCuando: infoMomento.cuando,
      enviadoEn: envio?.enviado_en ? fechaLarga(envio.enviado_en, tz) : null,
      alumnos,
      areas,
      marcas,
      niveles: NIVELES,
    })

    const archivo = `Semaforo_${sinAcentos(infoMomento.nombre)}_${sinAcentos(grupo)}_${CICLO_ESCOLAR_ACTIVO}.docx`
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${archivo}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (e: any) {
    console.error('Error en GET /api/semaforo/word:', e?.message)
    return NextResponse.json({ error: 'No se pudo generar el Word.' }, { status: 500 })
  }
}
