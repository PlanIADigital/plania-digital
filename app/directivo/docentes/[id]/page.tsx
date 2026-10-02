'use client'
// ============================================================
//  PlanIA Digital — app/directivo/docentes/[id]/page.tsx
//
//  [Saneado 27 sep 2026 — Fase 1] Pide todo a /api/directivo/docentes/[id]
//  (token Bearer): verifica directivo con membresía para el panel y que la
//  docente comparta su CCT; avance del ciclo activo con las MISMAS funciones
//  que Mi Avance (lib/cobertura.ts vía lib/avanceServidor.ts).
//
//  [2 oct 2026] Rediseño (misma línea que el resto de la plataforma):
//  - Encabezado de 3 renglones (Acompañar / NOMBRE / rol · grupo · ciclo).
//  - Tarjetas apiladas en una columna (antes pestañas que escondían datos).
//  - Campos con colores oficiales y códigos LEN/SPC/ENS/DHC.
//  - Ejes ordenados de mayor a menor; los no abordados en gris neutro
//    (sin naranja ni ⚠️: sin indicadores punitivos).
//  - Planeaciones: solo se marca "Activa" (ningún flujo "cierra").
//  El directivo SOLO VE; nada en esta página modifica datos.
// ============================================================
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { useRouter, useParams } from 'next/navigation'
import SidebarWrapper from '@/components/SidebarWrapper'
import EncabezadoPagina from '@/components/EncabezadoPagina'
import { fondoBarraCampo } from '@/lib/coloresCampos'
import { ROL_DOCENTE } from '@/lib/useDocentesDirectivo'
import {
  ORIGENES_PRIORITARIO,
  type ResultadoAvance,
  type ResultadoPrioritarios,
} from '@/lib/cobertura'
import type { PlaneacionResumen } from '@/lib/avanceServidor'

const supabase = createClient()

const C = {
  indigo: '#3D3A8C', indigoClaro: '#EEEDF8', cianOscuro: '#00806F',
  texto: '#1A1A2E', suave: '#6B7280', borde: '#E0DFF5', fondoSuave: '#F7F7FC',
}

// Totales del catálogo oficial por campo (Programa Sintético Fase 2).
const CAMPOS = [
  { nombre: 'Lenguajes',                        etiqueta: 'Lenguajes (LEN)', total: 86 },
  { nombre: 'Saberes y Pensamiento Científico', etiqueta: 'Saberes y Pensamiento Científico (SPC)', total: 130 },
  { nombre: 'Ética, Naturaleza y Sociedades',   etiqueta: 'Ética, Naturaleza y Sociedades (ENS)', total: 70 },
  { nombre: 'De lo Humano y lo Comunitario',    etiqueta: 'De lo Humano y lo Comunitario (DHC)', total: 85 },
]

const EJES = [
  'Inclusión', 'Pensamiento crítico', 'Interculturalidad crítica', 'Igualdad de género',
  'Vida saludable', 'Apropiación de las culturas a través de la lectura y la escritura',
  'Artes y experiencias estéticas',
]

type DetalleDocente = {
  ciclo: string
  docente: {
    id: string
    full_name: string | null
    role: string
    grado: string | null
    grupo_letra: string | null
    total_alumnos: number | null
    cct_primary: string | null
  }
  avance: ResultadoAvance
  prioritarios: ResultadoPrioritarios
  planeaciones: PlaneacionResumen[]
  alumnosConApoyos: Array<{ codigo: string; apoyos: string; origen: 'mia' | 'educadora' | null }>
}

const st = {
  card: { background: 'white', border: `1px solid ${C.borde}`, borderRadius: 12, padding: '16px 18px' } as React.CSSProperties,
  h2: { margin: '0 0 4px', fontSize: 13, fontWeight: 800, color: C.texto, textTransform: 'uppercase', letterSpacing: '0.07em' } as React.CSSProperties,
  sub: { margin: '0 0 14px', fontSize: 13, color: C.suave, lineHeight: 1.4 } as React.CSSProperties,
  vacio: { margin: '4px 0', fontSize: 13.5, color: C.suave, lineHeight: 1.5 } as React.CSSProperties,
  barraFondo: { height: 10, background: C.indigoClaro, borderRadius: 99, overflow: 'hidden' } as React.CSSProperties,
}

function Cifra({ titulo, valor, nota }: { titulo: string; valor: string; nota?: string }) {
  return (
    <div style={{ ...st.card, padding: '14px 16px', minWidth: 0 }}>
      <p style={{ margin: '0 0 6px', fontSize: 13, fontWeight: 700, color: C.suave }}>{titulo}</p>
      <p style={{ margin: 0, fontSize: 28, fontWeight: 800, lineHeight: 1.1, color: C.texto }}>{valor}</p>
      {nota && <p style={{ margin: '2px 0 0', fontSize: 12.5, color: C.suave }}>{nota}</p>}
    </div>
  )
}

function fechaCorta(iso: string | null): string {
  if (!iso) return ''
  return new Date(`${String(iso).slice(0, 10)}T12:00:00`).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })
}

