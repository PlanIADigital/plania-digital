'use client'
// ============================================================
//  PlanIA Digital — app/directivo/dashboard/page.tsx
//
//  [2 oct 2026] Dashboard del directivo = MIRADA ESTRATÉGICA del jardín.
//  La lista de docentes vive en Mis docentes (no se repite aquí).
//  Datos: /api/directivo/jardin (token Bearer), calculados con las mismas
//  funciones que Mi Avance; un PDA trabajado por dos docentes cuenta una vez.
//  Diseño aprobado en el lienzo "Dashboard del directivo":
//   - Encabezado de 3 renglones igual al de la educadora (saludo por hora
//     del estado del CCT, primer nombre, fecha · jardín · ciclo).
//   - Cifras, asistencia (PRONTO), medidores por campo (colores oficiales
//     + código LEN/SPC/ENS/DHC), radar de ejes, equilibrio por grado,
//     PDA por grado y mes, ritmo semanal, prioritarios por origen,
//     alumnos por grado, modalidades, observaciones y semáforo (PRONTO).
//  El directivo SOLO VE; nada en esta página modifica datos.
// ============================================================
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import SidebarWrapper from '@/components/SidebarWrapper'
import EncabezadoPagina from '@/components/EncabezadoPagina'
import { colorCampo } from '@/lib/coloresCampos'
import { zonaHorariaPorCCT } from '@/lib/fechaMexico'
import { nombreJardin } from '@/lib/useDocentesDirectivo'
import { nombrePila } from '@/lib/nombrePila'
import AsistenciaJardin from '@/components/AsistenciaJardin'

const supabase = createClient()

const C = {
  indigo: '#3D3A8C', indigoClaro: '#EEEDF8', indigoMedio: '#7A77C7', indigoSuave: '#C9C7EC',
  cian: '#00A896', cianOscuro: '#00806F', asistencia: '#00897A',
  texto: '#1A1A2E', suave: '#6B7280', borde: '#E0DFF5', linea: '#E5E7EB',
}

const ETIQUETA_CAMPO: Record<string, string> = {
  'Lenguajes': 'Lenguajes (LEN)',
  'Saberes y Pensamiento Científico': 'Saberes… (SPC)',
  'Ética, Naturaleza y Sociedades': 'Ética… (ENS)',
  'De lo Humano y lo Comunitario': 'Humano… (DHC)',
}

// Los 7 ejes articuladores (orden del radar) y la palabra que los identifica.
const EJES = [
  { corto: 'Inclusión', clave: 'inclusi' },
  { corto: 'Pens. crítico', clave: 'pensamiento cr' },
  { corto: 'Intercultural', clave: 'intercultural' },
  { corto: 'Igualdad', clave: 'igualdad' },
  { corto: 'Vida saludable', clave: 'saludable' },
  { corto: 'Lectura', clave: 'lectura' },
  { corto: 'Artes', clave: 'artes' },
]

type DatosJardin = {
  ciclo: string
  hoy: string
  meses: { anterior: string; actual: string }
  docentes: { total: number; conPlaneaciones: number }
  planeaciones: number
  pdaDistintos: number
  campos: Array<{ nombre: string; distintos: number; total: number }>
  porGrado: Array<{ grado: string; docentes: number; alumnos: number; campos: Record<string, number>; pdaMesAnterior: number; pdaMesActual: number }>
  ejes: { conteo: Record<string, number>; planeaciones: number }
  modalidades: Array<{ nombre: string; cantidad: number }>
  ritmo: Array<{ semana: string; dias: number }>
  prioritarios: { total: number; atendidos: number; porOrigen: Array<{ clave: string; etiqueta: string; total: number; atendidos: number }> }
  observaciones: string[]
}

