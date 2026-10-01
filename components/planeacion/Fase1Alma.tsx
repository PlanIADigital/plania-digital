'use client'
// components/planeacion/Fase1Alma.tsx
// [30 sep 2026] Fase 1 de Nueva Planeación — "El alma de tu planeación".
// Principio innegociable: MÍA PROPONE, la educadora DECIDE. Ninguna
// propuesta llega al campo final sin que ella la elija, y ningún paso
// avanza sin su confirmación explícita.
// Orden: 1 Situación problema → 2 Propósito → 3 Título → 4 Recursos (opcional, sin IA).

import { useEffect, useRef, useState } from 'react'
import { fetchConSesion } from '@/lib/fetchConSesion'

export interface ValoresFase1 {
  nombre_proyecto: string
  situacion_problema: string
  finalidad: string
  recursos_materiales: string
}

type Origen = 'PMC' | 'PA' | 'Grupo' | 'Dirección' | 'Jardín'
interface Problematica { id: string; texto: string; origen: Origen }

const MAX_SOLICITUDES = 3

const C = {
  indigo: '#3D3A8C',
  cian: '#00A896',
  menta: '#E8F5F2',
  indigoClaro: '#EEEDF8',
  texto: '#1A1A2E',
  gris: '#6B7280',
  borde: '#E0DFF5',
}

const COLOR_ORIGEN: Record<Origen, { fg: string; bg: string }> = {
  'Grupo': { fg: '#0F6E56', bg: '#E0F5F3' },
  'PMC': { fg: '#3D3A8C', bg: '#EEEDF8' },
  'PA': { fg: '#00796B', bg: '#E8F5F2' },
  'Dirección': { fg: '#5B3F8C', bg: '#F1ECF8' },
  'Jardín': { fg: '#6B5B2E', bg: '#F5F0E1' },
}

const st = {
  card: { background: 'white', border: `1px solid ${C.borde}`, borderRadius: 12, padding: 16, marginBottom: 14 } as React.CSSProperties,
  encabezado: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8 } as React.CSSProperties,
  titulo: { margin: 0, fontSize: 13, fontWeight: 700, color: C.indigo, textTransform: 'uppercase' as const, letterSpacing: '0.07em' } as React.CSSProperties,
  ayuda: { margin: '0 0 12px', fontSize: 13, color: C.gris, lineHeight: 1.6 } as React.CSSProperties,
  label: { display: 'block', margin: '12px 0 6px', fontSize: 13, fontWeight: 600, color: C.texto } as React.CSSProperties,
  textarea: { display: 'block', width: '100%', padding: '10px 12px', fontSize: 15, borderRadius: 8, border: `1px solid ${C.borde}`, boxSizing: 'border-box' as const, resize: 'none' as const, overflow: 'hidden' as const, background: 'white', fontFamily: 'inherit', lineHeight: 1.5 } as React.CSSProperties,
  botonMia: { width: '100%', background: C.indigoClaro, color: C.indigo, border: `1.5px solid ${C.indigo}`, padding: '11px 14px', fontSize: 14, fontWeight: 600, borderRadius: 8, cursor: 'pointer' } as React.CSSProperties,
  botonConfirmar: { width: '100%', background: C.cian, color: 'white', border: 'none', padding: '12px 14px', fontSize: 15, fontWeight: 700, borderRadius: 8, marginTop: 10 } as React.CSSProperties,
  enlace: { background: 'none', border: 'none', color: C.indigo, fontSize: 13, fontWeight: 600, cursor: 'pointer', padding: 4, textDecoration: 'underline' } as React.CSSProperties,
  aviso: { margin: '8px 0 0', fontSize: 13, color: C.indigo, background: C.indigoClaro, borderRadius: 8, padding: '8px 10px', lineHeight: 1.5 } as React.CSSProperties,
  nota: { margin: '6px 0 0', fontSize: 12, color: C.gris } as React.CSSProperties,
}

async function pedirAMia(body: Record<string, unknown>): Promise<any> {
  const res = await fetchConSesion('/api/sugerir-fase1', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || data?.error) throw new Error(data?.error || 'No se pudo conectar con MÍA. Intenta de nuevo.')
  return data
}

function mensajeDeError(e: unknown): string {
  return e instanceof Error ? e.message : 'Ocurrió un error. Intenta de nuevo.'
}

// ------------------------------------------------------------------
// Paso reutilizable: propuestas de MÍA → versión final → confirmar
// ------------------------------------------------------------------

