// ============================================================
//  PlanIA Digital — API: Excel del semáforo del jardín (directivo)
//  app/api/directivo/semaforo/excel/route.ts
//
//  [2 oct 2026] GET ?momento=m1 → archivo .xlsx con:
//   1) CONCENTRADO: por grupo enviado, subtotales por grado, total del
//      jardín y porcentajes; lista de grupos que aún no envían.
//   2) Una hoja por grupo ENVIADO: No. · Código · Nombre(s) · Apellido
//      paterno · Apellido materno (VACÍAS: los nombres nunca pasan por
//      PlanIA; se escriben después en la computadora de quien descarga)
//      + nivel por área con su color pastel y totales.
//  Solo cuenta grupos que ENVIARON (datos oficiales).
//  Seguridad: verificarDirectivo(request, 'panel'); docentes de sus CCT.
//  Librería: write-excel-file (v4, genera en memoria con toBuffer()).
// ============================================================
import { NextRequest, NextResponse } from 'next/server'
import writeExcelFile from 'write-excel-file/node'
import { verificarDirectivo } from '@/lib/verificarDirectivo'
import { zonaHorariaPorCCT } from '@/lib/fechaMexico'
import { CICLO_ESCOLAR_ACTIVO } from '@/lib/calendarioEscolar'
import { MOMENTOS, NIVELES, esMomento, momentoSugerido } from '@/lib/semaforo'
import { areasDelMomento } from '@/lib/semaforoServidor'

const FORMATO_CCT = /^[0-9A-Z]{10}$/
const FONDO_ENCABEZADO = '#EEEDF8'
type Conteo = Record<string, number>
const vacio = (): Conteo => Object.fromEntries(NIVELES.map(n => [n.clave, 0]))
const total = (c: Conteo) => Object.values(c).reduce((s, n) => s + n, 0)
const pct = (n: number, t: number) => (t > 0 ? Math.round((n / t) * 100) : 0)

function hoyEn(tz: string): string {
  try { return new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date()) }
  catch { return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' }).format(new Date()) }
}
function gradoCorto(g: string | null): string {
  const m = String(g || '').match(/[1-3]/)
  return m ? `${m[0]}°` : String(g || '')
}
const numero = (c: string) => { const m = String(c || '').match(/(\d+)$/); return m ? parseInt(m[1], 10) : 0 }
const titulo = (value: string, span: number) => [{ value, fontWeight: 'bold' as const, columnSpan: span }, ...Array(span - 1).fill(null)]
const texto = (value: string, span: number) => [{ value, columnSpan: span }, ...Array(span - 1).fill(null)]
const encabezado = (value: string) => ({ value, fontWeight: 'bold' as const, backgroundColor: FONDO_ENCABEZADO })