const st = {
  card: { background: 'white', border: `1px solid ${C.borde}`, borderRadius: 12, padding: '16px 18px', minWidth: 0 } as React.CSSProperties,
  h2: { margin: '0 0 4px', fontSize: 13, fontWeight: 800, color: C.texto, textTransform: 'uppercase', letterSpacing: '0.07em' } as React.CSSProperties,
  sub: { margin: '0 0 12px', fontSize: 13, color: C.suave, lineHeight: 1.4 } as React.CSSProperties,
  vacio: { margin: '8px 0', fontSize: 13.5, color: C.suave, lineHeight: 1.5 } as React.CSSProperties,
  pronto: { fontSize: 10, fontWeight: 800, letterSpacing: '0.05em', background: C.indigoClaro, color: C.indigo, padding: '3px 8px', borderRadius: 10 } as React.CSSProperties,
  rejilla: (min: number) => ({ display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(min(100%, ${min}px), 1fr))`, gap: 12 }) as React.CSSProperties,
}

function nombreMes(yyyyMM: string): string {
  const [y, m] = yyyyMM.split('-').map(Number)
  const t = new Intl.DateTimeFormat('es-MX', { month: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, 15)))
  return t.charAt(0).toUpperCase() + t.slice(1)
}

function Leyenda({ items }: { items: Array<{ color: string; texto: string }> }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 14px', marginBottom: 12, fontSize: 12.5, color: '#374151' }}>
      {items.map(i => (
        <span key={i.texto} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 10, height: 10, borderRadius: 3, background: i.color }} />{i.texto}
        </span>
      ))}
    </div>
  )
}

function Cifra({ titulo, valor, nota, notaColor }: { titulo: string; valor: string; nota: string; notaColor?: string }) {
  return (
    <div style={{ ...st.card, padding: '14px 16px' }}>
      <p style={{ margin: '0 0 6px', fontSize: 13, fontWeight: 700, color: C.suave }}>{titulo}</p>
      <p style={{ margin: 0, fontSize: 30, fontWeight: 800, lineHeight: 1.1, color: C.texto }}>{valor}</p>
      <p style={{ margin: '2px 0 0', fontSize: 12.5, color: notaColor || C.suave, fontWeight: notaColor ? 600 : 400 }}>{nota}</p>
    </div>
  )
}

// Medio círculo: largo del arco = π·50 ≈ 157.
function Medidor({ nombre, distintos, total }: { nombre: string; distintos: number; total: number }) {
  const pct = total > 0 ? Math.round((distintos / total) * 100) : 0
  const largo = (Math.min(pct, 100) / 100) * 157.08
  return (
    <div style={{ textAlign: 'center', padding: '8px 4px' }}>
      <svg viewBox="0 0 120 70" style={{ width: '100%', maxWidth: 190 }} role="img" aria-label={`${nombre}: ${distintos} de ${total} PDA, ${pct}%`}>
        <path d="M10,62 A50,50 0 0 1 110,62" fill="none" stroke={C.indigoClaro} strokeWidth="10" strokeLinecap="round" />
        {pct > 0 && (
          <path d="M10,62 A50,50 0 0 1 110,62" fill="none" stroke={colorCampo(nombre).base} strokeWidth="10" strokeLinecap="round" strokeDasharray={`${largo} 200`} />
        )}
        <text x="60" y="56" textAnchor="middle" fontSize="18" fontWeight="800" fill={C.texto}>{pct}%</text>
      </svg>
      <p style={{ margin: '2px 0 0', fontSize: 14, fontWeight: 800 }}>{ETIQUETA_CAMPO[nombre] || nombre}</p>
      <p style={{ margin: 0, fontSize: 12.5, color: C.suave }}>{distintos} de {total} PDA</p>
    </div>
  )
}

function Radar({ valores }: { valores: Array<{ corto: string; pct: number }> }) {
  const cx = 160, cy = 150, R = 100, n = valores.length
  const punto = (i: number, r: number) => {
    const a = (-90 + (i * 360) / n) * Math.PI / 180
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)]
  }
  const poligono = (f: (i: number) => number) => valores.map((_, i) => punto(i, f(i)).map(v => v.toFixed(1)).join(',')).join(' ')
  return (
    <svg viewBox="-50 10 420 270" style={{ width: '100%', maxWidth: 420, display: 'block', margin: '0 auto' }} role="img"
      aria-label={`Ejes articuladores: ${valores.map(v => `${v.corto} ${v.pct}%`).join(', ')}`}>
      <polygon points={poligono(() => R)} fill="none" stroke={C.linea} />
      <polygon points={poligono(() => R / 2)} fill="none" stroke={C.linea} />
      {/* Marcas de escala: centro 0%, anillo medio 50%, borde 100% */}
      <text x={cx + 5} y={cy - R / 2 + 11} fontSize="9.5" fontWeight="600" fill="#9CA3AF">50%</text>
      <text x={cx + 5} y={cy - R + 11} fontSize="9.5" fontWeight="600" fill="#9CA3AF">100%</text>
      {valores.map((_, i) => { const [x, y] = punto(i, R); return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke={C.linea} /> })}
      <polygon points={poligono(i => (R * valores[i].pct) / 100)} fill={C.indigo} fillOpacity={0.16} stroke={C.indigo} strokeWidth={2} strokeLinejoin="round" />
      {valores.map((v, i) => {
        const [x, y] = punto(i, (R * v.pct) / 100)
        return <circle key={`p${i}`} cx={x} cy={y} r={4} fill={C.indigo} stroke="white" strokeWidth={2}><title>{`${v.corto}: ${v.pct}%`}</title></circle>
      })}
      {valores.map((v, i) => {
        const [x, y] = punto(i, R + 18)
        const ancla = Math.abs(x - cx) < 5 ? 'middle' : x > cx ? 'start' : 'end'
        return <text key={`t${i}`} x={x} y={y + 4} textAnchor={ancla} fontSize="12" fontWeight="700" fill={C.texto}>{`${v.corto} ${v.pct}%`}</text>
      })}
    </svg>
  )
}

function BarraApilada({ partes }: { partes: Array<{ valor: number; color: string; titulo: string }> }) {
  const visibles = partes.filter(p => p.valor > 0)
  if (visibles.length === 0) return <div style={{ height: 22, border: '1px dashed #D1D5DB', borderRadius: 4 }} />
  return (
    <div style={{ display: 'flex', gap: 2, height: 22 }}>
      {visibles.map((p, i) => (
        <div key={p.titulo} title={p.titulo} style={{
          flex: p.valor, background: p.color,
          borderRadius: `${i === 0 ? 4 : 0}px ${i === visibles.length - 1 ? 4 : 0}px ${i === visibles.length - 1 ? 4 : 0}px ${i === 0 ? 4 : 0}px`,
        }} />
      ))}
    </div>
  )
}

function Ritmo({ datos }: { datos: Array<{ semana: string; dias: number }> }) {
  const max = Math.max(10, ...datos.map(d => d.dias))
  const tope = Math.ceil(max / 10) * 10 + (Math.ceil(max / 10) % 2)  * 10
  const x0 = 34, x1 = 306, y0 = 145, y1 = 20
  const x = (i: number) => datos.length === 1 ? (x0 + x1) / 2 : x0 + (i * (x1 - x0)) / (datos.length - 1)
  const y = (v: number) => y0 - (v / tope) * (y0 - y1)
  const linea = datos.map((d, i) => `${x(i).toFixed(1)},${y(d.dias).toFixed(1)}`).join(' ')
  const etiqueta = (f: string) => { const [, m, d] = f.split('-'); return `${Number(d)}/${Number(m)}` }
  const ultimo = datos[datos.length - 1]
  return (
    <svg viewBox="0 0 320 172" style={{ width: '100%', display: 'block' }} role="img"
      aria-label={`Días planeados por semana: ${datos.map(d => `semana del ${etiqueta(d.semana)}, ${d.dias}`).join('; ')}`}>
      {[0, 0.5, 1].map(f => (
        <g key={f}>
          <line x1={x0} y1={y(tope * f)} x2={x1 + 6} y2={y(tope * f)} stroke={f === 0 ? '#D1D5DB' : '#F0F0F0'} />
          <text x={x0 - 6} y={y(tope * f) + 4} textAnchor="end" fontSize="10" fill={C.suave}>{Math.round(tope * f)}</text>
        </g>
      ))}
      <polygon points={`${x(0)},${y0} ${linea} ${x(datos.length - 1)},${y0}`} fill={C.cian} fillOpacity={0.14} />
      <polyline points={linea} fill="none" stroke={C.cianOscuro} strokeWidth={2} strokeLinejoin="round" />
      {datos.map((d, i) => (
        <circle key={d.semana} cx={x(i)} cy={y(d.dias)} r={4} fill={C.cianOscuro} stroke="white" strokeWidth={2}>
          <title>{`Semana del ${etiqueta(d.semana)}: ${d.dias} días`}</title>
        </circle>
      ))}
      {ultimo && <text x={x(datos.length - 1)} y={y(ultimo.dias) - 9} textAnchor="middle" fontSize="11" fontWeight="700" fill={C.texto}>{ultimo.dias}</text>}
      {datos.map((d, i) => (
        <text key={`e${d.semana}`} x={x(i)} y={164} textAnchor="middle" fontSize="10" fill={C.suave}>{etiqueta(d.semana)}</text>
      ))}
    </svg>
  )
}

function Dona({ partes, total }: { partes: Array<{ valor: number; color: string; titulo: string }>; total: number }) {
  const circ = 2 * Math.PI * 38
  let acumulado = 0
  return (
    <svg viewBox="0 0 100 100" style={{ width: 130, flexShrink: 0 }} role="img" aria-label={partes.map(p => `${p.titulo}`).join('; ')}>
      <circle cx="50" cy="50" r="38" fill="none" stroke={C.indigoClaro} strokeWidth="16" />
      {total > 0 && partes.filter(p => p.valor > 0).map(p => {
        const largo = (p.valor / total) * circ
        const segmento = (
          <circle key={p.titulo} cx="50" cy="50" r="38" fill="none" stroke={p.color} strokeWidth="16"
            strokeDasharray={`${Math.max(largo - 1, 0)} ${circ}`} strokeDashoffset={-acumulado} transform="rotate(-90 50 50)">
            <title>{p.titulo}</title>
          </circle>
        )
        acumulado += largo
        return segmento
      })}
      <text x="50" y="55" textAnchor="middle" fontSize="16" fontWeight="800" fill={C.texto}>{total}</text>
    </svg>
  )
}

export default function DirectivoDashboardPage() {
  const router = useRouter()
  const [profile, setProfile] = useState<any>(null)
  const [datos, setDatos] = useState<DatosJardin | null>(null)
  const [errorCarga, setErrorCarga] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/auth/login'); return }
      const { data: user } = await supabase.from('users').select('*').eq('auth_uid', session.user.id).single()
      if (!user?.profile_completed) { router.push('/onboarding'); return }
      if (user.role !== 'directivo') { router.push('/dashboard'); return }
      setProfile(user)
      try {
        const res = await fetch('/api/directivo/jardin', { headers: { Authorization: `Bearer ${session.access_token}` } })
        const data = await res.json()
        if (!res.ok) setErrorCarga(data?.error || 'No se pudo cargar la información del jardín.')
        else setDatos(data as DatosJardin)
      } catch {
        setErrorCarga('No se pudo conectar con el servidor. Intenta de nuevo.')
      }
      setLoading(false)
    }
    load()
  }, [])

  if (loading || !profile) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
      <p style={{ color: C.indigo }}>Cargando...</p>
    </div>
  )

  // Saludo y fecha según la hora del estado del CCT (igual que la educadora).
  const primerNombre = nombrePila(profile?.full_name)
  const { fechaTexto, saludo } = (() => {
    const ahora = new Date()
    const formatear = (tz: string) => {
      const f = new Intl.DateTimeFormat('es-MX', { timeZone: tz, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(ahora)
      const h = Number(new Intl.DateTimeFormat('es-MX', { timeZone: tz, hour: 'numeric', hourCycle: 'h23' }).format(ahora))
      return { fechaTexto: f.charAt(0).toUpperCase() + f.slice(1), saludo: h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches' }
    }
    try { return formatear(zonaHorariaPorCCT(profile?.cct_primary) || 'America/Mexico_City') }
    catch { return formatear('America/Mexico_City') }
  })()
  const subtitulo = [fechaTexto, nombreJardin(profile.school_name), datos?.ciclo && `Ciclo ${datos.ciclo}`].filter(Boolean).join(' · ')

  const d = datos
  const hayPlanes = !!d && d.planeaciones > 0
  const ejes = EJES.map(e => {
    const n = d ? Object.entries(d.ejes.conteo).filter(([k]) => k.toLowerCase().includes(e.clave)).reduce((s, [, v]) => s + v, 0) : 0
    return { corto: e.corto, pct: d && d.ejes.planeaciones > 0 ? Math.min(100, Math.round((n / d.ejes.planeaciones) * 100)) : 0 }
  })
  const maxPdaMes = d ? Math.max(1, ...d.porGrado.flatMap(g => [g.pdaMesAnterior, g.pdaMesActual])) : 1
  const totalAlumnos = d ? d.porGrado.reduce((s, g) => s + g.alumnos, 0) : 0
  const tonosGrado: Record<string, string> = { '1°': C.indigoSuave, '2°': C.indigoMedio, '3°': C.indigo }
  const maxMod = d ? Math.max(1, ...d.modalidades.map(m => m.cantidad)) : 1

  return (
    <SidebarWrapper profile={profile}>
      <div style={{ padding: '0 16px 48px' }}>
        <EncabezadoPagina antetitulo={`¡${saludo},`} titulo={`${primerNombre}!`} subtitulo={subtitulo} maxWidth={1080} />

        <div style={{ maxWidth: 1080, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {errorCarga || !d ? (
            <div style={{ ...st.card, textAlign: 'center', padding: '28px 20px' }}>
              <p style={{ fontSize: 14, color: C.texto, margin: 0, lineHeight: 1.6 }}>{errorCarga || 'Sin información.'}</p>
            </div>
          ) : (
            <>
              {/* Cifras del jardín */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 160px), 1fr))', gap: 10 }}>
                <Cifra titulo="Docentes" valor={String(d.docentes.total)}
                  nota={d.docentes.total === 0 ? 'Aún sin registro' : `${d.docentes.conPlaneaciones} ya ${d.docentes.conPlaneaciones === 1 ? 'planeó' : 'planearon'} este ciclo`}
                  notaColor={d.docentes.conPlaneaciones > 0 ? C.cianOscuro : undefined} />
                <Cifra titulo="Planeaciones" valor={String(d.planeaciones)} nota="en el ciclo" />
                <Cifra titulo="PDA trabajados" valor={String(d.pdaDistintos)} nota="distintos, en todo el jardín" />
                <Cifra titulo="PDA prioritarios" valor={d.prioritarios.total > 0 ? `${d.prioritarios.atendidos}/${d.prioritarios.total}` : '—'}
                  nota={d.prioritarios.total > 0 ? 'atendidos' : 'Sin diagnóstico capturado'} />
              </div>

              {/* Asistencia del jardín (hoy y semana) */}
              <AsistenciaJardin jardin={nombreJardin(profile.school_name)} />

              {/* Avance por campo formativo */}
              <section style={st.card}>
                <h2 style={st.h2}>Avance por campo formativo</h2>
                <p style={st.sub}>PDA distintos trabajados en el jardín, del total de cada campo</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 150px), 1fr))', gap: 12 }}>
                  {d.campos.map(c => <Medidor key={c.nombre} {...c} />)}
                </div>
              </section>

              {/* Ejes y equilibrio por grado */}
              <div style={st.rejilla(340)}>
                <section style={st.card}>
                  <h2 style={st.h2}>Perfil de ejes articuladores</h2>
                  <p style={st.sub}>% de planeaciones del jardín que trabajan cada eje</p>
                  {hayPlanes ? <Radar valores={ejes} /> : <p style={st.vacio}>Aparecerá cuando haya planeaciones en el ciclo.</p>}
                </section>
                <section style={st.card}>
                  <h2 style={st.h2}>Equilibrio curricular por grado</h2>
                  <p style={st.sub}>Reparto de PDA trabajados entre los 4 campos</p>
                  {d.porGrado.length === 0 ? <p style={st.vacio}>Aparecerá cuando las docentes configuren su grupo.</p> : (
                    <>
                      <Leyenda items={d.campos.map(c => ({ color: colorCampo(c.nombre).base, texto: ETIQUETA_CAMPO[c.nombre] }))} />
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                        {d.porGrado.map(g => (
                          <div key={g.grado} style={{ display: 'grid', gridTemplateColumns: '30px minmax(0,1fr)', alignItems: 'center', gap: 10 }}>
                            <span style={{ fontWeight: 800, fontSize: 14 }}>{g.grado}</span>
                            <BarraApilada partes={d.campos.map(c => ({
                              valor: g.campos[c.nombre] || 0, color: colorCampo(c.nombre).base,
                              titulo: `${g.grado}: ${ETIQUETA_CAMPO[c.nombre]} ${g.campos[c.nombre] || 0} PDA`,
                            }))} />
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </section>
              </div>

              {/* PDA por grado y mes + ritmo */}
              <div style={st.rejilla(340)}>
                <section style={st.card}>
                  <h2 style={st.h2}>PDA trabajados por grado</h2>
                  <p style={st.sub}>Mes anterior contra mes actual</p>
                  {d.porGrado.length === 0 ? <p style={st.vacio}>Aparecerá cuando las docentes configuren su grupo.</p> : (
                    <>
                      <Leyenda items={[{ color: '#A9A6DD', texto: nombreMes(d.meses.anterior) }, { color: C.indigo, texto: nombreMes(d.meses.actual) }]} />
                      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${d.porGrado.length}, minmax(0,1fr))`, gap: 18, height: 170, alignItems: 'end', borderBottom: `1px solid ${C.linea}`, padding: '0 8px' }}>
                        {d.porGrado.map(g => (
                          <div key={g.grado} style={{ display: 'flex', gap: 2, alignItems: 'flex-end', height: '100%' }}>
                            {[{ v: g.pdaMesAnterior, c: '#A9A6DD', m: d.meses.anterior, peso: 400 }, { v: g.pdaMesActual, c: C.indigo, m: d.meses.actual, peso: 700 }].map(b => (
                              <div key={b.m} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%', flex: 1 }}>
                                <span style={{ fontSize: 11.5, fontWeight: b.peso, color: b.peso === 700 ? C.texto : C.suave }}>{b.v}</span>
                                <div title={`${g.grado} ${nombreMes(b.m)}: ${b.v} PDA`} style={{ width: '100%', height: `${(b.v / maxPdaMes) * 88}%`, minHeight: b.v > 0 ? 3 : 0, background: b.c, borderRadius: '4px 4px 0 0' }} />
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${d.porGrado.length}, minmax(0,1fr))`, gap: 18, padding: '6px 8px 0', fontSize: 13, fontWeight: 700, textAlign: 'center' }}>
                        {d.porGrado.map(g => <span key={g.grado}>{g.grado}</span>)}
                      </div>
                    </>
                  )}
                </section>
                <section style={st.card}>
                  <h2 style={st.h2}>Ritmo de planeación</h2>
                  <p style={st.sub}>Días planeados por semana en todo el jardín (lunes a viernes)</p>
                  {d.ritmo.length === 0 || !hayPlanes ? <p style={st.vacio}>Aparecerá cuando haya planeaciones en el ciclo.</p> : <Ritmo datos={d.ritmo} />}
                </section>
              </div>

              {/* Prioritarios y alumnos por grado */}
              <div style={st.rejilla(340)}>
                <section style={st.card}>
                  <h2 style={st.h2}>PDA prioritarios</h2>
                  <p style={st.sub}>Atendidos según su origen</p>
                  {d.prioritarios.total === 0 ? <p style={st.vacio}>Aparecerá cuando las docentes capturen sus diagnósticos en Mi grupo.</p> : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                      {d.prioritarios.porOrigen.map(o => (
                        <div key={o.clave}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13.5, marginBottom: 5 }}>
                            <span style={{ fontWeight: 700 }}>{o.etiqueta}</span>
                            <span style={{ color: C.suave }}>{o.total > 0 ? `${o.atendidos} de ${o.total}` : 'Sin registrar'}</span>
                          </div>
                          <div style={{ height: 10, background: C.indigoClaro, borderRadius: 99, overflow: 'hidden' }}>
                            <div title={`${o.etiqueta}: ${o.atendidos} de ${o.total}`} style={{ width: `${o.total > 0 ? (o.atendidos / o.total) * 100 : 0}%`, height: '100%', background: C.indigo, borderRadius: 99 }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                <section style={st.card}>
                  <h2 style={st.h2}>Alumnos por grado</h2>
                  <p style={st.sub}>{totalAlumnos > 0 ? `${totalAlumnos} niños en el jardín` : 'Según las listas de cada grupo'}</p>
                  {totalAlumnos === 0 ? <p style={st.vacio}>Aparecerá cuando las docentes registren su lista de alumnos.</p> : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                      <Dona total={totalAlumnos} partes={d.porGrado.map(g => ({ valor: g.alumnos, color: tonosGrado[g.grado] || C.indigo, titulo: `${g.grado}: ${g.alumnos} niños` }))} />
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13.5 }}>
                        {d.porGrado.map(g => (
                          <span key={g.grado} style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ width: 10, height: 10, borderRadius: 3, background: tonosGrado[g.grado] || C.indigo }} />
                            <strong>{g.grado}</strong> {g.alumnos} niños
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </section>

              </div>

              {/* Modalidades y observaciones */}
              <div style={st.rejilla(340)}>
                <section style={st.card}>
                  <h2 style={st.h2}>Modalidades de trabajo</h2>
                  <p style={st.sub}>Planeaciones del ciclo por modalidad</p>
                  {d.modalidades.length === 0 ? <p style={st.vacio}>Aparecerá cuando haya planeaciones en el ciclo.</p> : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13 }}>
                      {d.modalidades.map(m => (
                        <div key={m.nombre} style={{ display: 'grid', gridTemplateColumns: '120px minmax(0,1fr) 28px', alignItems: 'center', gap: 8 }}>
                          <span style={{ overflowWrap: 'anywhere' }}>{m.nombre}</span>
                          <div title={`${m.nombre}: ${m.cantidad}`} style={{ height: 10, width: `${(m.cantidad / maxMod) * 100}%`, background: C.indigo, borderRadius: '0 4px 4px 0' }} />
                          <span style={{ textAlign: 'right', fontWeight: 700 }}>{m.cantidad}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
                <section style={st.card}>
                  <h2 style={{ ...st.h2, marginBottom: 12 }}>Observaciones relevantes</h2>
                  {d.observaciones.length === 0 ? <p style={st.vacio}>Sin observaciones por ahora.</p> : (
                    <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10, fontSize: 14, lineHeight: 1.45 }}>
                      {d.observaciones.map((o, i) => (
                        <li key={i} style={{ display: 'flex', gap: 10, padding: '10px 12px', background: '#F7F7FC', borderRadius: 10 }}>
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: C.indigo, marginTop: 7, flexShrink: 0 }} />
                          <span>{o}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  <button onClick={() => router.push('/directivo/docentes')}
                    style={{ marginTop: 8, minHeight: 44, background: 'none', border: 'none', padding: 0, color: C.indigo, fontSize: 14, fontWeight: 700, cursor: 'pointer', textDecoration: 'underline' }}>
                    Ver mis docentes →
                  </button>
                </section>
              </div>

              {/* Semáforo (ancho completo) */}
                <section style={{ ...st.card, border: `1px dashed ${C.indigoSuave}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
                    <h2 style={{ ...st.h2, margin: 0 }}>Semáforo de avance</h2><span style={st.pronto}>PRONTO</span>
                  </div>
                  <p style={st.vacio}>Niños en Logrado, En proceso y Requiere apoyo por grado. Se activará cuando la educadora registre el nivel de sus alumnos.</p>
                </section>
            </>
          )}
        </div>
      </div>
    </SidebarWrapper>
  )
}
