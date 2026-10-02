// ============================================================
//  PlanIA Digital — API: Mi diario · descargas en Word
//  app/api/diario/word/route.ts
//
//  [2 oct 2026]
//  GET ?periodo=semana|mes|ciclo&filtro=todas|grupo|incidentes|AL-XX
//      → Word del diario (orden por fecha y hora, ambas horas,
//        editadas y anuladas marcadas).
//  GET ?nota=<id> → Reporte de incidente de una nota (con firmas).
//  Horas en la zona horaria del CCT. Seguridad: solo notas propias.
// ============================================================
import { NextRequest, NextResponse } from 'next/server'
import { verificarUsuario } from '@/lib/verificarUsuario'
import { zonaHorariaPorCCT } from '@/lib/fechaMexico'
import { CICLO_ESCOLAR_ACTIVO } from '@/lib/calendarioEscolar'
import { construirDiarioWord, construirIncidenteWord, type NotaWord } from '@/lib/diarioWord'

export const runtime = 'nodejs'

const sinAcentos = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9-]+/g, '_').replace(/^_+|_+$/g, '')

function formateadores(tz: string) {
  const f = (o: Intl.DateTimeFormatOptions) => (iso: string) => {
    try { return new Intl.DateTimeFormat('es-MX', { timeZone: tz, ...o }).format(new Date(iso)) }
    catch { return new Intl.DateTimeFormat('es-MX', { timeZone: 'America/Mexico_City', ...o }).format(new Date(iso)) }
  }
  const diaLargo = f({ weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  return {
    dia: (iso: string) => { const t = diaLargo(iso).replace(',', ''); return t.charAt(0).toUpperCase() + t.slice(1) },
    hora: f({ hour: 'numeric', minute: '2-digit' }),
    fechaHora: f({ day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }),
    fechaISO: (iso: string) => { try { return new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date(iso)) } catch { return iso.slice(0, 10) } },
  }
}

function archivoWord(buffer: Buffer, nombre: string) {
  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="${nombre}"`,
      'Cache-Control': 'no-store',
    },
  })
}

export async function GET(request: NextRequest) {
  const auth = await verificarUsuario(request)
  if (!auth.autorizado) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { supabaseAdmin, usuario } = auth
  if (usuario.role === 'directivo') return NextResponse.json({ error: 'Mi diario es para educadoras.' }, { status: 403 })

  try {
    const url = new URL(request.url)
    const { data: u } = await supabaseAdmin
      .from('users').select('full_name, school_name, cct_primary, grado, grupo_letra, zona, sector, region')
      .eq('id', usuario.id).single()
    const tz = zonaHorariaPorCCT(u?.cct_primary) || 'America/Mexico_City'
    const fmt = formateadores(tz)
    const grupoLargo = `${String(u?.grado ?? '').trim()} ${String(u?.grupo_letra ?? '').trim().toUpperCase()}`.trim()
    const inst = {
      jardin: u?.school_name || 'Jardín de Niños', cct: u?.cct_primary || '—',
      zona: u?.zona ?? null, sector: u?.sector ?? null, region: u?.region ?? null,
      ciclo: CICLO_ESCOLAR_ACTIVO, educadora: u?.full_name || usuario.full_name || '—', grupoLargo,
    }

    const select = 'id, destinatario, tipo, sucedido_en, registrado_en, estado, anulada_en, motivo_anulacion, version_actual'
    const aNotaWord = (n: any, versiones: any[]): NotaWord => {
      const propias = versiones.filter(v => v.nota_id === n.id).sort((a, b) => b.numero - a.numero)
      const vigente = propias.find(v => v.numero === n.version_actual)
      return {
        destinatario: n.destinatario, tipo: n.tipo,
        dia: fmt.dia(n.sucedido_en), sucedio: fmt.hora(n.sucedido_en), registrada: fmt.fechaHora(n.registrado_en),
        texto: vigente?.texto ?? '',
        editada: n.version_actual > 1 && vigente ? fmt.fechaHora(vigente.creado_en) : null,
        version: n.version_actual,
        anulada: n.estado === 'anulada' ? { fecha: n.anulada_en ? fmt.fechaHora(n.anulada_en) : '—', motivo: n.motivo_anulacion || '—' } : null,
        versiones: propias.map(v => ({ numero: v.numero, texto: v.texto, origen: v.origen, creadoEn: fmt.fechaHora(v.creado_en) })),
      }
    }

    // ── Reporte de incidente ──
    const notaId = url.searchParams.get('nota')
    if (notaId) {
      const { data: notaDb } = await supabaseAdmin.from('diario_notas').select(select + ', user_id').eq('id', notaId).maybeSingle()
      const n: any = notaDb
      if (!n || n.user_id !== usuario.id) return NextResponse.json({ error: 'Nota no encontrada.' }, { status: 404 })
      if (n.tipo !== 'incidente') return NextResponse.json({ error: 'El reporte individual es solo para incidentes.' }, { status: 400 })
      const { data: versiones } = await supabaseAdmin.from('diario_versiones').select('nota_id, numero, texto, origen, creado_en').eq('nota_id', n.id)
      const buffer = await construirIncidenteWord({ inst, nota: aNotaWord(n, versiones || []) })
      return archivoWord(buffer, `Incidente_${sinAcentos(n.destinatario)}_${fmt.fechaISO(n.sucedido_en)}.docx`)
    }

    // ── Diario completo ──
    const periodo = ['semana', 'mes', 'ciclo'].includes(String(url.searchParams.get('periodo'))) ? String(url.searchParams.get('periodo')) : 'semana'
    const filtro = String(url.searchParams.get('filtro') || 'todas')
    const hoy = fmt.fechaISO(new Date().toISOString())
    let desde = ''
    if (periodo === 'semana') {
      const d = new Date(`${hoy}T12:00:00Z`)
      d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7))
      desde = d.toISOString().slice(0, 10)
    } else if (periodo === 'mes') {
      desde = `${hoy.slice(0, 7)}-01`
    }

    const { data: todas } = await supabaseAdmin
      .from('diario_notas').select(select)
      .eq('user_id', usuario.id).eq('ciclo_escolar', CICLO_ESCOLAR_ACTIVO)
      .order('sucedido_en', { ascending: true })
    const elegidas = (todas || []).filter((n: any) => {
      if (desde && fmt.fechaISO(n.sucedido_en) < desde) return false
      if (filtro === 'grupo') return n.destinatario === 'grupo'
      if (filtro === 'incidentes') return n.tipo === 'incidente'
      if (filtro !== 'todas') return n.destinatario === filtro
      return true
    })
    const ids = elegidas.map((n: any) => n.id)
    const { data: versiones } = ids.length
      ? await supabaseAdmin.from('diario_versiones').select('nota_id, numero, texto, origen, creado_en').in('nota_id', ids)
      : { data: [] as any[] }

    const nombreFiltro = filtro === 'todas' ? 'Todas las notas' : filtro === 'grupo' ? 'Notas del grupo' : filtro === 'incidentes' ? 'Incidentes' : `Notas de ${filtro}`
    const nombrePeriodo = periodo === 'semana' ? 'esta semana' : periodo === 'mes' ? 'este mes' : `ciclo ${CICLO_ESCOLAR_ACTIVO}`
    const buffer = await construirDiarioWord({
      inst,
      descripcion: `${nombreFiltro} · ${nombrePeriodo}`,
      notas: elegidas.map((n: any) => ({ ...aNotaWord(n, versiones || []), versiones: undefined })),
    })
    return archivoWord(buffer, `Mi_diario_${sinAcentos(nombreFiltro)}_${sinAcentos(nombrePeriodo)}.docx`)
  } catch (e: any) {
    console.error('Error en GET /api/diario/word:', e?.message)
    return NextResponse.json({ error: 'No se pudo generar el Word.' }, { status: 500 })
  }
}
