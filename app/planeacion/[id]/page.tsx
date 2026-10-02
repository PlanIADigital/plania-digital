'use client'
import React from 'react'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { useRouter, useParams } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import EncabezadoPagina from '@/components/EncabezadoPagina'
import { CICLO_ESCOLAR_ACTIVO } from '@/lib/calendarioEscolar'
import { colorCampo, chipCampo } from '@/lib/coloresCampos'

const supabase = createClient()

// Paleta PlanIA
const C = {
  indigo: '#3D3A8C',
  cian: '#00A896',
  menta: '#E8F5F2',
  indigoClaro: '#EEEDF8',
  texto: '#1A1A2E',
  gris: '#6B7280',
  borde: '#E0DFF5',
}

// [jul 2026] Mismo prefijo de 3 letras usado en Mi Avance — para poder
// mostrar el código real (LEN-1, SPC-14, etc.) de cada PDA.
const PREFIJO_POR_CAMPO: Record<string, string> = {
  'Lenguajes': 'LEN',
  'Saberes y Pensamiento Científico': 'SPC',
  'Ética, Naturaleza y Sociedades': 'ENS',
  'De lo Humano y lo Comunitario': 'DHC',
}

// [oct 2026] Niveles del instrumento con el semáforo que las educadoras
// reconocen (verde / hueso-ámbar / rojo), en tonos suaves con franja
// lateral: se lee el nivel sin que parezca alarma.
const ESTILO_POR_NIVEL: Record<string, { color: string; fondo: string; borde: string }> = {
  'Logrado': { color: '#0F6E56', fondo: '#E6F6F2', borde: '#00A896' },
  'En proceso': { color: '#8A6516', fondo: '#FBF5E6', borde: '#D9A62E' },
  'Requiere apoyo': { color: '#9B2C2F', fondo: '#FCEDED', borde: '#E46A6D' },
}

const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
function fechaCorta(iso?: string | null): string {
  if (!iso) return ''
  const [, m, d] = String(iso).slice(0, 10).split('-').map(Number)
  if (!m || !d) return String(iso)
  return `${d} ${MESES_CORTOS[m - 1]}`
}

const st = {
  card: { background: 'white', borderRadius: 12, border: `1px solid ${C.borde}`, padding: '16px 18px', marginBottom: 12 },
  titulo: { fontSize: 13, fontWeight: 700, color: C.indigo, textTransform: 'uppercase' as const, letterSpacing: '0.08em', margin: '0 0 14px' },
  tituloSeccion: { fontSize: 13, fontWeight: 700, color: C.indigo, textTransform: 'uppercase' as const, letterSpacing: '0.08em', margin: '24px 0 10px' },
  etiqueta: { fontSize: 11, fontWeight: 700, color: C.gris, textTransform: 'uppercase' as const, letterSpacing: '0.06em', margin: '0 0 4px' },
  valor: { fontSize: 15, color: C.texto, lineHeight: 1.6, margin: 0, overflowWrap: 'anywhere' as const },
  chip: { display: 'inline-block', fontSize: 12, fontWeight: 700, padding: '4px 10px', borderRadius: 12, lineHeight: 1.3 },
  linkGris: { background: 'none', border: 'none', padding: 0, color: C.gris, fontSize: 13, textDecoration: 'underline', cursor: 'pointer' },
}

type Segmento = { codigo: string | null; texto: string }

function Fila({ etiqueta, children, ultima }: { etiqueta: string; children: React.ReactNode; ultima?: boolean }) {
  return (
    <div style={{ marginBottom: ultima ? 0 : 14 }}>
      <p style={st.etiqueta}>{etiqueta}</p>
      <div style={st.valor}>{children}</div>
    </div>
  )
}