interface PasoProps {
  numero: number
  titulo: string
  ayuda: string
  bloqueado: boolean
  mensajeBloqueo: string
  confirmado: boolean
  valor: string
  onCambiar: (v: string) => void
  onConfirmar: () => void
  onEditar: () => void
  opciones: string[]
  cargando: boolean
  error: string
  usos: number
  puedeSugerir: boolean
  onSugerir: () => void
  textoSugerir: string
  placeholder: string
  filas?: number
  children?: React.ReactNode
}

function PasoRedaccion(p: PasoProps) {
  const refFinal = useRef<HTMLTextAreaElement>(null)

  // Ajusta la altura también cuando el texto llega al elegir una propuesta.
  useEffect(() => {
    const el = refFinal.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [p.valor, p.confirmado, p.bloqueado])

  const restantes = MAX_SOLICITUDES - p.usos

  if (p.confirmado) {
    return (
      <div style={{ ...st.card, borderColor: C.cian, background: '#FAFFFE' }}>
        <div style={st.encabezado}>
          <p style={{ ...st.titulo, color: C.cian }}>✓ {p.numero} · {p.titulo}</p>
          <button onClick={p.onEditar} style={st.enlace}>Editar</button>
        </div>
        <p style={{ margin: 0, fontSize: 15, color: C.texto, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{p.valor}</p>
      </div>
    )
  }

  return (
    <div style={{ ...st.card, opacity: p.bloqueado ? 0.6 : 1 }}>
      <div style={st.encabezado}>
        <p style={st.titulo}>{p.numero} · {p.titulo}</p>
      </div>

      {p.bloqueado ? (
        <p style={{ ...st.ayuda, margin: 0 }}>🔒 {p.mensajeBloqueo}</p>
      ) : (
        <>
          <p style={st.ayuda}>{p.ayuda}</p>

          {p.children}

          <button
            onClick={p.onSugerir}
            disabled={!p.puedeSugerir || p.cargando || restantes <= 0}
            style={{ ...st.botonMia, marginTop: 12, opacity: !p.puedeSugerir || restantes <= 0 ? 0.5 : 1, cursor: !p.puedeSugerir || p.cargando || restantes <= 0 ? 'default' : 'pointer' }}
          >
            {p.cargando ? '✦ MÍA está pensando…' : p.textoSugerir}
          </button>
          <p style={st.nota}>
            {restantes > 0
              ? `Puedes pedir propuestas ${restantes} ${restantes === 1 ? 'vez' : 'veces'} más en este paso.`
              : 'Ya usaste las propuestas de este paso. Puedes escribir o ajustar tu versión abajo.'}
          </p>
          {p.error && <p style={st.aviso}>{p.error}</p>}

          {p.opciones.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <p style={{ ...st.label, marginTop: 0 }}>✦ Propuestas de MÍA — toca una para usarla como base:</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {p.opciones.map((o, i) => {
                  const elegida = p.valor === o
                  return (
                    <button
                      key={i}
                      onClick={() => p.onCambiar(o)}
                      style={{
                        textAlign: 'left', padding: '10px 12px', borderRadius: 8, cursor: 'pointer',
                        fontSize: 14, lineHeight: 1.55, color: C.texto, fontFamily: 'inherit',
                        border: `1.5px solid ${elegida ? C.cian : C.borde}`,
                        background: elegida ? '#E0F5F3' : '#FAFAFE',
                      }}
                    >
                      {o}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          <label style={st.label}>Tu versión final</label>
          <textarea
            ref={refFinal}
            value={p.valor}
            onChange={e => p.onCambiar(e.target.value)}
            placeholder={p.placeholder}
            rows={p.filas || 3}
            style={st.textarea}
          />
          <button
            onClick={p.onConfirmar}
            disabled={!p.valor.trim()}
            style={{ ...st.botonConfirmar, opacity: p.valor.trim() ? 1 : 0.45, cursor: p.valor.trim() ? 'pointer' : 'default' }}
          >
            Confirmar
          </button>
        </>
      )}
    </div>
  )
}

// ------------------------------------------------------------------
// Componente principal
// ------------------------------------------------------------------

interface Fase1Props {
  inicial: ValoresFase1
  gradoGrupo: string
  seccionGrupo: string
  onAvanzar: (valores: ValoresFase1) => void
}

export default function Fase1Alma({ inicial, gradoGrupo, seccionGrupo, onAvanzar }: Fase1Props) {
  // Detección de problemáticas desde Mi Grupo
  const [problematicas, setProblematicas] = useState<Problematica[]>([])
  const [detectando, setDetectando] = useState(true)
  const [errorDetectar, setErrorDetectar] = useState('')
  const [sinFuentes, setSinFuentes] = useState(false)
  const [redetecciones, setRedetecciones] = useState(0)
  const [seleccion, setSeleccion] = useState<string[]>([])
  const [observacion, setObservacion] = useState('')

  // Paso 1 · Situación problema
  const [problema, setProblema] = useState(inicial.situacion_problema)
  const [conf1, setConf1] = useState(!!inicial.situacion_problema.trim())
  const [opc1, setOpc1] = useState<string[]>([])
  const [carg1, setCarg1] = useState(false)
  const [err1, setErr1] = useState('')
  const [usos1, setUsos1] = useState(0)

  // Paso 2 · Propósito
  const [ideas2, setIdeas2] = useState('')
  const [proposito, setProposito] = useState(inicial.finalidad)
  const [conf2, setConf2] = useState(!!inicial.finalidad.trim())
  const [opc2, setOpc2] = useState<string[]>([])
  const [carg2, setCarg2] = useState(false)
  const [err2, setErr2] = useState('')
  const [usos2, setUsos2] = useState(0)

  // Paso 3 · Título
  const [ideas3, setIdeas3] = useState('')
  const [titulo, setTitulo] = useState(inicial.nombre_proyecto)
  const [conf3, setConf3] = useState(!!inicial.nombre_proyecto.trim())
  const [opc3, setOpc3] = useState<string[]>([])
  const [carg3, setCarg3] = useState(false)
  const [err3, setErr3] = useState('')
  const [usos3, setUsos3] = useState(0)

  // Paso 4 · Recursos (opcional, sin IA)
  const [recursos, setRecursos] = useState(inicial.recursos_materiales)

  useEffect(() => {
    detectar(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function detectar(forzar: boolean) {
    setDetectando(true)
    setErrorDetectar('')
    try {
      const data = await pedirAMia({ accion: 'detectar', forzar })
      setProblematicas(Array.isArray(data.items) ? data.items : [])
      setSinFuentes(!!data.sin_fuentes)
      if (forzar) {
        setSeleccion([])
        setRedetecciones(n => n + 1)
      }
    } catch (e) {
      setErrorDetectar(mensajeDeError(e))
    }
    setDetectando(false)
  }

  function alternarSeleccion(id: string) {
    setSeleccion(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id)
      if (prev.length >= 2) return prev
      return [...prev, id]
    })
  }

  async function sugerirProblema() {
    setCarg1(true); setErr1('')
    try {
      const textos = problematicas.filter(p => seleccion.includes(p.id)).map(p => p.texto)
      const data = await pedirAMia({ accion: 'problematica', seleccionadas: textos, observacion })
      setOpc1(data.opciones || [])
      setUsos1(n => n + 1)
    } catch (e) { setErr1(mensajeDeError(e)) }
    setCarg1(false)
  }

  async function sugerirProposito() {
    setCarg2(true); setErr2('')
    try {
      const data = await pedirAMia({ accion: 'proposito', problematica: problema, ideas: ideas2 })
      setOpc2(data.opciones || [])
      setUsos2(n => n + 1)
    } catch (e) { setErr2(mensajeDeError(e)) }
    setCarg2(false)
  }

  async function sugerirTitulo() {
    setCarg3(true); setErr3('')
    try {
      const data = await pedirAMia({ accion: 'titulo', problematica: problema, proposito, ideas: ideas3 })
      setOpc3(data.opciones || [])
      setUsos3(n => n + 1)
    } catch (e) { setErr3(mensajeDeError(e)) }
    setCarg3(false)
  }

  // Editar un paso confirmado reabre también los siguientes (conservando su texto),
  // porque pueden haber dejado de encajar con el cambio.
  function editarPaso(n: 1 | 2 | 3) {
    if (n <= 1) setConf1(false)
    if (n <= 2) setConf2(false)
    setConf3(false)
  }

  const listo = conf1 && conf2 && conf3

  function avanzar() {
    if (!listo) return
    onAvanzar({
      nombre_proyecto: titulo.trim(),
      situacion_problema: problema.trim(),
      finalidad: proposito.trim(),
      recursos_materiales: recursos.trim(),
    })
  }

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      <div style={{ ...st.card, background: C.menta, borderColor: '#CDEBE4' }}>
        <p style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 800, color: C.indigo }}>El alma de tu planeación</p>
        <p style={{ margin: 0, fontSize: 13, color: '#335', lineHeight: 1.6 }}>
          Para <strong>{gradoGrupo}{seccionGrupo ? ` ${seccionGrupo}` : ''}</strong>. MÍA te propone ideas con lo que registraste en Mi Grupo; <strong>tú eliges, ajustas y confirmas</strong> cada paso.
        </p>
      </div>

      {/* Paso 1 · Situación problema */}
      <PasoRedaccion
        numero={1}
        titulo="Situación problema"
        ayuda="MÍA revisó lo que registraste en Mi Grupo y detectó estas problemáticas. Elige hasta 2 y, si quieres, agrega algo que observaste."
        bloqueado={false}
        mensajeBloqueo=""
        confirmado={conf1}
        valor={problema}
        onCambiar={setProblema}
        onConfirmar={() => setConf1(true)}
        onEditar={() => editarPaso(1)}
        opciones={opc1}
        cargando={carg1}
        error={err1}
        usos={usos1}
        puedeSugerir={seleccion.length > 0 || !!observacion.trim()}
        onSugerir={sugerirProblema}
        textoSugerir="✦ Redactar con MÍA"
        placeholder="Elige una propuesta de MÍA o escribe tu propia situación problema."
      >
        {detectando && <p style={st.aviso}>✦ MÍA está revisando lo que registraste en Mi Grupo…</p>}

        {!detectando && errorDetectar && (
          <div style={st.aviso}>
            {errorDetectar}{' '}
            <button onClick={() => detectar(false)} style={st.enlace}>Reintentar</button>
          </div>
        )}

        {!detectando && !errorDetectar && sinFuentes && (
          <p style={st.aviso}>
            Aún no has registrado documentos en <strong>Mi Grupo</strong>. Escribe abajo lo que observas en tu grupo y MÍA te ayuda a redactarlo. Cuando completes Mi Grupo, MÍA te propondrá problemáticas de tu propio contexto.
          </p>
        )}

        {!detectando && problematicas.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {problematicas.map(p => {
              const marcada = seleccion.includes(p.id)
              const lleno = !marcada && seleccion.length >= 2
              const color = COLOR_ORIGEN[p.origen] || COLOR_ORIGEN['Grupo']
              return (
                <button
                  key={p.id}
                  onClick={() => alternarSeleccion(p.id)}
                  disabled={lleno}
                  style={{
                    display: 'flex', gap: 10, alignItems: 'flex-start', textAlign: 'left',
                    padding: '10px 12px', borderRadius: 8, fontFamily: 'inherit',
                    border: `1.5px solid ${marcada ? C.indigo : C.borde}`,
                    background: marcada ? '#F4F3FB' : 'white',
                    opacity: lleno ? 0.5 : 1, cursor: lleno ? 'default' : 'pointer',
                  }}
                >
                  <span style={{
                    width: 18, height: 18, borderRadius: 4, flexShrink: 0, marginTop: 2,
                    border: `1.5px solid ${marcada ? C.indigo : '#B8B6DA'}`,
                    background: marcada ? C.indigo : 'white', color: 'white',
                    fontSize: 12, lineHeight: '16px', textAlign: 'center',
                  }}>{marcada ? '✓' : ''}</span>
                  <span style={{ flex: 1 }}>
                    <span style={{ display: 'inline-block', fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', color: color.fg, background: color.bg, borderRadius: 99, padding: '2px 8px', marginBottom: 4 }}>
                      {p.origen.toUpperCase()}
                    </span>
                    <span style={{ display: 'block', fontSize: 14, color: C.texto, lineHeight: 1.55 }}>{p.texto}</span>
                  </span>
                </button>
              )
            })}
            {redetecciones < MAX_SOLICITUDES && (
              <button onClick={() => detectar(true)} style={{ ...st.enlace, alignSelf: 'flex-start' }}>
                🔄 Detectar otras problemáticas
              </button>
            )}
          </div>
        )}

        <label style={st.label}>
          ¿Observaste algo más en tu grupo? <span style={{ fontWeight: 400, color: C.gris }}>(opcional)</span>
        </label>
        <textarea
          value={observacion}
          onChange={e => setObservacion(e.target.value)}
          onInput={e => { const el = e.currentTarget; el.style.height = 'auto'; el.style.height = `${el.scrollHeight}px` }}
          placeholder="Ej.: esta semana noté que a varios niños les cuesta esperar su turno al jugar."
          rows={2}
          style={st.textarea}
        />
      </PasoRedaccion>

      {/* Paso 2 · Propósito */}
      <PasoRedaccion
        numero={2}
        titulo="Propósito"
        ayuda="Si quieres, escribe tus ideas sobre lo que esperas que tus alumnos aprendan, desarrollen y vivan. MÍA te propondrá cómo redactarlo."
        bloqueado={!conf1}
        mensajeBloqueo="Confirma primero la situación problema."
        confirmado={conf2}
        valor={proposito}
        onCambiar={setProposito}
        onConfirmar={() => setConf2(true)}
        onEditar={() => editarPaso(2)}
        opciones={opc2}
        cargando={carg2}
        error={err2}
        usos={usos2}
        puedeSugerir={conf1}
        onSugerir={sugerirProposito}
        textoSugerir="✦ Proponer propósitos con MÍA"
        placeholder="Elige una propuesta de MÍA o escribe tu propio propósito."
      >
        <label style={{ ...st.label, marginTop: 0 }}>
          Tus ideas <span style={{ fontWeight: 400, color: C.gris }}>(opcional)</span>
        </label>
        <textarea
          value={ideas2}
          onChange={e => setIdeas2(e.target.value)}
          onInput={e => { const el = e.currentTarget; el.style.height = 'auto'; el.style.height = `${el.scrollHeight}px` }}
          placeholder="Ej.: que aprendan a convivir y a resolver conflictos hablando."
          rows={2}
          style={st.textarea}
        />
      </PasoRedaccion>

      {/* Paso 3 · Título */}
      <PasoRedaccion
        numero={3}
        titulo="Título del proyecto"
        ayuda="Si ya tienes una idea de título, escríbela. MÍA te propondrá opciones a partir de tu situación problema y tu propósito."
        bloqueado={!conf2}
        mensajeBloqueo="Confirma primero el propósito."
        confirmado={conf3}
        valor={titulo}
        onCambiar={setTitulo}
        onConfirmar={() => setConf3(true)}
        onEditar={() => editarPaso(3)}
        opciones={opc3}
        cargando={carg3}
        error={err3}
        usos={usos3}
        puedeSugerir={conf2}
        onSugerir={sugerirTitulo}
        textoSugerir="✦ Proponer títulos con MÍA"
        placeholder="Elige una propuesta de MÍA o escribe tu propio título."
        filas={1}
      >
        <label style={{ ...st.label, marginTop: 0 }}>
          Tus ideas <span style={{ fontWeight: 400, color: C.gris }}>(opcional)</span>
        </label>
        <textarea
          value={ideas3}
          onChange={e => setIdeas3(e.target.value)}
          onInput={e => { const el = e.currentTarget; el.style.height = 'auto'; el.style.height = `${el.scrollHeight}px` }}
          placeholder="Ej.: algo con juegos y amigos."
          rows={1}
          style={st.textarea}
        />
      </PasoRedaccion>

      {/* Paso 4 · Recursos (opcional, sin IA) */}
      <div style={st.card}>
        <p style={st.titulo}>4 · Recursos <span style={{ fontWeight: 400, color: C.gris, textTransform: 'none', letterSpacing: 0 }}>(opcional)</span></p>
        <p style={{ ...st.ayuda, marginTop: 8 }}>
          Materiales con los que ya cuentas en el aula, en el jardín o que tú llevas. MÍA los tomará como base para las actividades.
        </p>
        <textarea
          value={recursos}
          onChange={e => setRecursos(e.target.value)}
          onInput={e => { const el = e.currentTarget; el.style.height = 'auto'; el.style.height = `${el.scrollHeight}px` }}
          placeholder="Ej.: pelotas, cuentos del rincón de lectura, material reciclado, bocina."
          rows={2}
          style={st.textarea}
        />
      </div>

      <p style={{ ...st.nota, fontSize: 13, textAlign: 'center', margin: '4px 0 12px', lineHeight: 1.6 }}>
        Estos datos son el alma de tu planeación. MÍA los tomará como base; tú decides.
      </p>

      <button
        onClick={avanzar}
        disabled={!listo}
        style={{
          width: '100%', border: 'none', borderRadius: 8, padding: '15px 20px',
          fontSize: 16, fontWeight: 700, color: 'white',
          background: listo ? C.cian : '#B9B9C9',
          cursor: listo ? 'pointer' : 'default', transition: 'background 0.2s',
        }}
      >
        {listo ? 'Avanzar →' : 'Confirma los pasos 1, 2 y 3 para avanzar'}
      </button>
    </div>
  )
}
