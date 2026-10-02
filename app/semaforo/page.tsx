'use client'
// ============================================================
//  PlanIA Digital — app/semaforo/page.tsx
//  [2 oct 2026] Semáforo de desempeño de la educadora.
//  4 momentos (Diagnóstico, nov, mar, may–jun) × áreas del jardín.
//  Marca cada niño (código AL-XX) por área: Suficiente / En desarrollo /
//  Requiere apoyo / No evaluado. Envía a dirección cuando está completo.
//  Datos vía /api/semaforo (servidor). Mobile-first.
// ============================================================
import BotonWordSemaforo from '@/components/BotonWordSemaforo'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import SidebarWrapper from '@/components/SidebarWrapper'
import EncabezadoPagina from '@/components/EncabezadoPagina'
import { NIVELES, type Momento, type Nivel } from '@/lib/semaforo'

const supabase = createClient()

const C = {
  indigo: '#3D3A8C', indigoClaro: '#EEEDF8', cianOscuro: '#00806F',
  texto: '#1A1A2E', suave: '#6B7280', borde: '#E0DFF5',
}

type Datos = {
  ciclo: string
  momento: Momento
  momentoSugerido: Momento
  momentos: Array<{ clave: Momento; nombre: string; cuando: string }>
  grado: string | null
  grupo_letra: string | null
  alumnos: string[]
  areas: string[]
  marcas: Record<string, Record<string, Nivel>>
  enviado_en: string | null
}

const card: React.CSSProperties = { background: 'white', border: `1px solid ${C.borde}`, borderRadius: 12, padding: '16px 18px' }
const h2: React.CSSProperties = { margin: '0 0 4px', fontSize: 13, fontWeight: 800, color: C.texto, textTransform: 'uppercase', letterSpacing: '0.07em' }

function fechaCorta(iso: string): string {
  return new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', timeZone: 'America/Mexico_City' })
}
function gradoCorto(g: string | null): string {
  const m = String(g || '').match(/[1-3]/)
  return m ? `${m[0]}°` : (g || '')
}

async function token(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token || null
}