function BloqueCampo({ tipo, campo, contenido, pdas, indicadores }: {
  tipo: string; campo: string; contenido?: string; pdas: Segmento[]; indicadores: Segmento[]
}) {
  const color = colorCampo(campo)
  const chip = chipCampo(campo)
  return (
    <div style={{ borderLeft: `4px solid ${color.base}`, background: '#FAFAFE', borderRadius: 10, padding: '12px 14px', marginBottom: 12 }}>
      <p style={st.etiqueta}>{tipo}</p>
      <div style={{ marginBottom: 12 }}>
        <span style={{ ...st.chip, background: chip.bg, color: chip.color }}>{campo}</span>
      </div>
      {contenido && <Fila etiqueta="Contenido" ultima={pdas.length === 0 && indicadores.length === 0}>{contenido}</Fila>}
      {pdas.length > 0 && (
        <Fila etiqueta="PDA" ultima={indicadores.length === 0}>
          {pdas.map((p, i) => (
            <p key={i} style={{ margin: i === 0 ? 0 : '8px 0 0' }}>
              {p.codigo && <strong style={{ color: color.texto }}>{p.codigo} — </strong>}{p.texto}
            </p>
          ))}
        </Fila>
      )}
      {indicadores.length > 0 && (
        <Fila etiqueta={indicadores.length > 1 ? 'Indicadores' : 'Indicador'} ultima>
          {indicadores.map((p, i) => (
            <p key={i} style={{ margin: i === 0 ? 0 : '8px 0 0' }}>
              {p.codigo && <strong style={{ color: color.texto }}>{p.codigo} — </strong>}{p.texto}
            </p>
          ))}
        </Fila>
      )}
    </div>
  )
}

function Momento({ etiqueta, texto }: { etiqueta: string; texto?: string }) {
  if (!texto) return null
  return (
    <div style={{ marginBottom: 14 }}>
      <p style={{ ...st.etiqueta, color: C.cian }}>{etiqueta}</p>
      <p style={{ ...st.valor, whiteSpace: 'pre-wrap' as const }}>{texto}</p>
    </div>
  )
}