export default function DocenteDetallePage() {
  const router = useRouter()
  const params = useParams()
  const docenteId = params?.id as string

  const [profile, setProfile] = useState<any>(null)
  const [detalle, setDetalle] = useState<DetalleDocente | null>(null)
  const [errorCarga, setErrorCarga] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [verTodas, setVerTodas] = useState(false)

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/auth/login'); return }
      const { data: user } = await supabase.from('users').select('*').eq('auth_uid', session.user.id).single()
      if (!user?.profile_completed || user.role !== 'directivo') { router.push('/dashboard'); return }
      setProfile(user)
      try {
        const res = await fetch(`/api/directivo/docentes/${encodeURIComponent(docenteId)}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        })
        const data = await res.json()
        if (!res.ok) setErrorCarga(data?.error || 'No se pudo cargar la información de la docente.')
        else setDetalle(data as DetalleDocente)
      } catch {
        setErrorCarga('No se pudo conectar con el servidor. Intenta de nuevo.')
      }
      setLoading(false)
    }
    load()
  }, [docenteId])

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
      <p style={{ color: C.indigo }}>Cargando...</p>
    </div>
  )

  const volver = (
    <button onClick={() => router.push('/directivo/docentes')}
      style={{ display: 'block', maxWidth: 720, width: '100%', margin: '12px auto 0', background: 'none', border: 'none', color: C.indigo, fontSize: 14, fontWeight: 700, cursor: 'pointer', padding: '10px 0', textAlign: 'left', minHeight: 44 }}>
      ← Mis docentes
    </button>
  )

  if (errorCarga || !detalle) return (
    <SidebarWrapper profile={profile}>
      <div style={{ padding: '0 16px 48px' }}>
        {volver}
        <div style={{ ...st.card, maxWidth: 720, margin: '0 auto', textAlign: 'center', padding: '28px 20px' }}>
          <p style={{ fontSize: 14, color: C.texto, margin: 0, lineHeight: 1.6 }}>{errorCarga || 'No se pudo cargar la información.'}</p>
        </div>
      </div>
    </SidebarWrapper>
  )

  const { docente, avance, prioritarios, planeaciones, alumnosConApoyos, ciclo } = detalle

  const grupo = docente.grado ? `${docente.grado}${docente.grupo_letra ? ` ${docente.grupo_letra}` : ''}` : 'Aún no configura su grupo'
  const subtitulo = [
    ROL_DOCENTE[docente.role] || docente.role,
    grupo,
    docente.total_alumnos ? `${docente.total_alumnos} alumnos` : null,
    `Ciclo ${ciclo}`,
  ].filter(Boolean).join(' · ')

  const ejes = EJES
    .map(nombre => ({ nombre, n: avance.ejes.conteo[nombre] || 0 }))
    .sort((a, b) => b.n - a.n)
  const totalPlanes = planeaciones.length
  // Como en la educadora: las 4 más recientes y un botón para ver el resto.
  const MOSTRAR_INICIAL = 4
  const planesVisibles = verTodas ? planeaciones : planeaciones.slice(0, MOSTRAR_INICIAL)

  return (
    <SidebarWrapper profile={profile}>
      <div style={{ padding: '0 16px 48px' }}>
        {volver}
        <EncabezadoPagina antetitulo="Acompañar" titulo={docente.full_name || 'Docente'} subtitulo={subtitulo} />

        <div style={{ maxWidth: 720, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* Cifras */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 150px), 1fr))', gap: 10 }}>
            <Cifra titulo="PDA trabajados" valor={String(avance.pdaDistintos)} nota="distintos este ciclo" />
            <Cifra titulo="PDA prioritarios" valor={prioritarios.hayDiagnostico ? `${prioritarios.atendidos}/${prioritarios.total}` : '—'}
              nota={prioritarios.hayDiagnostico ? 'atendidos' : 'Sin diagnóstico'} />
            <Cifra titulo="Planeaciones" valor={String(totalPlanes)} nota="en el ciclo" />
            <Cifra titulo="Alumnos con apoyos" valor={String(alumnosConApoyos.length)} nota="confirmados" />
          </div>

          {/* Avance por campo */}
          <section style={st.card}>
            <h2 style={st.h2}>Avance por campo formativo</h2>
            <p style={st.sub}>PDA distintos trabajados, del total de cada campo</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {CAMPOS.map(c => {
                const n = avance.porCampo[c.nombre]?.distintos || 0
                const pct = Math.round((n / c.total) * 100)
                return (
                  <div key={c.nombre}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 6, fontSize: 14 }}>
                      <span style={{ fontWeight: 700, color: C.texto }}>{c.etiqueta}</span>
                      <span style={{ color: C.suave, whiteSpace: 'nowrap' }}>{n} de {c.total} · {pct}%</span>
                    </div>
                    <div style={st.barraFondo}>
                      <div title={`${c.etiqueta}: ${n} de ${c.total} PDA`} style={{ width: `${pct}%`, minWidth: n > 0 ? 6 : 0, height: '100%', background: fondoBarraCampo(c.nombre), borderRadius: 99 }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </section>

          {/* Prioritarios por origen */}
          <section style={st.card}>
            <h2 style={st.h2}>PDA prioritarios</h2>
            <p style={st.sub}>Atendidos según su origen</p>
            {!prioritarios.hayDiagnostico ? (
              <p style={st.vacio}>La docente aún no captura sus diagnósticos en Mi grupo.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {ORIGENES_PRIORITARIO.map(o => {
                  const v = prioritarios.porOrigen[o.clave]
                  return (
                    <div key={o.clave}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginBottom: 6 }}>
                        <span style={{ fontWeight: 700 }}>{o.etiqueta}</span>
                        <span style={{ color: C.suave }}>{v.total > 0 ? `${v.atendidos} de ${v.total}` : 'Sin registrar'}</span>
                      </div>
                      <div style={st.barraFondo}>
                        <div style={{ width: `${v.total > 0 ? (v.atendidos / v.total) * 100 : 0}%`, height: '100%', background: C.indigo, borderRadius: 99 }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </section>

          {/* Ejes articuladores */}
          <section style={st.card}>
            <h2 style={st.h2}>Ejes articuladores</h2>
            <p style={st.sub}>Planeaciones que trabajan cada eje</p>
            {totalPlanes === 0 ? <p style={st.vacio}>Aparecerá cuando haya planeaciones en el ciclo.</p> : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {ejes.map(e => (
                  <div key={e.nombre}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 5, fontSize: 13.5 }}>
                      <span style={{ color: e.n > 0 ? C.texto : C.suave, fontWeight: e.n > 0 ? 600 : 400 }}>{e.nombre}</span>
                      <span style={{ color: C.suave, whiteSpace: 'nowrap' }}>{e.n > 0 ? `${e.n} de ${totalPlanes}` : 'Aún sin abordar'}</span>
                    </div>
                    <div style={{ ...st.barraFondo, height: 8 }}>
                      <div style={{ width: `${Math.min(100, (e.n / totalPlanes) * 100)}%`, height: '100%', background: C.indigo, borderRadius: 99 }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Apoyos */}
          <section style={st.card}>
            <h2 style={st.h2}>Apoyos confirmados</h2>
            <p style={st.sub}>Ajustes que la docente confirmó para alumnos de su grupo</p>
            {alumnosConApoyos.length === 0 ? (
              <p style={st.vacio}>La docente aún no ha confirmado apoyos para alumnos de su grupo este ciclo.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {alumnosConApoyos.map(a => (
                  <div key={a.codigo} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px', background: C.fondoSuave, borderRadius: 10 }}>
                    <span style={{ minWidth: 52, padding: '4px 8px', borderRadius: 14, background: C.indigoClaro, fontSize: 12, fontWeight: 800, color: C.indigo, textAlign: 'center', flexShrink: 0 }}>{a.codigo}</span>
                    <p style={{ fontSize: 13.5, color: C.texto, margin: 0, lineHeight: 1.5 }}>{a.apoyos}</p>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Planeaciones */}
          <section style={st.card}>
            <h2 style={st.h2}>Planeaciones del ciclo ({totalPlanes})</h2>
            <p style={st.sub}>Toca una para leerla completa</p>
            {totalPlanes === 0 ? <p style={st.vacio}>Sin planeaciones registradas aún.</p> : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {planesVisibles.map(p => (
                  <button key={p.id} onClick={() => router.push(`/directivo/planeaciones/${p.id}`)}
                    aria-label={`Leer la planeación ${p.project_name || ''}`}
                    style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 10, background: C.fondoSuave, border: 'none', width: '100%', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', minHeight: 44 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 14, fontWeight: 700, color: C.texto, margin: '0 0 2px', overflowWrap: 'anywhere' }}>{p.project_name || 'Sin título'}</p>
                      <p style={{ fontSize: 12.5, color: C.suave, margin: 0, lineHeight: 1.4 }}>
                        {[p.pda_campo, p.eje_principal, fechaCorta(p.starts_on)].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                    {p.status === 'active' && (
                      <span style={{ fontSize: 11.5, padding: '3px 10px', borderRadius: 12, background: 'transparent', color: C.indigo, border: '1px solid #C9C7EC', fontWeight: 600, flexShrink: 0 }}>Activa</span>
                    )}
                    <span aria-hidden="true" style={{ flexShrink: 0, background: C.cianOscuro, color: 'white', fontSize: 14, fontWeight: 700, padding: '9px 16px', borderRadius: 10, lineHeight: 1 }}>Ver</span>
                  </button>
                ))}
                {totalPlanes > MOSTRAR_INICIAL && (
                  <button onClick={() => setVerTodas(v => !v)}
                    style={{ marginTop: 4, minHeight: 44, background: 'white', color: C.indigo, border: `1.5px solid ${C.indigo}`, borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                    {verTodas ? 'Ver menos' : `Ver las ${totalPlanes} planeaciones`}
                  </button>
                )}
              </div>
            )}
          </section>

        </div>
      </div>
    </SidebarWrapper>
  )
}
