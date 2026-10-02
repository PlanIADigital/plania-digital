'use client'
// ============================================================
//  PlanIA Digital — app/dashboard/page.tsx
//
//  [Saneado 26 sep 2026 — Fase 1, Mi Avance]
//  Contrato de datos:
//    - Planeaciones: plannings del ciclo activo, filtradas con
//      clasificarPlaneaciones() (sin descartadas, starts_on dentro de
//      inicio_clases/fin_clases del calendario estatal). La lista y su
//      contador muestran las MISMAS planeaciones que cuentan en Mi
//      Avance; el historial completo vive en Mis Planeaciones.
//    - KPIs: calcularAvance() de lib/cobertura.ts — PDA distintos por
//      pda_id (principal, pda_2, transversales); campos a partir de
//      esos PDA (incluye transversales); ejes de las planeaciones
//      contadas. Ya NO se lee pda_coverage (contaba textos, no PDA).
//
//  [Rediseño 1 oct 2026] Mismo lenguaje visual que Mi Grupo y Nueva
//  Planeación: encabezado común, una sola columna (720 px), tarjetas
//  blancas, indicadores compactos que caben en celular, sugerencias de
//  MÍA en tono no punitivo y paleta oficial. Datos y cálculos SIN cambios.
// ============================================================
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { useRouter } from 'next/navigation'
import SidebarWrapper from '@/components/SidebarWrapper'
import EncabezadoPagina from '@/components/EncabezadoPagina'
import { chipCampo } from '@/lib/coloresCampos'
import {
  SELECT_PLANNINGS_AVANCE,
  calcularAvance,
  clasificarPlaneaciones,
  type PdaCatalogoAvance,
  type PeriodoAvance,
} from '@/lib/cobertura'
import { CICLO_ESCOLAR_ACTIVO } from '@/lib/calendarioEscolar'
import { zonaHorariaPorCCT } from '@/lib/fechaMexico'

const supabase = createClient()

const C = {
  indigo: '#3D3A8C',
  cian: '#00A896',
  indigoClaro: '#EEEDF8',
  texto: '#1A1A2E',
  gris: '#6B7280',
}

const GRADO_MAP: Record<string, string> = { '1er Grado': '1°', '2do Grado': '2°', '3er Grado': '3°' }

const st = {
  card: { background: 'var(--plania-superficie, white)', border: '1px solid var(--plania-borde, #E0DFF5)', borderRadius: 12, padding: 16, marginBottom: 12 } as React.CSSProperties,
  titulo: { margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--plania-marca, #3D3A8C)', textTransform: 'uppercase' as const, letterSpacing: '0.07em' } as React.CSSProperties,
  sugerencia: { margin: 0, fontSize: 14, color: 'var(--plania-marca, #3D3A8C)', background: C.indigoClaro, borderLeft: `3px solid ${C.indigo}`, borderRadius: 8, padding: '10px 12px', lineHeight: 1.55 } as React.CSSProperties,
}

function fechaCorta(iso?: string | null): string {
  if (!iso) return ''
  return new Date(iso + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })
}