export async function GET(request: NextRequest) {
  const auth = await verificarDirectivo(request, 'panel')
  if (!auth.autorizado) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { supabaseAdmin, directivo } = auth

  try {
    const hoy = hoyEn(zonaHorariaPorCCT(directivo.cct_primary) || 'America/Mexico_City')
    const pedido = new URL(request.url).searchParams.get('momento')
    const momento = esMomento(pedido) ? pedido : momentoSugerido(hoy)
    const nombreMomento = MOMENTOS.find(m => m.clave === momento)?.nombre || momento
    const areas = await areasDelMomento(supabaseAdmin, directivo.cct_primary, CICLO_ESCOLAR_ACTIVO, momento)

    const { data: yo } = await supabaseAdmin.from('users').select('school_name, cct_primary').eq('id', directivo.id).maybeSingle()
    const jardin = yo?.school_name || 'Jardín de Niños'
    const cct = yo?.cct_primary || directivo.cct_primary || ''

    const ccts = [directivo.cct_primary, directivo.cct_secondary].filter((c): c is string => !!c && FORMATO_CCT.test(c))
    if (ccts.length === 0) return NextResponse.json({ error: 'Tu cuenta no tiene un CCT válido.' }, { status: 400 })
    const lista = ccts.join(',')

    const { data: docentes } = await supabaseAdmin
      .from('users').select('id, full_name, grado, grupo_letra')
      .or(`cct_primary.in.(${lista}),cct_secondary.in.(${lista})`)
      .neq('role', 'directivo').eq('profile_completed', true)
    const conGrupo = (docentes || []).filter((d: any) => !!d.grado)
      .map((d: any) => ({ ...d, etiqueta: `${gradoCorto(d.grado)}${d.grupo_letra ? ` ${d.grupo_letra}` : ''}` }))
      .sort((a: any, b: any) => a.etiqueta.localeCompare(b.etiqueta, 'es'))
    const ids = conGrupo.map((d: any) => d.id)
    if (ids.length === 0) return NextResponse.json({ error: 'Aún no hay grupos configurados en tu jardín.' }, { status: 400 })

    const [{ data: alumnos }, { data: regs }, { data: envios }] = await Promise.all([
      supabaseAdmin.from('alumnos_codigo').select('user_id, codigo').in('user_id', ids).eq('ciclo_escolar', CICLO_ESCOLAR_ACTIVO).eq('activo', true),
      supabaseAdmin.from('semaforo_registros').select('user_id, area, alumno_codigo, nivel').in('user_id', ids).eq('ciclo_escolar', CICLO_ESCOLAR_ACTIVO).eq('momento', momento),
      supabaseAdmin.from('semaforo_envios').select('user_id').in('user_id', ids).eq('ciclo_escolar', CICLO_ESCOLAR_ACTIVO).eq('momento', momento),
    ])
    const enviados = new Set((envios || []).map((e: any) => e.user_id))
    const gruposEnviados = conGrupo.filter((d: any) => enviados.has(d.id))
    const pendientes = conGrupo.filter((d: any) => !enviados.has(d.id))
    if (gruposEnviados.length === 0) {
      return NextResponse.json({ error: 'Aún ningún grupo ha enviado su semáforo de este momento.' }, { status: 400 })
    }

    // marcas[docente][area][codigo] = nivel
    const marcas: Record<string, Record<string, Record<string, string>>> = {}
    for (const r of regs || []) {
      ((marcas[r.user_id] ||= {})[r.area] ||= {})[r.alumno_codigo] = r.nivel
    }
    const codigosDe: Record<string, string[]> = {}
    for (const a of alumnos || []) (codigosDe[a.user_id] ||= []).push(a.codigo)
    for (const k of Object.keys(codigosDe)) codigosDe[k].sort((a, b) => numero(a) - numero(b))
    const conteoDe = (userId: string, area: string): Conteo => {
      const c = vacio()
      for (const codigo of codigosDe[userId] || []) {
        const n = marcas[userId]?.[area]?.[codigo]
        if (n && c[n] !== undefined) c[n]++
      }
      return c
    }

    // ===== Hoja CONCENTRADO =====
    const anchoC = 2 + areas.length * NIVELES.length
    const filaGrupo = (etiqueta: string, educadora: string, conteos: Conteo[], fuerte = false) => [
      { value: etiqueta, fontWeight: fuerte ? 'bold' as const : undefined },
      { value: educadora, fontWeight: fuerte ? 'bold' as const : undefined },
      ...conteos.flatMap(c => NIVELES.map(n => ({ value: c[n.clave], type: Number, fontWeight: fuerte ? 'bold' as const : undefined, align: 'center' as const }))),
    ]
    const concentrado: any[] = [
      titulo(jardin, anchoC),
      texto(`CCT ${cct} · Ciclo escolar ${CICLO_ESCOLAR_ACTIVO}`, anchoC),
      texto(`Semáforo de desempeño · ${nombreMomento} · CONCENTRADO`, anchoC),
      Array(anchoC).fill(null),
      [encabezado('Grupo'), encabezado('Educadora'), ...areas.flatMap(a => [{ ...encabezado(a), columnSpan: NIVELES.length, align: 'center' as const }, ...Array(NIVELES.length - 1).fill(null)])],
      [encabezado(''), encabezado(''), ...areas.flatMap(() => NIVELES.map(n => ({ value: n.corto === '—' ? 'NE' : n.corto, fontWeight: 'bold' as const, backgroundColor: n.fondo, align: 'center' as const })))],
    ]
    const totalJardin = areas.map(() => vacio())
    const grados = Array.from(new Set(gruposEnviados.map((d: any) => gradoCorto(d.grado)))).sort()
    for (const grado of grados) {
      const delGrado = gruposEnviados.filter((d: any) => gradoCorto(d.grado) === grado)
      const subtotal = areas.map(() => vacio())
      for (const d of delGrado) {
        const conteos = areas.map(a => conteoDe(d.id, a))
        conteos.forEach((c, i) => { for (const k of Object.keys(c)) { subtotal[i][k] += c[k]; totalJardin[i][k] += c[k] } })
        concentrado.push(filaGrupo(d.etiqueta, d.full_name || '', conteos))
      }
      if (delGrado.length > 1) concentrado.push(filaGrupo(`Total ${grado}`, '', subtotal, true))
    }
    concentrado.push(filaGrupo('TOTAL JARDÍN', '', totalJardin, true))
    concentrado.push([
      { value: '% del jardín', fontWeight: 'bold' as const }, null,
      ...totalJardin.flatMap(c => NIVELES.map(n => ({ value: `${pct(c[n.clave], total(c))}%`, fontWeight: 'bold' as const, align: 'center' as const }))),
    ])
    concentrado.push(Array(anchoC).fill(null))
    concentrado.push(texto('S = Suficiente · ED = En desarrollo · RA = Requiere apoyo · NE = No evaluado', anchoC))
    if (pendientes.length > 0) {
      concentrado.push(texto(`Grupos que aún no envían este momento: ${pendientes.map((d: any) => `${d.etiqueta} (${d.full_name || ''})`).join(', ')}`, anchoC))
    }
    concentrado.push(texto('Generado con PlanIA Digital. PlanIA Digital no es una entidad afiliada, patrocinada ni respaldada por la SEP.', anchoC))

    // ===== Una hoja por grupo enviado =====
    const nombresUsados = new Set<string>(['CONCENTRADO'])
    const hojasGrupo = gruposEnviados.map((d: any) => {
      let nombre = d.etiqueta.replace(/[:\\/?*\[\]]/g, '').slice(0, 28)
      for (let i = 2; nombresUsados.has(nombre); i++) nombre = `${d.etiqueta.slice(0, 25)} (${i})`
      nombresUsados.add(nombre)
      const ancho = 5 + areas.length
      const filas: any[] = [
        titulo(jardin, ancho),
        texto(`CCT ${cct} · Ciclo escolar ${CICLO_ESCOLAR_ACTIVO}`, ancho),
        texto(`Educadora: ${d.full_name || ''}`, ancho),
        texto(`Grado y grupo: ${d.etiqueta} · Período: ${nombreMomento}`, ancho),
        Array(ancho).fill(null),
        [encabezado('No.'), encabezado('Código'), encabezado('Nombre(s)'), encabezado('Apellido paterno'), encabezado('Apellido materno'), ...areas.map(a => encabezado(a))],
      ]
      ;(codigosDe[d.id] || []).forEach((codigo, i) => {
        filas.push([
          { value: i + 1, type: Number, align: 'center' as const },
          { value: codigo, fontWeight: 'bold' as const },
          { value: '' }, { value: '' }, { value: '' },
          ...areas.map(a => {
            const n = NIVELES.find(x => x.clave === marcas[d.id]?.[a]?.[codigo])
            return n ? { value: n.nombre, backgroundColor: n.fondo, color: n.texto, align: 'center' as const } : { value: '' }
          }),
        ])
      })
      filas.push(Array(ancho).fill(null))
      for (const n of NIVELES) {
        filas.push([
          { value: `Total ${n.nombre}`, fontWeight: 'bold' as const, columnSpan: 5 }, null, null, null, null,
          ...areas.map(a => { const c = conteoDe(d.id, a); return { value: `${c[n.clave]} (${pct(c[n.clave], total(c))}%)`, backgroundColor: n.fondo, color: n.texto, align: 'center' as const } }),
        ])
      }
      return {
        sheet: nombre,
        data: filas,
        columns: [{ width: 6 }, { width: 10 }, { width: 18 }, { width: 18 }, { width: 18 }, ...areas.map(() => ({ width: 20 }))],
      }
    })

    const buffer = await writeExcelFile([
      { sheet: 'CONCENTRADO', data: concentrado, columns: [{ width: 14 }, { width: 28 }, ...Array(areas.length * NIVELES.length).fill({ width: 6 })] },
      ...hojasGrupo,
    ] as any).toBuffer()

    const archivo = `Semaforo_${nombreMomento.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9]+/g, '_')}_${cct}_${CICLO_ESCOLAR_ACTIVO}.xlsx`
    return new NextResponse(buffer as any, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${archivo}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (e: any) {
    console.error('Error en /api/directivo/semaforo/excel:', e?.message)
    return NextResponse.json({ error: 'No se pudo generar el archivo.' }, { status: 500 })
  }
}