export default function VerPlaneacionPage() {
  const router = useRouter()
  const params = useParams()
  const [profile, setProfile] = useState<any>(null)
  const [planeacion, setPlaneacion] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  // [jul 2026] Mapa id de pda_catalog -> posicion_campo, para construir
  // el código real (LEN-1, SPC-14...) de cada PDA de esta planeación.
  const [posicionesPorId, setPosicionesPorId] = useState<Record<string, number>>({})
  const [authUid, setAuthUid] = useState<string>('')
  const [guardandoCodigo, setGuardandoCodigo] = useState<string>('')
  const [rubricasDB, setRubricasDB] = useState<any[]>([])
  const [exportando, setExportando] = useState(false)
  const [descartando, setDescartando] = useState(false)
  // [2 oct 2026] Modo lectura del directivo: nombre de la docente dueña.
  const [docenteNombre, setDocenteNombre] = useState('')
  void authUid; void guardandoCodigo; void setGuardandoCodigo

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/auth/login'); return }
      setAuthUid(session.user.id)
      const { data: userData } = await supabase.from('users').select('*').eq('auth_uid', session.user.id).single()
      if (!userData) { router.push('/auth/login'); return }
      setProfile(userData)
      // [2 oct 2026] El directivo no puede leer plannings desde el navegador (RLS):
      // la pide al servidor, que verifica que la docente sea de su CCT.
      if (userData.role === 'directivo') {
        try {
          const res = await fetch(`/api/directivo/planeaciones/${encodeURIComponent(String(params.id))}`, {
            headers: { Authorization: `Bearer ${session.access_token}` },
          })
          const d = await res.json()
          if (!res.ok) { setError(d?.error || 'No se encontró la planeación'); setLoading(false); return }
          setPlaneacion(d.planeacion)
          setRubricasDB(d.rubricas || [])
          setPosicionesPorId(d.posiciones || {})
          setDocenteNombre(d.docente?.full_name || '')
        } catch {
          setError('No se pudo conectar con el servidor. Intenta de nuevo.')
        }
        setLoading(false)
        return
      }
      const { data, error: err } = await supabase.from('plannings').select('*').eq('id', params.id).single()
      if (err || !data) { setError('No se encontró la planeación'); setLoading(false); return }
      setPlaneacion(data)
      const { data: rubricasData } = await supabase
        .from('rubrics')
        .select('*')
        .eq('planning_id', params.id)
        .eq('descartada', false)
        .order('created_at', { ascending: true })
      setRubricasDB(rubricasData || [])
      const idsPDA: string[] = [data.pda_id, data.pda_2_id, data.transversal_1_id, data.transversal_2_id, data.transversal_3_id]
        .filter((id): id is string => !!id)
      if (idsPDA.length > 0) {
        const { data: catalogo } = await supabase
          .from('pda_catalog')
          .select('id, posicion_campo')
          .in('id', idsPDA)
        const mapa: Record<string, number> = {}
        ;(catalogo || []).forEach((r: any) => { mapa[r.id] = r.posicion_campo })
        setPosicionesPorId(mapa)
      }

      setLoading(false)
    }
    load()
  }, [params.id, router])

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: C.menta }}>
      <p style={{ color: C.indigo, fontSize: 15 }}>Cargando planeación...</p>
    </div>
  )

  if (error) return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, background: C.menta, padding: 16 }}>
      <p style={{ color: C.indigo, fontSize: 15, margin: 0 }}>{error}</p>
      <button onClick={() => router.push(profile?.role === 'directivo' ? '/directivo/docentes' : '/mis-planeaciones')} style={{ background: C.indigo, color: 'white', border: 'none', padding: '10px 18px', borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>{profile?.role === 'directivo' ? 'Ir a Mis docentes' : 'Ir a Mis planeaciones'}</button>
    </div>
  )

  const content = planeacion?.content_json || planeacion?.content || {}
  const dias: any[] = content.dias || []
  const diasEspeciales: any[] = content.dias_especiales || []
  // [ago 2026] Las rúbricas viven en la tabla `rubrics`. Respaldo a
  // content.instrumentos_evaluacion / instrumento_evaluacion solo para
  // planeaciones anteriores a esa migración.
  const instrumentosEvaluacion: any[] = rubricasDB.length > 0
    ? rubricasDB.map(r => ({ ...r.content_json, _rubricaId: r.id }))
    : (Array.isArray(content.instrumentos_evaluacion) ? content.instrumentos_evaluacion : (content.instrumento_evaluacion ? [content.instrumento_evaluacion] : []))
  const rubricaLegacy = instrumentosEvaluacion.length === 0 ? (content.rubrica || null) : null
  // [2 oct 2026] El directivo SOLO VE: sin descargar, descartar ni editar.
  const soloLectura = profile?.role === 'directivo'

  function codigoPDA(campo: string | null, id: string | null): string | null {
    if (!campo || !id) return null
    const prefijo = PREFIJO_POR_CAMPO[campo]
    const posicion = posicionesPorId[id]
    if (!prefijo || posicion == null) return null
    return `${prefijo}-${posicion}`
  }

  // Segmentos de PDA: principal primero, luego el 2º PDA del principal
  // (si existe) y después cada transversal activo.
  const segmentosPDA: Segmento[] = []
  if (planeacion.pda_literal) {
    segmentosPDA.push({ codigo: codigoPDA(planeacion.pda_campo, planeacion.pda_id), texto: planeacion.pda_literal })
  }
  if (planeacion.pda_2_activo && planeacion.pda_2_pda) {
    segmentosPDA.push({ codigo: codigoPDA(planeacion.pda_campo, planeacion.pda_2_id), texto: planeacion.pda_2_pda })
  }
  ;[1, 2, 3].forEach(n => {
    const activo = planeacion[`transversal_${n}_activo`]
    const pdaTexto = planeacion[`transversal_${n}_pda`]
    if (activo && pdaTexto) {
      segmentosPDA.push({
        codigo: codigoPDA(planeacion[`transversal_${n}_campo`], planeacion[`transversal_${n}_id`]),
        texto: pdaTexto,
      })
    }
  })
  // [sep 2026] Indicador por PDA — se lee de content_json para que
  // descartar una rúbrica no borre su indicador.
  const instrumentosOriginales: any[] = Array.isArray(content.instrumentos_evaluacion) ? content.instrumentos_evaluacion : []
  function indicadorDe(pdaTexto: string | null | undefined): string {
    if (!pdaTexto) return ''
    const encontrado = instrumentosOriginales.find((i: any) => i?.pda_evaluado === pdaTexto)
    return encontrado?.indicador || ''
  }
  // [sep 2026] Ambos PDA del principal en un solo pdaTexto separado por " | "
  // (exportar-word los pinta cada uno con su código).
  const pdaTextoPrincipalCompleto = [segmentosPDA[0], planeacion.pda_2_activo ? segmentosPDA[1] : null]
    .filter((s): s is Segmento => !!s)
    .map(s => s.codigo ? `${s.codigo} — ${s.texto}` : s.texto)
    .join(' | ')

  const tablaCurricularParaWord = [
    {
      campo: planeacion.pda_campo || '',
      contenido: planeacion.pda_contenido || '',
      pdaCodigo: segmentosPDA[0]?.codigo || null,
      pdaTexto: pdaTextoPrincipalCompleto,
      indicador: [segmentosPDA[0], planeacion.pda_2_activo ? segmentosPDA[1] : null]
        .filter((s): s is Segmento => !!s && !!indicadorDe(s.texto))
        .map(s => s.codigo ? `${s.codigo} — ${indicadorDe(s.texto)}` : indicadorDe(s.texto))
        .join(' | '),
    },
    ...[1, 2, 3].map(n => {
      const activo = planeacion[`transversal_${n}_activo`]
      const campo = planeacion[`transversal_${n}_campo`]
      if (!activo || !campo) return null
      return {
        campo,
        contenido: planeacion[`transversal_${n}_contenido`] || '',
        pdaCodigo: codigoPDA(campo, planeacion[`transversal_${n}_id`]),
        pdaTexto: planeacion[`transversal_${n}_pda`] || '',
        indicador: (() => {
          const ind = indicadorDe(planeacion[`transversal_${n}_pda`])
          const cod = codigoPDA(campo, planeacion[`transversal_${n}_id`])
          return ind ? (cod ? `${cod} — ${ind}` : ind) : ''
        })(),
      }
    }).filter((c): c is NonNullable<typeof c> => !!c),
  ]

  async function descargarWord() {
    setExportando(true)
    try {
      const res = await fetch('/api/exportar-word', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          institucional: {
            jardin: profile.school_name,
            cct: profile.cct_primary,
            educadora: profile.full_name,
            grado: profile.grado,
            grupo_letra: profile.grupo_letra,
            turno: profile.shift_primary,
            zona: profile.zona,
            sector: profile.sector,
            region: profile.region,
            ciclo_escolar: CICLO_ESCOLAR_ACTIVO,
          },
          proyecto: {
            project_name: planeacion.project_name,
            situacion_problema: planeacion.situacion_problema,
            finalidad: planeacion.finalidad,
            metodologia: planeacion.metodologia,
            starts_on: planeacion.starts_on,
            ends_on: planeacion.ends_on,
          },
          campos_formativos: tablaCurricularParaWord,
          ejes: [planeacion.eje_principal, planeacion.eje_secundario]
            .filter(Boolean)
            .map((nombre) => {
              const encontrado = (content.ejes || []).find((e: any) => e.nombre === nombre)
              return { nombre, descripcion: encontrado?.descripcion || '' }
            }),
          evaluacion_formativa: content.evaluacion_formativa || '',
          dias,
          dias_especiales: diasEspeciales,
          ajustes_por_dia: content.ajustes_por_dia || [],
          instrumentos_evaluacion: instrumentosEvaluacion,
        }),
      })
      if (!res.ok) throw new Error('No se pudo generar el documento')
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${planeacion.project_name || 'planeacion'}.docx`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
      // [sep 2026] Una vez descargado el Word, la planeación ya no puede descartarse.
      if (!planeacion.word_descargado_en) {
        const ahora = new Date().toISOString()
        const { error: errMarca } = await supabase.from('plannings').update({ word_descargado_en: ahora }).eq('id', params.id)
        if (!errMarca) setPlaneacion((prev: any) => ({ ...prev, word_descargado_en: ahora }))
      }
    } catch {
      alert('Hubo un error al generar el documento. Intenta de nuevo.')
    }
    setExportando(false)
  }

  // [sep 2026] Descartar la planeación COMPLETA — no borra nada, solo
  // status='discarded', para que deje de contar contra el tope mensual.
  async function descartarPlaneacion() {
    const confirmar = window.confirm('¿Descartar esta planeación completa? Ya no contará para tu límite de días hábiles del mes. Seguirá guardada, pero se marcará como descartada.')
    if (!confirmar) return
    setDescartando(true)
    const { error: err } = await supabase.from('plannings').update({ status: 'discarded' }).eq('id', params.id)
    if (err) {
      alert('No se pudo descartar la planeación: ' + err.message)
      setDescartando(false)
      return
    }
    router.push('/mis-planeaciones')
  }

  async function descartarRubrica(rubricaId: string) {
    const confirmar = window.confirm('¿Descartar esta rúbrica? Ya no aparecerá en esta planeación.')
    if (!confirmar) return
    const { error: err } = await supabase.from('rubrics').update({ descartada: true }).eq('id', rubricaId)
    if (err) {
      alert('No se pudo descartar la rúbrica: ' + err.message)
      return
    }
    setRubricasDB(prev => prev.filter(r => r.id !== rubricaId))
  }

  // Ajustes por día: puede haber varias entradas por día (una por alumno); se acumulan.
  const ajustesPorDia: { numero: number; codigo?: string; ajuste: string }[] = content.ajustes_por_dia || []
  const ajustesPorNumero = new Map<number, string[]>()
  ajustesPorDia.forEach((a) => {
    if (a?.numero == null || !a?.ajuste) return
    const lista = ajustesPorNumero.get(a.numero) || []
    lista.push(a.ajuste)
    ajustesPorNumero.set(a.numero, lista)
  })
  // Respaldo solo para planeaciones antiguas con un bloque único de ajustes.
  const ajustesLegacyTexto: string = content.ajustes_razonables || ''
  const hayAjustesPorDia = ajustesPorDia.length > 0

  // Días hábiles y especiales ordenados por fecha
  const todosLosDias = [
    ...dias.map((d: any) => ({ ...d, tipo: 'habil' })),
    ...diasEspeciales.map((d: any) => ({ ...d, tipo: d.tipo }))
  ].sort((a, b) => (a.fecha_iso || '').localeCompare(b.fecha_iso || ''))

  // Agrupar días NO hábiles consecutivos en un solo bloque
  type Bloque =
    | { esHabil: true; dia: any }
    | { esHabil: false; grupo: any[] }

  const bloques: Bloque[] = []
  {
    let i = 0
    while (i < todosLosDias.length) {
      const dia = todosLosDias[i]
      if (dia.tipo === 'habil') {
        bloques.push({ esHabil: true, dia })
        i++
      } else {
        const grupo = [dia]
        let j = i + 1
        while (j < todosLosDias.length && todosLosDias[j].tipo !== 'habil') {
          grupo.push(todosLosDias[j])
          j++
        }
        bloques.push({ esHabil: false, grupo })
        i = j
      }
    }
  }

  // ── Datos para la vista ──
  const rango = planeacion.starts_on ? `${fechaCorta(planeacion.starts_on)} → ${fechaCorta(planeacion.ends_on)}` : ''
  const subtitulo = [
    planeacion.metodologia,
    rango,
    `${dias.length} día${dias.length !== 1 ? 's' : ''} hábil${dias.length !== 1 ? 'es' : ''}`,
  ].filter(Boolean).join(' · ')

  const pdasPrincipal: Segmento[] = [segmentosPDA[0], planeacion.pda_2_activo ? segmentosPDA[1] : null]
    .filter((x): x is Segmento => !!x)
  const indicadoresPrincipal: Segmento[] = pdasPrincipal
    .filter(p => !!indicadorDe(p.texto))
    .map(p => ({ codigo: p.codigo, texto: indicadorDe(p.texto) }))

  const transversales = [1, 2, 3].map(n => {
    const activo = planeacion[`transversal_${n}_activo`]
    const campo = planeacion[`transversal_${n}_campo`]
    if (!activo || !campo) return null
    const pda = planeacion[`transversal_${n}_pda`] || ''
    const codigo = codigoPDA(campo, planeacion[`transversal_${n}_id`])
    const ind = indicadorDe(pda)
    return {
      n,
      campo,
      contenido: planeacion[`transversal_${n}_contenido`] || '',
      pdas: pda ? [{ codigo, texto: pda }] : [],
      indicadores: ind ? [{ codigo, texto: ind }] : [],
    }
  }).filter((t): t is NonNullable<typeof t> => !!t)

  const estaActiva = planeacion.status === 'active'
  const estadoChip = estaActiva
    ? { texto: 'Activa', bg: '#E0F5F3', color: '#0F6E56' }
    : planeacion.status === 'discarded'
      ? { texto: 'Descartada', bg: '#F3F4F6', color: '#4B5563' }
      : { texto: planeacion.status || '', bg: '#F3F4F6', color: '#4B5563' }
  const chipPrincipal = planeacion.pda_campo ? chipCampo(planeacion.pda_campo) : null

  return (
    <>
      {profile && <Sidebar profile={profile}>
        <div style={{ padding: '0 16px' }}>

          <EncabezadoPagina antetitulo="Consultar" titulo={planeacion.project_name || 'Planeación'} subtitulo={subtitulo} />

          <div style={{ maxWidth: 720, margin: '0 auto' }}>

            <div style={{ marginBottom: 10 }}>
              <button onClick={() => router.back()} style={{ ...st.linkGris, color: C.indigo, textDecoration: 'none', fontWeight: 600, fontSize: 14 }}>← Volver</button>
            </div>

            {/* Acciones */}
            <div style={st.card}>
              <div style={{ display: 'flex', flexWrap: 'wrap' as const, alignItems: 'center', gap: 8 }}>
                {chipPrincipal && <span style={{ ...st.chip, background: chipPrincipal.bg, color: chipPrincipal.color }}>{planeacion.pda_campo}</span>}
                {estadoChip.texto && <span style={{ ...st.chip, background: estadoChip.bg, color: estadoChip.color }}>{estadoChip.texto}</span>}
                {soloLectura && (
                  <span style={{ marginLeft: 'auto', fontSize: 13, color: C.gris }}>
                    {docenteNombre ? `Planeación de ${docenteNombre} · solo lectura` : 'Solo lectura'}
                  </span>
                )}
                {!soloLectura && (<button
                  onClick={descargarWord}
                  disabled={exportando}
                  style={{ marginLeft: 'auto', background: C.indigo, color: 'white', border: 'none', padding: '9px 16px', borderRadius: 10, fontSize: 14, fontWeight: 700, whiteSpace: 'nowrap' as const, cursor: exportando ? 'default' : 'pointer', opacity: exportando ? 0.7 : 1 }}
                >
                  {exportando ? 'Generando…' : '⬇ Descargar Word'}
                </button>)}
              </div>
              {estaActiva && !soloLectura && (
                <div style={{ marginTop: 8, textAlign: 'right' as const }}>
                  {!planeacion.word_descargado_en ? (
                    <button onClick={descartarPlaneacion} disabled={descartando} style={{ ...st.linkGris, opacity: descartando ? 0.7 : 1 }}>
                      {descartando ? 'Descartando…' : 'Descartar planeación'}
                    </button>
                  ) : (
                    <span style={{ fontSize: 12, color: C.gris }}>✓ Word descargado · ya no se puede descartar</span>
                  )}
                </div>
              )}
            </div>

            {/* El alma del proyecto */}
            {(planeacion.situacion_problema || planeacion.finalidad) && (
              <div style={st.card}>
                <p style={st.titulo}>Datos del proyecto</p>
                {planeacion.situacion_problema && <Fila etiqueta="Situación problema" ultima={!planeacion.finalidad}>{planeacion.situacion_problema}</Fila>}
                {/* El campo interno se llama "finalidad"; se muestra como "Propósito" (NEM 2022). */}
                {planeacion.finalidad && <Fila etiqueta="Propósito" ultima>{planeacion.finalidad}</Fila>}
              </div>
            )}

            {/* Campos formativos */}
            {(planeacion.pda_campo || transversales.length > 0) && (
              <div style={st.card}>
                <p style={st.titulo}>Campos formativos</p>
                {planeacion.pda_campo && (
                  <BloqueCampo
                    tipo="Campo principal"
                    campo={planeacion.pda_campo}
                    contenido={planeacion.pda_contenido || ''}
                    pdas={pdasPrincipal}
                    indicadores={indicadoresPrincipal}
                  />
                )}
                {transversales.map(t => (
                  <BloqueCampo
                    key={`transversal-${t.n}`}
                    tipo="Campo transversal"
                    campo={t.campo}
                    contenido={t.contenido}
                    pdas={t.pdas}
                    indicadores={t.indicadores}
                  />
                ))}
              </div>
            )}

            {/* Ejes articuladores */}
            {(planeacion.eje_principal || planeacion.eje_secundario) && (
              <div style={st.card}>
                <p style={st.titulo}>Ejes articuladores</p>
                <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: '10px 12px' }}>
                  {[{ nombre: planeacion.eje_principal, rol: 'principal' }, { nombre: planeacion.eje_secundario, rol: 'secundario' }]
                    .filter(e => !!e.nombre)
                    .map((e, i) => (
                      <div key={i} style={{ display: 'flex', flexDirection: 'column' as const, alignItems: 'flex-start', gap: 4 }}>
                        <span style={{ ...st.chip, background: C.indigoClaro, color: C.indigo, fontSize: 13 }}>{e.nombre}</span>
                        <span style={{ fontSize: 12, color: C.gris, paddingLeft: 10 }}>{e.rol}</span>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Secuencia por días */}
            <p style={st.tituloSeccion}>Secuencia didáctica</p>

            {bloques.map((bloque, idx) => {
              // Día(s) NO hábil(es), posiblemente agrupados
              if (!bloque.esHabil) {
                const grupo = bloque.grupo
                const esRango = grupo.length > 1
                const etiquetaFecha = esRango
                  ? `${grupo[0].fecha} al ${grupo[grupo.length - 1].fecha}`
                  : grupo[0].fecha
                const tiposUnicos = Array.from(
                  new Set(grupo.map((d: any) => (d.tipo === 'CTE' ? 'Consejo Técnico Escolar' : (d.motivo || d.tipo || 'Inhábil'))))
                )
                const tieneCTE = grupo.some((d: any) => d.tipo === 'CTE')
                return (
                  <div key={idx} style={{ background: 'white', border: `1.5px dashed ${C.borde}`, borderRadius: 12, padding: '12px 16px', marginBottom: 12, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <span style={{ fontSize: 16, lineHeight: 1.4 }}>{tieneCTE ? '📋' : '📅'}</span>
                    <div style={{ minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: C.indigo }}>{etiquetaFecha}</p>
                      <p style={{ margin: '2px 0 0', fontSize: 13, color: C.gris, lineHeight: 1.5 }}>
                        {tiposUnicos.join(' / ')} · Sin actividades pedagógicas {esRango ? 'estos días' : 'este día'}.
                      </p>
                    </div>
                  </div>
                )
              }

              // Día hábil
              const dia = bloque.dia
              const ajustesDeEsteDia = ajustesPorNumero.get(dia.numero) || []
              return (
                <div key={idx} style={{ ...st.card, padding: 0, overflow: 'hidden' as const }}>
                  <div style={{ background: C.indigo, padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' as const }}>
                    <p style={{ margin: 0, color: 'white', fontSize: 14, fontWeight: 700 }}>Día {dia.numero} · {dia.fecha}</p>
                    {dia.momento_modalidad && (
                      <span style={{ fontSize: 11, color: C.indigo, fontWeight: 800, textTransform: 'uppercase' as const, letterSpacing: '0.04em', background: 'white', padding: '4px 10px', borderRadius: 12 }}>
                        {dia.momento_modalidad}
                      </span>
                    )}
                  </div>
                  <div style={{ padding: '16px 16px 2px' }}>
                    <Momento etiqueta="Inicio" texto={dia.inicio} />
                    <Momento etiqueta="Desarrollo" texto={dia.desarrollo} />
                    <Momento etiqueta="Cierre" texto={dia.cierre} />
                    {dia.materiales && <Fila etiqueta="Materiales">{dia.materiales}</Fila>}
                    {dia.actividad_complementaria && <Fila etiqueta="Actividad complementaria">{dia.actividad_complementaria}</Fila>}
                    {ajustesDeEsteDia.length > 0 && (
                      <div style={{ background: C.indigoClaro, borderLeft: `3px solid ${C.indigo}`, borderRadius: 8, padding: '10px 12px', marginBottom: 14 }}>
                        <p style={{ ...st.etiqueta, color: C.indigo }}>
                          Ajuste{ajustesDeEsteDia.length > 1 ? 's' : ''} razonable{ajustesDeEsteDia.length > 1 ? 's' : ''}
                        </p>
                        {ajustesDeEsteDia.map((texto, i) => (
                          <p key={i} style={{ ...st.valor, fontSize: 14, margin: i === 0 ? 0 : '10px 0 0', whiteSpace: 'pre-wrap' as const }}>{texto}</p>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}

            {/* Instrumentos de evaluación */}
            {instrumentosEvaluacion.length > 0 && (
              <>
                <p style={st.tituloSeccion}>
                  {instrumentosEvaluacion.length > 1 ? 'Instrumentos de evaluación' : 'Instrumento de evaluación'}
                </p>
                {instrumentosEvaluacion.map((instrumento: any, idx: number) => {
                  const chip = instrumento.campo ? chipCampo(instrumento.campo) : null
                  return (
                    <div style={st.card} key={idx}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' as const, marginBottom: 14 }}>
                        {chip && <span style={{ ...st.chip, background: chip.bg, color: chip.color }}>{instrumento.campo}</span>}
                        {instrumento.es_principal === false && <span style={{ fontSize: 12, color: C.gris }}>transversal</span>}
                      </div>
                      {instrumento.pda && <Fila etiqueta="PDA">{instrumento.pda}</Fila>}
                      {instrumento.criterio && <Fila etiqueta="Criterio"><strong>{instrumento.criterio}</strong></Fila>}
                      {(instrumento.niveles || []).map((nivel: any, i: number) => {
                        const estilo = ESTILO_POR_NIVEL[nivel.etiqueta] || { color: '#374151', fondo: '#F9FAFB', borde: '#E0DFF5' }
                        return (
                          <div key={i} style={{ background: estilo.fondo, borderLeft: `4px solid ${estilo.borde}`, borderRadius: 8, padding: '10px 12px', marginBottom: 6 }}>
                            <p style={{ ...st.etiqueta, color: estilo.color, fontWeight: 800 }}>{nivel.etiqueta}</p>
                            <p style={{ ...st.valor, fontSize: 14 }}>{nivel.descriptor}</p>
                          </div>
                        )
                      })}
                      {instrumento.es_principal === false && instrumento._rubricaId && (
                        <div style={{ marginTop: 10, textAlign: 'right' as const }}>
                          <button onClick={() => descartarRubrica(instrumento._rubricaId)} style={soloLectura ? { display: 'none' } : st.linkGris}>
                            Descartar esta rúbrica
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </>
            )}

            {/* Rúbrica — RESPALDO solo para planeaciones antiguas (schema "rubrica"). */}
            {rubricaLegacy && (
              <>
                <p style={st.tituloSeccion}>Rúbrica de evaluación</p>
                <div style={st.card}>
                  {rubricaLegacy.campo && (() => {
                    const chip = chipCampo(rubricaLegacy.campo)
                    return <div style={{ marginBottom: 14 }}><span style={{ ...st.chip, background: chip.bg, color: chip.color }}>{rubricaLegacy.campo}</span></div>
                  })()}
                  {rubricaLegacy.pda && <Fila etiqueta="PDA">{rubricaLegacy.pda}</Fila>}
                  {rubricaLegacy.indicador && <Fila etiqueta="Indicador">{rubricaLegacy.indicador}</Fila>}
                  {[
                    { etiqueta: 'Logrado', texto: rubricaLegacy.nivel_3 },
                    { etiqueta: 'En proceso', texto: rubricaLegacy.nivel_2 },
                    { etiqueta: 'Requiere apoyo', texto: rubricaLegacy.nivel_1 },
                  ].map((n, i) => {
                    const estilo = ESTILO_POR_NIVEL[n.etiqueta]
                    return (
                      <div key={i} style={{ background: estilo.fondo, borderLeft: `4px solid ${estilo.borde}`, borderRadius: 8, padding: '10px 12px', marginBottom: 6 }}>
                        <p style={{ ...st.etiqueta, color: estilo.color, fontWeight: 800 }}>{n.etiqueta}</p>
                        <p style={{ ...st.valor, fontSize: 14 }}>{n.texto}</p>
                      </div>
                    )
                  })}
                  {rubricaLegacy.nota_evaluadora && <p style={{ ...st.valor, fontSize: 14, fontStyle: 'italic' as const, marginTop: 10 }}>{rubricaLegacy.nota_evaluadora}</p>}
                </div>
              </>
            )}

            {/* Ajustes razonables — RESPALDO solo para planeaciones antiguas con bloque único. */}
            {!hayAjustesPorDia && ajustesLegacyTexto && (
              <>
                <p style={st.tituloSeccion}>Ajustes razonables</p>
                <div style={st.card}>
                  <p style={{ ...st.valor, whiteSpace: 'pre-wrap' as const }}>{ajustesLegacyTexto}</p>
                </div>
              </>
            )}

          </div>
          <div style={{ height: 40 }} />
        </div>
      </Sidebar>}
    </>
  )
}