export default function SemaforoPage() {
  const router = useRouter()
  const [profile, setProfile] = useState<any>(null)
  const [datos, setDatos] = useState<Datos | null>(null)
  const [error, setError] = useState('')
  const [area, setArea] = useState<string | null>(null)
  const [borrador, setBorrador] = useState<Record<string, Nivel>>({})
  const [guardando, setGuardando] = useState(false)
  const [aviso, setAviso] = useState('')

  async function cargar(momento?: Momento) {
    const t = await token()
    if (!t) return
    setError(''); setAviso('')
    try {
      const res = await fetch(`/api/semaforo${momento ? `?momento=${momento}` : ''}`, { headers: { Authorization: `Bearer ${t}` } })
      const d = await res.json()
      if (!res.ok) setError(d?.error || 'No se pudo cargar el semáforo.')
      else setDatos(d)
    } catch { setError('No se pudo conectar con el servidor.') }
  }

  useEffect(() => {
    async function inicio() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/auth/login'); return }
      const { data: user } = await supabase.from('users').select('*').eq('auth_uid', session.user.id).single()
      if (!user?.profile_completed) { router.push('/onboarding'); return }
      if (user.role === 'directivo') { router.push('/directivo/dashboard'); return }
      setProfile(user)
      await cargar()
    }
    inicio()
  }, [])

  function abrirArea(a: string) {
    if (!datos) return
    setArea(a)
    setBorrador({ ...(datos.marcas[a] || {}) })
    setAviso(''); setError('')
    window.scrollTo(0, 0)
  }

  async function guardarArea() {
    const t = await token()
    if (!t || !datos || !area) return
    setGuardando(true); setError('')
    try {
      const res = await fetch('/api/semaforo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` },
        body: JSON.stringify({ momento: datos.momento, area, marcas: borrador }),
      })
      const d = await res.json()
      if (!res.ok) { setError(d?.error || 'No se pudo guardar.'); setGuardando(false); return }
      setDatos(prev => prev ? { ...prev, marcas: { ...prev.marcas, [area]: { ...borrador } } } : prev)
      setAviso(`✓ ${area} guardada`)
      setArea(null)
      window.scrollTo(0, 0)
    } catch { setError('No se pudo conectar con el servidor.') }
    setGuardando(false)
  }

  async function enviarDireccion() {
    const t = await token()
    if (!t || !datos) return
    setGuardando(true); setError('')
    try {
      const res = await fetch('/api/semaforo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` },
        body: JSON.stringify({ momento: datos.momento, accion: 'enviar' }),
      })
      const d = await res.json()
      if (!res.ok) setError(d?.error || 'No se pudo enviar.')
      else { setDatos(prev => prev ? { ...prev, enviado_en: d.enviado_en } : prev); setAviso('✓ Semáforo enviado a dirección') }
    } catch { setError('No se pudo conectar con el servidor.') }
    setGuardando(false)
  }

  if (!profile) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
      <p style={{ color: C.indigo }}>Cargando...</p>
    </div>
  )

  const grupo = datos?.grado ? `${gradoCorto(datos.grado)}${datos.grupo_letra ? ` ${datos.grupo_letra}` : ''}` : ''
  const nombreMomento = datos?.momentos.find(m => m.clave === datos.momento)?.nombre || ''
  const subtitulo = [grupo, nombreMomento, datos?.ciclo && `Ciclo ${datos.ciclo}`].filter(Boolean).join(' · ')
  const total = datos?.alumnos.length || 0
  const completas = datos ? datos.areas.filter(a => datos.alumnos.every(c => datos.marcas[a]?.[c])).length : 0
  const todoCompleto = !!datos && total > 0 && completas === datos.areas.length

  return (
    <SidebarWrapper profile={profile}>
      <div style={{ padding: '0 16px 48px' }}>
        <EncabezadoPagina antetitulo="Evaluar" titulo="Semáforo" subtitulo={subtitulo} />

        <div style={{ maxWidth: 720, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {error && <div style={{ ...card, borderColor: '#F8D7DA', color: '#8B3A3E', fontSize: 14 }}>{error}</div>}
          {aviso && !error && <div role="status" style={{ ...card, background: '#E9F6F1', borderColor: '#BFE3D6', color: C.cianOscuro, fontSize: 14, fontWeight: 700 }}>{aviso}</div>}

          {!datos ? null : total === 0 ? (
            <div style={card}>
              <p style={{ margin: 0, fontSize: 14, color: C.suave, lineHeight: 1.6 }}>
                Para llenar el semáforo, primero registra tu lista de alumnos en{' '}
                <button onClick={() => router.push('/mi-grupo')} style={{ background: 'none', border: 'none', padding: 0, color: C.indigo, fontWeight: 700, textDecoration: 'underline', cursor: 'pointer', fontSize: 14, fontFamily: 'inherit' }}>Mi grupo</button>.
              </p>
            </div>
          ) : area ? (
            /* ===== Marcar un área ===== */
            <section style={card}>
              <button onClick={() => setArea(null)} disabled={guardando}
                style={{ background: 'none', border: 'none', padding: 0, color: C.indigo, fontWeight: 700, fontSize: 14, cursor: 'pointer', minHeight: 40, fontFamily: 'inherit' }}>
                ← Áreas
              </button>
              <h2 style={{ ...h2, marginTop: 4 }}>{area}</h2>
              <p style={{ margin: '0 0 12px', fontSize: 13, color: C.suave }}>
                {Object.keys(borrador).length} de {total} niños marcados · {nombreMomento}
              </p>

              {/* Leyenda */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 12px', marginBottom: 14, fontSize: 12.5 }}>
                {NIVELES.map(n => (
                  <span key={n.clave} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: C.texto }}>
                    <span style={{ minWidth: 26, padding: '2px 6px', borderRadius: 6, background: n.fondo, color: n.texto, fontWeight: 800, textAlign: 'center' }}>{n.corto}</span>
                    {n.nombre}
                  </span>
                ))}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {datos.alumnos.map(codigo => (
                  <div key={codigo} style={{ display: 'grid', gridTemplateColumns: '64px repeat(4, minmax(0, 1fr))', gap: 6, alignItems: 'center' }}>
                    <span style={{ fontWeight: 800, fontSize: 14, color: borrador[codigo] ? C.texto : C.suave }}>{codigo}</span>
                    {NIVELES.map(n => {
                      const activo = borrador[codigo] === n.clave
                      return (
                        <button key={n.clave} aria-label={`${codigo}: ${n.nombre}`} aria-pressed={activo}
                          onClick={() => setBorrador(b => ({ ...b, [codigo]: n.clave }))}
                          style={{
                            minHeight: 44, borderRadius: 10, fontSize: 14, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit',
                            background: activo ? n.fondo : 'white',
                            color: activo ? n.texto : '#9CA3AF',
                            border: activo ? `2px solid ${n.texto}` : `1px solid ${C.borde}`,
                          }}>
                          {n.corto}
                        </button>
                      )
                    })}
                  </div>
                ))}
              </div>

              <button onClick={guardarArea} disabled={guardando || Object.keys(borrador).length === 0}
                style={{ marginTop: 16, width: '100%', minHeight: 48, background: C.cianOscuro, color: 'white', border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: 'pointer', opacity: guardando || Object.keys(borrador).length === 0 ? 0.6 : 1, fontFamily: 'inherit' }}>
                {guardando ? 'Guardando…' : Object.keys(borrador).length < total ? `Guardar (faltan ${total - Object.keys(borrador).length})` : 'Guardar'}
              </button>
            </section>
          ) : (
            <>
              {/* ===== Momentos ===== */}
              <section style={card}>
                <h2 style={h2}>Momento</h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 140px), 1fr))', gap: 8, marginTop: 10 }}>
                  {datos.momentos.map(m => {
                    const activo = m.clave === datos.momento
                    return (
                      <button key={m.clave} onClick={() => cargar(m.clave)}
                        style={{
                          minHeight: 56, padding: '8px 10px', borderRadius: 10, cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
                          background: activo ? C.indigo : 'white', color: activo ? 'white' : C.texto,
                          border: activo ? `1px solid ${C.indigo}` : `1px solid ${C.borde}`,
                        }}>
                        <span style={{ display: 'block', fontSize: 14, fontWeight: 700 }}>{m.nombre}</span>
                        <span style={{ display: 'block', fontSize: 12, opacity: 0.8 }}>
                          {m.cuando}{m.clave === datos.momentoSugerido ? ' · ahora' : ''}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </section>

              {/* ===== Áreas ===== */}
              <section style={card}>
                <h2 style={h2}>Áreas</h2>
                <p style={{ margin: '0 0 12px', fontSize: 13, color: C.suave }}>{completas} de {datos.areas.length} completas · {total} niños</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {datos.areas.map(a => {
                    const m = datos.marcas[a] || {}
                    const hechos = datos.alumnos.filter(c => m[c]).length
                    const completa = hechos === total
                    return (
                      <button key={a} onClick={() => abrirArea(a)}
                        style={{ width: '100%', textAlign: 'left', background: '#F7F7FC', border: 'none', borderRadius: 10, padding: '12px 14px', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: C.texto }}>{a}</p>
                          <p style={{ margin: '2px 0 6px', fontSize: 13, color: completa ? C.cianOscuro : C.suave, fontWeight: completa ? 700 : 400 }}>
                            {completa ? '✓ Completa' : `${hechos} de ${total} marcados`}
                          </p>
                          {hechos > 0 && (
                            <div style={{ display: 'flex', gap: 2, height: 8 }}>
                              {NIVELES.map(n => {
                                const cuantos = datos.alumnos.filter(c => m[c] === n.clave).length
                                return cuantos > 0 ? <div key={n.clave} title={`${n.nombre}: ${cuantos}`} style={{ flex: cuantos, background: n.texto, opacity: 0.75, borderRadius: 3 }} /> : null
                              })}
                              {total - hechos > 0 && <div style={{ flex: total - hechos, background: '#E5E7EB', borderRadius: 3 }} />}
                            </div>
                          )}
                        </div>
                        <span style={{ flexShrink: 0, background: C.cianOscuro, color: 'white', fontSize: 14, fontWeight: 700, padding: '9px 14px', borderRadius: 10 }}>
                          {hechos === 0 ? 'Marcar' : 'Revisar'}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </section>

              {/* ===== Enviar ===== */}
              <section style={card}>
                {datos.enviado_en && (
                  <p style={{ margin: '0 0 10px', fontSize: 14, color: C.cianOscuro, fontWeight: 700 }}>
                    ✓ Enviado a dirección el {fechaCorta(datos.enviado_en)}
                  </p>
                )}
                <button onClick={enviarDireccion} disabled={!todoCompleto || guardando}
                  style={{ width: '100%', minHeight: 48, background: todoCompleto ? C.indigo : '#E5E7EB', color: todoCompleto ? 'white' : C.suave, border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: todoCompleto ? 'pointer' : 'default', fontFamily: 'inherit' }}>
                  {datos.enviado_en ? 'Volver a enviar a dirección' : 'Enviar a dirección'}
                </button>
                {!todoCompleto && (
                  <p style={{ margin: '8px 0 0', fontSize: 13, color: C.suave, textAlign: 'center' }}>Se activa cuando las {datos.areas.length} áreas estén completas.</p>
                )}
                <BotonWordSemaforo momento={datos.momento} hayCapturas={datos.areas.some(a => Object.keys(datos.marcas[a] || {}).length > 0)} />
              </section>
            </>
          )}
        </div>
      </div>
    </SidebarWrapper>
  )
}