export default function DashboardPage() {
  const router = useRouter()
  const [profile, setProfile] = useState<any>(null)
  const [planeaciones, setPlaneaciones] = useState<any[]>([])
  const [cobertura, setCobertura] = useState({ campos: 0, ejes: 0, pdas: 0, totalCampos: 4, totalEjes: 7, totalPdas: 371 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadUser() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/auth/login'); return }
      const { data } = await supabase.from('users').select('*').eq('auth_uid', session.user.id).single()
      if (!data?.profile_completed) { router.push('/onboarding'); return }
      if (data?.is_super_admin) { router.push('/admin'); return }
      if (data?.role === 'directivo') { router.push('/directivo/dashboard'); return }
      setProfile(data)

      const { data: plans } = await supabase
        .from('plannings')
        .select(`${SELECT_PLANNINGS_AVANCE}, project_name, situacion_problema, ends_on, pda_campo, created_at`)
        .eq('user_id', data.id)
        .eq('ciclo_escolar', CICLO_ESCOLAR_ACTIVO)
        .order('created_at', { ascending: false })

      const { data: catalogo } = await supabase
        .from('pda_catalog')
        .select('id, campo, posicion_campo')

      let inicio: string | null = null
      let fin: string | null = null
      try {
        const estadoCodigo = (data.cct_primary || '').slice(0, 2)
        const res = await fetch(`/api/calendario/fin-ciclo?estado=${estadoCodigo}`)
        const fechas = await res.json()
        inicio = fechas.inicioClases || null
        fin = fechas.finClases || null
      } catch {
        inicio = null
        fin = null
      }

      const periodo: PeriodoAvance = { ciclo: CICLO_ESCOLAR_ACTIVO, inicio, fin }
      const todas: any[] = plans || []
      const contadas = clasificarPlaneaciones(todas, periodo).contadas
      const avance = calcularAvance(todas, (catalogo as PdaCatalogoAvance[]) || [], periodo)
      const camposConPda = Object.keys(avance.porCampo).length

      setPlaneaciones(contadas)
      setCobertura({
        campos: camposConPda,
        ejes: avance.ejes.cubiertos.length,
        pdas: avance.pdaDistintos,
        totalCampos: 4,
        totalEjes: 7,
        totalPdas: 371,
      })

      setLoading(false)
    }
    loadUser()
  }, [])

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
      <p style={{ color: '#3D3A8C' }}>Cargando...</p>
    </div>
  )

  const ultimasPlaneaciones = planeaciones.slice(0, 4)
  const primerNombre = (profile?.full_name || '').trim().split(/\s+/)[0] || ''
  const grado = profile?.grado ? (GRADO_MAP[profile.grado] || profile.grado) : ''
  const grupo = [grado, profile?.grupo_letra].filter(Boolean).join(' ')
  // [1 oct 2026] Fecha y saludo según la hora del estado de la educadora
  // (zona horaria por CCT), para que se sienta ubicada en el día.
  const { fechaTexto, saludo } = (() => {
    const ahora = new Date()
    const formatear = (tz: string) => {
      const f = new Intl.DateTimeFormat('es-MX', { timeZone: tz, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(ahora)
      const h = Number(new Intl.DateTimeFormat('es-MX', { timeZone: tz, hour: 'numeric', hourCycle: 'h23' }).format(ahora))
      return {
        fechaTexto: f.charAt(0).toUpperCase() + f.slice(1),
        saludo: h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches',
      }
    }
    try { return formatear(zonaHorariaPorCCT(profile?.cct_primary) || 'America/Mexico_City') }
    catch { return formatear('America/Mexico_City') }
  })()
  const subtitulo = [fechaTexto, grupo, `Ciclo ${CICLO_ESCOLAR_ACTIVO}`].filter(Boolean).join(' · ')

  const indicadores = [
    { etiqueta: 'Campos', valor: cobertura.campos, total: cobertura.totalCampos },
    { etiqueta: 'PDA', valor: cobertura.pdas, total: cobertura.totalPdas },
    { etiqueta: 'Ejes', valor: cobertura.ejes, total: cobertura.totalEjes },
  ]

  const faltanCampos = cobertura.totalCampos - cobertura.campos

  return (
    <SidebarWrapper profile={profile}>
      <div style={{ padding: '0 16px' }}>

        <EncabezadoPagina antetitulo={`¡${saludo},`} titulo={`${primerNombre}!`} subtitulo={subtitulo} />

        <div style={{ maxWidth: 720, margin: '0 auto' }}>

          {/* Tu avance del ciclo — orden pedagógico: Campos → PDA → Ejes */}
          <div style={st.card}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
              <p style={st.titulo}>Tu avance del ciclo</p>
              <button onClick={() => router.push('/mi-avance')}
                style={{ background: 'none', border: 'none', color: 'var(--plania-marca, #3D3A8C)', fontSize: 13, fontWeight: 600, cursor: 'pointer', padding: '4px 0', textDecoration: 'underline' }}>
                Ver mi avance →
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
              {indicadores.map((k) => (
                <div key={k.etiqueta} style={{ background: 'var(--plania-superficie-alt, #F4F3FB)', borderRadius: 10, padding: '12px 6px', textAlign: 'center' }}>
                  <p style={{ margin: '0 0 4px', fontSize: 11, fontWeight: 700, color: 'var(--plania-marca, #3D3A8C)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{k.etiqueta}</p>
                  <p style={{ margin: 0, fontSize: 'clamp(18px, 5vw, 26px)', fontWeight: 800, color: 'var(--plania-marca, #3D3A8C)', whiteSpace: 'nowrap', lineHeight: 1.2 }}>
                    {k.valor}<span style={{ fontSize: '0.6em', fontWeight: 600, color: C.gris }}> / {k.total}</span>
                  </p>
                  <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--plania-texto-suave, #6B7280)' }}>cubiertos</p>
                </div>
              ))}
            </div>
          </div>

          {/* Sugerencia de MÍA — tono de sugerencia, nunca punitivo */}
          <div style={st.card}>
            <p style={{ ...st.titulo, marginBottom: 10 }}>✦ Sugerencia de MÍA</p>
            {planeaciones.length === 0 ? (
              <p style={{ margin: 0, fontSize: 14, color: 'var(--plania-texto-suave, #6B7280)', lineHeight: 1.6 }}>
                Cuando generes tu primera planeación, MÍA comenzará a analizar tu cobertura curricular y te dará orientaciones personalizadas aquí.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {faltanCampos > 0 && (
                  <p style={st.sugerencia}>
                    ✦ Tu próximo proyecto puede incluir {faltanCampos === 1 ? 'el campo formativo' : `los ${faltanCampos} campos formativos`} que aún no trabajas este ciclo, para equilibrar tu cobertura.
                  </p>
                )}
                {cobertura.pdas < 50 && (
                  <p style={st.sugerencia}>
                    📋 Llevas {cobertura.pdas} PDA cubiertos. ¡Vas bien! Cada planeación suma a tu cobertura curricular.
                  </p>
                )}
                {faltanCampos <= 0 && cobertura.pdas >= 50 && (
                  <p style={st.sugerencia}>
                    ✅ Excelente cobertura curricular. Revisa Mi Avance para identificar áreas de oportunidad específicas.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Mis planeaciones */}
          <div style={st.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <p style={st.titulo}>Mis planeaciones</p>
                <span style={{ background: C.indigo, color: 'white', fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 20 }}>
                  {planeaciones.length}
                </span>
              </div>
              <button onClick={() => router.push('/planeacion/nueva')}
                style={{ background: C.cian, color: 'white', border: 'none', padding: '8px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap' }}>
                + Nueva
              </button>
            </div>

            {planeaciones.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '28px 0' }}>
                <p style={{ fontSize: 32, margin: '0 0 8px' }}>📋</p>
                <p style={{ color: 'var(--plania-texto-suave, #6B7280)', fontSize: 14, margin: 0, lineHeight: 1.6 }}>Aún no tienes planeaciones.<br />¡Crea tu primera hoy!</p>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {ultimasPlaneaciones.map(p => (
                    <div key={p.id} style={{ border: '1px solid var(--plania-borde, #E0DFF5)', borderRadius: 10, padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{
                          margin: '0 0 6px', fontWeight: 700, color: 'var(--plania-texto, #1A1A2E)', fontSize: 15, lineHeight: 1.35,
                          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const, overflow: 'hidden',
                        }}>
                          {p.project_name}
                        </p>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                          {p.pda_campo && (
                            <span style={{ background: chipCampo(p.pda_campo).bg, color: chipCampo(p.pda_campo).color, fontSize: 11, padding: '2px 8px', borderRadius: 20, fontWeight: 600 }}>
                              {p.pda_campo}
                            </span>
                          )}
                          {p.starts_on && (
                            <span style={{ color: 'var(--plania-texto-suave, #6B7280)', fontSize: 12 }}>
                              {fechaCorta(p.starts_on)}{p.ends_on && ` → ${fechaCorta(p.ends_on)}`}
                            </span>
                          )}
                          <span style={{
                            background: p.status === 'active' ? '#E0F5F3' : 'var(--plania-superficie-alt, #EEEDF8)',
                            color: p.status === 'active' ? '#0F6E56' : 'var(--plania-texto-suave, #6B7280)',
                            fontSize: 11, padding: '2px 8px', borderRadius: 20, fontWeight: 600,
                          }}>
                            {p.status === 'active' ? 'Activa' : p.status}
                          </span>
                        </div>
                      </div>
                      <button onClick={() => router.push(`/planeacion/${p.id}`)}
                        style={{ background: C.indigo, color: 'white', border: 'none', padding: '8px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600, flexShrink: 0 }}>
                        Ver →
                      </button>
                    </div>
                  ))}
                </div>
                {planeaciones.length > 4 && (
                  <button onClick={() => router.push('/mis-planeaciones')}
                    style={{ background: 'none', border: '1px solid var(--plania-borde, #E0DFF5)', color: 'var(--plania-marca, #3D3A8C)', padding: 10, borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600, marginTop: 10, width: '100%' }}>
                    Ver todas las planeaciones ({planeaciones.length}) →
                  </button>
                )}
              </>
            )}
          </div>

        </div>
        <div style={{ height: 40 }} />
      </div>
    </SidebarWrapper>
  )
}
