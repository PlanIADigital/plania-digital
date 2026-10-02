'use client'
import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { fetchConSesion } from '@/lib/fetchConSesion'
import { useRouter } from 'next/navigation'
import SidebarWrapper from '@/components/SidebarWrapper'
import EncabezadoPagina from '@/components/EncabezadoPagina'

const supabase = createClient()

// [2 oct 2026] WhatsApp de PlanIA Digital para renovar membresías (cobro manual).
// Formato: 52 + 10 dígitos, sin espacios ni signos. Ej: '528112345678'.
// Si está vacío, el aviso de renovación se muestra sin botón.
const WHATSAPP_PAGOS = '528140066448'

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

const st = {
  card: { background: 'white', borderRadius: 12, border: `1px solid ${C.borde}`, padding: '16px 18px', marginBottom: 12 },
  titulo: { fontSize: 13, fontWeight: 700, color: C.indigo, textTransform: 'uppercase' as const, letterSpacing: '0.08em', margin: 0 },
  filaTitulo: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 14 },
  etiqueta: { fontSize: 12, fontWeight: 600, color: C.gris, display: 'block', marginBottom: 4 },
  input: { display: 'block', width: '100%', height: 44, padding: '0 12px', fontSize: 16, borderRadius: 10, border: `1.5px solid ${C.borde}`, boxSizing: 'border-box' as const, color: C.texto, background: 'white', outline: 'none' },
  btnPrimario: { background: C.indigo, color: 'white', border: 'none', padding: '10px 18px', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer' },
  btnSecundario: { background: 'white', color: C.indigo, border: `1.5px solid ${C.borde}`, padding: '10px 18px', borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: 'pointer' },
  link: { background: 'none', border: 'none', padding: 0, color: C.indigo, fontSize: 14, fontWeight: 600, textDecoration: 'underline', cursor: 'pointer' },
  linkGris: { background: 'none', border: 'none', padding: 0, color: C.gris, fontSize: 14, textDecoration: 'underline', cursor: 'pointer' },
  aviso: { background: C.indigoClaro, borderLeft: `3px solid ${C.indigo}`, borderRadius: 8, padding: '8px 12px', fontSize: 13, color: C.texto, lineHeight: 1.5, margin: '10px 0 0' },
  exito: { background: '#E0F5F3', borderLeft: `3px solid ${C.cian}`, borderRadius: 8, padding: '8px 12px', fontSize: 13, color: '#0F6E56', lineHeight: 1.5, margin: '10px 0 0' },
}

// [2 oct 2026] Colores de la etiqueta de membresía. Sin rojo ni naranja
// saturado (paleta PlanIA): lo que requiere atención usa ámbar suave.
const ESTILO_MEMBRESIA: Record<string, { fondo: string; texto: string }> = {
  active:    { fondo: '#E0F5F3', texto: '#0F6E56' },
  trial:     { fondo: '#EEEDF8', texto: '#3D3A8C' },
  founder:   { fondo: '#EEEDF8', texto: '#3D3A8C' },
  expired:   { fondo: '#FFF3CD', texto: '#8A6D1D' },
  suspended: { fondo: '#FFF3CD', texto: '#8A6D1D' },
  cancelled: { fondo: '#FFF3CD', texto: '#8A6D1D' },
}

function ajustarAlturaTextarea(e: React.FormEvent<HTMLTextAreaElement>) {
  const el = e.currentTarget
  el.style.height = 'auto'
  el.style.height = `${el.scrollHeight}px`
}

// Fila etiqueta / valor de solo lectura. El valor se ajusta si es largo (correo).
function Fila({ etiqueta, valor, children, ultima }: { etiqueta: string; valor?: string | null; children?: React.ReactNode; ultima?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' as const, gap: '4px 12px', padding: '10px 0', borderBottom: ultima ? 'none' : '1px solid #F0EFF8' }}>
      <span style={{ fontSize: 14, color: C.gris }}>{etiqueta}</span>
      {children ?? <span style={{ fontSize: 15, fontWeight: 600, color: C.texto, textAlign: 'right' as const, overflowWrap: 'anywhere' as const, minWidth: 0 }}>{valor || '—'}</span>}
    </div>
  )
}

// [oct 2026] Texto en una sola línea que reduce su letra (de 15 px hasta 10 px)
// hasta caber en el espacio disponible. Se recalcula si cambia el ancho.
function TextoAjustable({ texto }: { texto: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ajustar = () => {
      let tam = 15
      el.style.fontSize = tam + 'px'
      while (el.scrollWidth > el.clientWidth && tam > 10) {
        tam -= 0.5
        el.style.fontSize = tam + 'px'
      }
    }
    ajustar()
    const ro = new ResizeObserver(ajustar)
    ro.observe(el)
    return () => ro.disconnect()
  }, [texto])
  return (
    <span ref={ref} style={{ flex: '1 1 0', minWidth: 0, textAlign: 'right' as const, whiteSpace: 'nowrap' as const, overflow: 'hidden', textOverflow: 'ellipsis', fontSize: 15, fontWeight: 600, color: C.texto }}>
      {texto}
    </span>
  )
}

// [2 oct 2026] Días que faltan para que termine el ciclo de membresía,
// contados con la fecha de hoy en México. 0 = vence hoy; negativo = ya venció.
function diasParaVencer(fin: string): number {
  const dia = 86400000
  const b = new Date(String(fin).slice(0, 10) + 'T12:00:00Z').getTime()
  const hoyMx = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' }).format(new Date())
  const hoy = new Date(hoyMx + 'T12:00:00Z').getTime()
  return Math.round((b - hoy) / dia)
}

export default function ConfiguracionPage() {
  const router = useRouter()
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')
  const [editandoWhatsapp, setEditandoWhatsapp] = useState(false)
  const [whatsappValor, setWhatsappValor] = useState('')
  const [guardandoWhatsapp, setGuardandoWhatsapp] = useState(false)
  const [errorWhatsapp, setErrorWhatsapp] = useState('')
  // [2 oct 2026] Editar nombre completo (aparece en menú, saludo y planeaciones).
  const [editandoNombre, setEditandoNombre] = useState(false)
  const [nombreValor, setNombreValor] = useState('')
  const [guardandoNombre, setGuardandoNombre] = useState(false)
  const [errorNombre, setErrorNombre] = useState('')

  // [sep 2026] Estado de cuenta — viene de la vista v_estado_cuenta vía /api/estado-cuenta.
  const [estadoCuenta, setEstadoCuenta] = useState<{
    fecha_pago: string
    ciclo_inicio: string
    ciclo_fin: string
    dias_habiles_generados_ciclo: number
  } | null>(null)
  const [cargandoEstadoCuenta, setCargandoEstadoCuenta] = useState(true)

  // Datos institucionales — Zona/Sector/Región/Turno, sugeridos del catálogo
  // oficial SEP y confirmables aquí (misma fuente que Mi Grupo y el onboarding).
  const [datosCctSugeridos, setDatosCctSugeridos] = useState<any>(null)
  const [zonaEditable, setZonaEditable] = useState('')
  const [sectorEditable, setSectorEditable] = useState('')
  const [regionEditable, setRegionEditable] = useState('')
  const [turnoEditable, setTurnoEditable] = useState('')
  const [confirmandoInstitucional, setConfirmandoInstitucional] = useState(false)
  const [institucionalConfirmado, setInstitucionalConfirmado] = useState(false)
  const [editandoInstitucional, setEditandoInstitucional] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // [ago 2026] Estilo narrativo — vive en users.estilo_narrativo (rasgo de la persona).
  const [estiloTexto, setEstiloTexto] = useState('')
  const [analizandoEstilo, setAnalizandoEstilo] = useState(false)
  const [estiloGuardado, setEstiloGuardado] = useState(false)
  const [errorEstilo, setErrorEstilo] = useState('')
  const [resultadoEstilo, setResultadoEstilo] = useState<any>(null)

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/auth/login'); return }
      const { data } = await supabase
        .from('users').select('*')
        .eq('auth_uid', session.user.id).single()
      if (!data) { router.push('/auth/login'); return }
      setProfile(data)

      setInstitucionalConfirmado(!!data.zona_confirmada && !!data.sector_confirmada && !!data.region_confirmada)
      setTurnoEditable(data.shift_primary || '')
      if (data.cct_primary) {
        try {
          const resCct = await fetch(`/api/cct-lookup?cv_cct=${data.cct_primary}`)
          const jsonCct = await resCct.json()
          if (jsonCct.encontrado) {
            setDatosCctSugeridos(jsonCct)
            setZonaEditable(data.zona_confirmada ? (data.zona || '') : (jsonCct.campos.zona.valor || ''))
            setSectorEditable(data.sector_confirmada ? (data.sector || '') : (jsonCct.campos.sector.valor || ''))
            setRegionEditable(data.region_confirmada ? (data.region || '') : (jsonCct.campos.region.valor || ''))
          }
        } catch {
          // silencioso -- si falla, los campos se quedan vacíos y editables
        }
      }

      if (data.estilo_narrativo) { setResultadoEstilo(data.estilo_narrativo); setEstiloGuardado(true) }
      setLoading(false)

      try {
        const resEstado = await fetchConSesion('/api/estado-cuenta')
        const dataEstado = await resEstado.json()
        if (dataEstado.ok) setEstadoCuenta(dataEstado)
      } catch {
        // silencioso -- si falla, la tarjeta simplemente no se muestra
      }
      setCargandoEstadoCuenta(false)
    }
    load()
  }, [])

  async function handleFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !profile) return
    setUploading(true)
    setSaveMsg('')
    const ext = file.name.split('.').pop()
    const path = `avatars/${profile.auth_uid}.${ext}`
    const { error: upErr } = await supabase.storage
      .from('avatars')
      .upload(path, file, { upsert: true })
    if (upErr) { setSaveMsg('No se pudo subir la foto: ' + upErr.message); setUploading(false); return }
    const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path)
    const { error: updateErr } = await supabase
      .from('users')
      .update({ avatar_url: urlData.publicUrl + '?t=' + Date.now() })
      .eq('auth_uid', profile.auth_uid)
    if (updateErr) { setSaveMsg('No se pudo guardar: ' + updateErr.message); setUploading(false); return }
    setProfile((prev: any) => ({ ...prev, avatar_url: urlData.publicUrl + '?t=' + Date.now() }))
    setSaveMsg('✓ Foto actualizada')
    setUploading(false)
  }

  async function confirmarDatosInstitucionales() {
    setConfirmandoInstitucional(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { setConfirmandoInstitucional(false); return }
      const campos: { campo: 'zona' | 'sector' | 'region' | 'turno'; valor: string }[] = [
        { campo: 'zona', valor: zonaEditable },
        { campo: 'sector', valor: sectorEditable },
        { campo: 'region', valor: regionEditable },
        { campo: 'turno', valor: turnoEditable },
      ]
      for (const { campo, valor } of campos) {
        if (!valor.trim()) continue
        await fetch('/api/cct-confirmar', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ cv_cct: profile.cct_primary, campo, valor }),
        })
      }
      setProfile((prev: any) => ({
        ...prev,
        zona: zonaEditable,
        sector: sectorEditable,
        region: regionEditable,
        shift_primary: turnoEditable,
        zona_confirmada: true,
        sector_confirmada: true,
        region_confirmada: true,
      }))
      setInstitucionalConfirmado(true)
      setEditandoInstitucional(false)
    } catch {
      // silencioso -- si falla, la tarjeta sigue en modo edición para reintentar
    }
    setConfirmandoInstitucional(false)
  }

  // [2 oct 2026] Directivo: días transcurridos de su ciclo de membresía
  // (el directivo no genera planeaciones, así que "días hábiles" no aplica).
  // [2 oct 2026] Minutos de Mi diario del periodo (tope 300). Solo se muestra
  // a quien ya lo usó (cuentas piloto; el menú no lo muestra) y nunca al directivo.
  const [minutosDiario, setMinutosDiario] = useState<{ usadosMin: number; topeMin: number } | null>(null)
  useEffect(() => {
    if (!profile || profile.role === 'directivo') return
    fetchConSesion('/api/diario/transcribir')
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (d && d.topeMin) setMinutosDiario({ usadosMin: Number(d.usadosMin) || 0, topeMin: Number(d.topeMin) }) })
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id, profile?.role])

  function diasMembresia(inicio: string, fin: string) {
    const dia = 86400000
    const a = new Date(String(inicio).slice(0, 10) + 'T12:00:00Z').getTime()
    const b = new Date(String(fin).slice(0, 10) + 'T12:00:00Z').getTime()
    const hoyMx = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' }).format(new Date())
    const hoy = new Date(hoyMx + 'T12:00:00Z').getTime()
    const total = Math.max(1, Math.round((b - a) / dia))
    // [2 oct 2026] Días COMPLETOS transcurridos (sin contar hoy), para que
    // transcurridos + "faltan X días" sume exactamente el total del ciclo.
    const transcurridos = Math.min(total, Math.max(0, Math.round((hoy - a) / dia)))
    return { total, transcurridos }
  }

  async function guardarNombre() {
    if (!profile) return
    const limpio = nombreValor.replace(/\s+/g, ' ').trim()
    if (limpio.split(' ').length < 2 || limpio.length < 5) {
      setErrorNombre('Escribe tu nombre y al menos un apellido.')
      return
    }
    setErrorNombre('')
    setGuardandoNombre(true)
    const { error } = await supabase
      .from('users')
      .update({ full_name: limpio })
      .eq('auth_uid', profile.auth_uid)
    if (error) {
      setErrorNombre('No se pudo guardar. Intenta de nuevo.')
    } else {
      setProfile((prev: any) => ({ ...prev, full_name: limpio }))
      setEditandoNombre(false)
    }
    setGuardandoNombre(false)
  }

  async function guardarWhatsapp() {
    if (!profile || !whatsappValor.trim()) return
    setErrorWhatsapp('')
    setGuardandoWhatsapp(true)

    try {
      const resDup = await fetchConSesion('/api/verificar-whatsapp-duplicado', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ whatsapp: whatsappValor.trim() }),
      })
      const dataDup = await resDup.json()
      if (dataDup.duplicado) {
        setErrorWhatsapp('Este número ya está registrado en otra cuenta. Verifica que lo hayas escrito correctamente.')
        setGuardandoWhatsapp(false)
        return
      }
    } catch {
      // silencioso -- si falla la verificación, no bloqueamos el guardado
    }

    const { error } = await supabase
      .from('users')
      .update({ whatsapp: whatsappValor.trim() })
      .eq('auth_uid', profile.auth_uid)
    if (!error) {
      setProfile((prev: any) => ({ ...prev, whatsapp: whatsappValor.trim() }))
      setEditandoWhatsapp(false)
    }
    setGuardandoWhatsapp(false)
  }

  // [ago 2026] Misma lógica y endpoint /api/analizar-estilo-narrativo.
  async function analizarEstiloConTexto(texto: string): Promise<boolean> {
    if (!texto.trim()) { setErrorEstilo('Escribe o sube un texto.'); return false }
    setAnalizandoEstilo(true); setErrorEstilo('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return false
      const res = await fetchConSesion('/api/analizar-estilo-narrativo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texto })
      })
      const data = await res.json()
      if (data.ok) { setResultadoEstilo(data.resultado); setEstiloGuardado(true); return true }
      setErrorEstilo('No se pudo analizar. Intenta de nuevo.')
      return false
    } catch {
      setErrorEstilo('Error de conexión. Intenta de nuevo.')
      return false
    } finally {
      setAnalizandoEstilo(false)
    }
  }
  function handleAnalizarEstilo() {
    analizarEstiloConTexto(estiloTexto)
  }
  async function handleArchivoEstilo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/extraer-texto', { method: 'POST', body: formData })
      const data = await res.json()
      if (!data.texto) { setErrorEstilo('No se pudo extraer el texto.'); return }
      const textoCombinado = estiloTexto ? estiloTexto + '\n\n' + data.texto : data.texto
      const exito = await analizarEstiloConTexto(textoCombinado)
      if (!exito) setEstiloTexto(textoCombinado)
    } catch { setErrorEstilo('No se pudo extraer el texto.') }
  }

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: C.menta }}>
      <p style={{ color: C.indigo, fontSize: 15 }}>Cargando...</p>
    </div>
  )

  const rolLabel: Record<string, string> = {
    educadora: 'Educadora',
    educador: 'Educador',
    maestra_musica: 'Maestra de música',
    maestro_musica: 'Maestro de música',
    directivo: 'Directivo',
  }
  const membresiaLabel: Record<string, string> = {
    trial: 'Prueba gratuita',
    active: 'Activa',
    cancelled: 'Cancelada',
    expired: 'Expirada',
    suspended: 'Suspendida',
    founder: 'Fundadora — Acceso completo',
  }

  const iniciales = profile?.full_name
    ?.split(' ').slice(0, 2).map((n: string) => n[0]).join('').toUpperCase() || '?'

  const fechaCorta = (iso: string) => new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })
  const turnoTexto = profile?.shift_primary ? profile.shift_primary.charAt(0).toUpperCase() + profile.shift_primary.slice(1) : ''
  const fotoError = saveMsg && !saveMsg.startsWith('✓')

  // [2 oct 2026] Situación de la membresía para la tarjeta "Estado de cuenta".
  const estatus: string = profile?.membership_status || ''
  const esFundadora = estatus === 'founder'
  const restantes = estadoCuenta ? diasParaVencer(estadoCuenta.ciclo_fin) : null
  const yaVencio = !esFundadora && restantes !== null && restantes < 0
  const enModoLectura = ['expired', 'suspended', 'cancelled'].includes(estatus) || yaVencio
  const porVencer = !esFundadora && !enModoLectura && restantes !== null && restantes <= 5
  const estiloEtiqueta = ESTILO_MEMBRESIA[estatus] ?? { fondo: C.indigoClaro, texto: C.indigo }

  function textoVencimiento(): string {
    if (!estadoCuenta || restantes === null) return ''
    if (esFundadora) return 'Sin vencimiento'
    const fecha = fechaCorta(estadoCuenta.ciclo_fin)
    if (enModoLectura) return `Venció el ${fecha}`
    if (restantes === 0) return 'Vence hoy'
    if (restantes === 1) return `Vence mañana, ${fecha}`
    return `Vence el ${fecha} · faltan ${restantes} días`
  }

  const enlaceRenovar = WHATSAPP_PAGOS
    ? `https://wa.me/${WHATSAPP_PAGOS}?text=${encodeURIComponent(`Hola, quiero renovar mi membresía de PlanIA Digital. Mi correo es ${profile?.email || ''}`)}`
    : ''

  return (
    <SidebarWrapper profile={profile}>
      <div style={{ padding: '0 16px' }}>

        <EncabezadoPagina antetitulo="Ajustar" titulo="Configuración" subtitulo={profile?.role === 'directivo' ? 'Tu perfil y tus datos.' : 'Tu perfil, tus datos y tu forma de escribir.'} />

        <div style={{ maxWidth: 720, margin: '0 auto' }}>

          {/* PERFIL */}
          <div style={st.card}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="Foto de perfil"
                  style={{ width: 72, height: 72, borderRadius: '50%', objectFit: 'cover', border: `3px solid ${C.indigoClaro}`, flexShrink: 0 }} />
              ) : (
                <div style={{ width: 72, height: 72, borderRadius: '50%', background: C.cian, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, fontWeight: 700, color: 'white', flexShrink: 0 }}>
                  {iniciales}
                </div>
              )}
              <div style={{ minWidth: 0, flex: 1 }}>
                {!editandoNombre ? (
                  <>
                    <p style={{ margin: 0, fontSize: 17, fontWeight: 700, color: C.texto, overflowWrap: 'anywhere' as const }}>{profile?.full_name}</p>
                    <p style={{ margin: '2px 0 8px', fontSize: 14, color: C.gris }}>{rolLabel[profile?.role] ?? profile?.role}</p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 18px' }}>
                      <button onClick={() => fileRef.current?.click()} disabled={uploading} style={{ ...st.link, opacity: uploading ? 0.6 : 1 }}>
                        {uploading ? 'Subiendo…' : 'Cambiar foto'}
                      </button>
                      <button
                        onClick={() => { setNombreValor(profile?.full_name || ''); setEditandoNombre(true); setErrorNombre('') }}
                        style={st.link}
                      >
                        Editar nombre
                      </button>
                    </div>
                  </>
                ) : (
                  <div>
                    <label style={st.etiqueta}>Nombre completo</label>
                    <input
                      value={nombreValor}
                      onChange={e => setNombreValor(e.target.value)}
                      autoComplete="name"
                      maxLength={120}
                      style={st.input}
                    />
                    <p style={{ margin: '6px 0 0', fontSize: 12.5, color: C.gris, lineHeight: 1.5 }}>
                      Escribe tu nombre y tus dos apellidos. Así aparecerá en el menú, el saludo y tus planeaciones.
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 10 }}>
                      <button
                        onClick={guardarNombre}
                        disabled={guardandoNombre || !nombreValor.trim()}
                        style={{ ...st.btnPrimario, opacity: guardandoNombre || !nombreValor.trim() ? 0.6 : 1 }}
                      >
                        {guardandoNombre ? 'Guardando…' : 'Guardar'}
                      </button>
                      <button
                        onClick={() => { setEditandoNombre(false); setErrorNombre('') }}
                        disabled={guardandoNombre}
                        style={st.linkGris}
                      >
                        Cancelar
                      </button>
                    </div>
                    {errorNombre && <p style={st.aviso}>{errorNombre}</p>}
                  </div>
                )}
                <input ref={fileRef} type="file" accept="image/jpeg,image/png" onChange={handleFoto} style={{ display: 'none' }} />
              </div>
            </div>
            <p style={{ margin: '12px 0 0', fontSize: 12, color: C.gris }}>Tu foto aparece en el menú. JPG o PNG, máximo 2 MB.</p>
            {saveMsg && <p style={fotoError ? st.aviso : st.exito}>{saveMsg}</p>}
          </div>

          {/* DATOS DE CUENTA */}
          <div style={st.card}>
            <div style={st.filaTitulo}><p style={st.titulo}>Datos de cuenta</p></div>
            {/* Correo: etiqueta y correo en la misma línea; la letra se ajusta si es largo */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid #F0EFF8' }}>
              <span style={{ fontSize: 14, color: C.gris, flexShrink: 0 }}>Correo</span>
              <TextoAjustable texto={profile?.email || '—'} />
            </div>
            {/* [2 oct 2026] La membresía se muestra en "Estado de cuenta"; aquí solo
                como respaldo si esa tarjeta no cargó. */}
            {!cargandoEstadoCuenta && !estadoCuenta && (
              <Fila etiqueta="Membresía" valor={membresiaLabel[estatus] ?? estatus} />
            )}
            {!editandoWhatsapp ? (
              <Fila etiqueta="WhatsApp" ultima>
                <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 15, fontWeight: 600, color: C.texto }}>{profile?.whatsapp || '—'}</span>
                  <button
                    onClick={() => { setWhatsappValor(profile?.whatsapp || ''); setEditandoWhatsapp(true); setErrorWhatsapp('') }}
                    style={st.link}
                  >
                    Editar
                  </button>
                </span>
              </Fila>
            ) : (
              <div style={{ paddingTop: 10 }}>
                <label style={st.etiqueta}>WhatsApp</label>
                <input
                  value={whatsappValor}
                  onChange={e => setWhatsappValor(e.target.value)}
                  placeholder="10 dígitos"
                  inputMode="numeric"
                  style={st.input}
                />
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 10 }}>
                  <button
                    onClick={guardarWhatsapp}
                    disabled={guardandoWhatsapp || !whatsappValor.trim()}
                    style={{ ...st.btnPrimario, opacity: guardandoWhatsapp || !whatsappValor.trim() ? 0.6 : 1 }}
                  >
                    {guardandoWhatsapp ? 'Guardando…' : 'Guardar'}
                  </button>
                  <button
                    onClick={() => { setEditandoWhatsapp(false); setErrorWhatsapp('') }}
                    disabled={guardandoWhatsapp}
                    style={st.linkGris}
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
            {errorWhatsapp && <p style={st.aviso}>{errorWhatsapp}</p>}
          </div>

          {/* DATOS INSTITUCIONALES */}
          <div style={st.card}>
            <div style={st.filaTitulo}>
              <p style={st.titulo}>Datos institucionales</p>
              {institucionalConfirmado && !editandoInstitucional && (
                <button onClick={() => setEditandoInstitucional(true)} style={st.link}>Editar</button>
              )}
            </div>

            <Fila etiqueta="CCT" valor={profile?.cct_primary} />

            {institucionalConfirmado && !editandoInstitucional ? (
              <>
                <Fila etiqueta="Zona" valor={profile?.zona} />
                <Fila etiqueta="Sector" valor={profile?.sector} />
                <Fila etiqueta="Región" valor={profile?.region} />
                <Fila etiqueta="Turno" valor={turnoTexto} ultima />
              </>
            ) : (
              <div style={{ paddingTop: 12 }}>
                {datosCctSugeridos && (
                  <p style={{ ...st.exito, margin: '0 0 12px' }}>
                    Sugerido del catálogo oficial SEP. Revisa que sea correcto y corrígelo si hace falta.
                  </p>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8, marginBottom: 12 }}>
                  <div>
                    <label style={st.etiqueta}>Zona</label>
                    <input value={zonaEditable} onChange={e => setZonaEditable(e.target.value)} style={st.input} />
                  </div>
                  <div>
                    <label style={st.etiqueta}>Sector</label>
                    <input value={sectorEditable} onChange={e => setSectorEditable(e.target.value)} placeholder="No aplica" style={st.input} />
                  </div>
                  <div>
                    <label style={st.etiqueta}>Región</label>
                    <input value={regionEditable} onChange={e => setRegionEditable(e.target.value)} style={st.input} />
                  </div>
                </div>
                <label style={st.etiqueta}>Turno</label>
                <select value={turnoEditable} onChange={e => setTurnoEditable(e.target.value)} style={{ ...st.input, cursor: 'pointer' }}>
                  <option value="" disabled>— Selecciona —</option>
                  <option value="matutino">Matutino</option>
                  <option value="vespertino">Vespertino</option>
                  <option value="discontinuo">Discontinuo</option>
                </select>

                <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 14 }}>
                  <button onClick={confirmarDatosInstitucionales} disabled={confirmandoInstitucional}
                    style={{ ...st.btnPrimario, opacity: confirmandoInstitucional ? 0.6 : 1 }}>
                    {confirmandoInstitucional ? 'Guardando…' : 'Confirmar'}
                  </button>
                  {institucionalConfirmado && (
                    <button onClick={() => setEditandoInstitucional(false)} style={st.linkGris}>Cancelar</button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ESTADO DE CUENTA */}
          {!cargandoEstadoCuenta && estadoCuenta && (
            <div style={st.card}>
              <div style={st.filaTitulo}><p style={st.titulo}>Estado de cuenta</p></div>

              {/* [2 oct 2026] Membresía y vencimiento: lo primero que quiere confirmar quien pagó */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' as const, gap: 8, marginBottom: 10 }}>
                <span style={{
                  display: 'inline-block', padding: '5px 12px', borderRadius: 20,
                  background: estiloEtiqueta.fondo, color: estiloEtiqueta.texto,
                  fontSize: 13, fontWeight: 700,
                }}>
                  {esFundadora ? '⭐ ' : ''}{membresiaLabel[estatus] ?? estatus}
                </span>
                <span style={{ fontSize: 14, fontWeight: 600, color: enModoLectura || porVencer ? '#8A6D1D' : C.texto }}>
                  {textoVencimiento()}
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
                <div style={{ background: C.indigoClaro, borderRadius: 10, padding: '12px 10px', textAlign: 'center' as const }}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: C.indigo, textTransform: 'uppercase' as const, letterSpacing: '0.06em', margin: '0 0 4px' }}>Ciclo actual</p>
                  <p style={{ fontSize: 16, fontWeight: 800, color: C.texto, margin: 0 }}>
                    {fechaCorta(estadoCuenta.ciclo_inicio)} – {fechaCorta(estadoCuenta.ciclo_fin)}
                  </p>
                </div>
                <div style={{ background: C.indigoClaro, borderRadius: 10, padding: '12px 10px', textAlign: 'center' as const }}>
                  {profile?.role === 'directivo' ? (
                    <>
                      <p style={{ fontSize: 11, fontWeight: 700, color: C.indigo, textTransform: 'uppercase' as const, letterSpacing: '0.06em', margin: '0 0 4px' }}>Días de membresía</p>
                      <p style={{ fontSize: 22, fontWeight: 800, color: C.indigo, margin: 0, lineHeight: 1.1 }}>
                        {diasMembresia(estadoCuenta.ciclo_inicio, estadoCuenta.ciclo_fin).transcurridos}
                        <span style={{ fontSize: 14, fontWeight: 700 }}> de {diasMembresia(estadoCuenta.ciclo_inicio, estadoCuenta.ciclo_fin).total}</span>
                      </p>
                      <p style={{ fontSize: 12, color: C.gris, margin: '2px 0 0' }}>transcurridos</p>
                    </>
                  ) : (
                    <>
                      <p style={{ fontSize: 11, fontWeight: 700, color: C.indigo, textTransform: 'uppercase' as const, letterSpacing: '0.06em', margin: '0 0 4px' }}>Días hábiles</p>
                      <p style={{ fontSize: 22, fontWeight: 800, color: C.indigo, margin: 0, lineHeight: 1.1 }}>{estadoCuenta.dias_habiles_generados_ciclo}</p>
                      <p style={{ fontSize: 12, color: C.gris, margin: '2px 0 0' }}>generados</p>
                    </>
                  )}
                </div>
              </div>
              {profile?.role !== 'directivo' && minutosDiario && minutosDiario.usadosMin > 0 && (
                <div style={{ background: C.indigoClaro, borderRadius: 10, padding: '12px 14px', marginTop: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                    <p style={{ fontSize: 11, fontWeight: 700, color: C.indigo, textTransform: 'uppercase' as const, letterSpacing: '0.06em', margin: 0 }}>Minutos de Mi diario</p>
                    <p style={{ fontSize: 16, fontWeight: 800, color: C.indigo, margin: 0 }}>
                      {minutosDiario.usadosMin}<span style={{ fontSize: 13, fontWeight: 700 }}> de {minutosDiario.topeMin}</span>
                    </p>
                  </div>
                  <div style={{ height: 8, borderRadius: 8, background: 'white', marginTop: 8, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${Math.min(100, (minutosDiario.usadosMin / minutosDiario.topeMin) * 100)}%`, background: '#00A896', borderRadius: 8 }} />
                  </div>
                  <p style={{ fontSize: 12, color: C.gris, margin: '6px 0 0' }}>Se renuevan el {fechaCorta(estadoCuenta.ciclo_fin)}</p>
                </div>
              )}

              {/* [2 oct 2026] Aviso de renovación: solo cuando vence pronto o ya venció */}
              {(porVencer || enModoLectura) && (
                <div style={{ background: '#FFF3CD', borderLeft: '3px solid #8A6D1D', borderRadius: 8, padding: '12px 14px', marginTop: 10 }}>
                  <p style={{ fontSize: 14, color: C.texto, margin: 0, lineHeight: 1.55 }}>
                    {enModoLectura
                      ? 'Tu membresía no está activa. Puedes seguir consultando y descargando lo que ya tienes. Para reactivarla, escríbenos.'
                      : 'Tu membresía vence pronto. Renueva para seguir usando PlanIA Digital sin interrupciones.'}
                  </p>
                  {enlaceRenovar && (
                    <a
                      href={enlaceRenovar}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ display: 'inline-block', marginTop: 10, background: C.cian, color: 'white', padding: '9px 16px', borderRadius: 10, fontSize: 14, fontWeight: 700, textDecoration: 'none' }}
                    >
                      {enModoLectura ? 'Reactivar por WhatsApp' : 'Renovar por WhatsApp'}
                    </a>
                  )}
                </div>
              )}
            </div>
          )}

          {/* MI ESTILO DE NARRACIÓN — no aplica al directivo (no genera planeaciones) */}
          {profile?.role !== 'directivo' && (
          <div style={st.card}>
            <div style={st.filaTitulo}>
              <p style={st.titulo}>Mi estilo de narración</p>
              {estiloGuardado && (
                <button onClick={() => setEstiloGuardado(false)} style={st.link}>Actualizar</button>
              )}
            </div>

            {estiloGuardado ? (
              <div>
                <p style={{ fontSize: 15, fontWeight: 700, color: C.cian, margin: '0 0 6px' }}>✓ Estilo de escritura guardado</p>
                {resultadoEstilo?.tono && <p style={{ fontSize: 14, color: C.texto, margin: 0, lineHeight: 1.6 }}><strong>Tono:</strong> {resultadoEstilo.tono}</p>}
              </div>
            ) : (
              <div>
                <p style={{ fontSize: 14, color: C.gris, margin: '0 0 12px', lineHeight: 1.6 }}>
                  Comparte un texto tuyo: una carta, unas notas o lo que escribas a las familias. MÍA aprende tu tono para que tus planeaciones suenen a ti.
                </p>
                <textarea value={estiloTexto} onChange={e => setEstiloTexto(e.target.value)} onInput={ajustarAlturaTextarea} rows={4}
                  placeholder="Ej: Estimadas familias, quiero compartirles que esta semana trabajamos con los niños explorando..."
                  style={{ display: 'block', width: '100%', padding: '10px 12px', fontSize: 16, borderRadius: 10, border: `1.5px solid ${C.borde}`, boxSizing: 'border-box', resize: 'none', overflow: 'hidden', fontFamily: 'inherit', lineHeight: 1.6, marginBottom: 10, color: C.texto } as React.CSSProperties}
                />
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' as const, alignItems: 'center' }}>
                  <button onClick={handleAnalizarEstilo} disabled={analizandoEstilo || !estiloTexto.trim()}
                    style={{ ...st.btnPrimario, opacity: analizandoEstilo || !estiloTexto.trim() ? 0.6 : 1 }}>
                    {analizandoEstilo ? 'Analizando…' : '✨ Analizar'}
                  </button>
                  <label style={{ ...st.btnSecundario, display: 'inline-flex', alignItems: 'center', gap: 4, opacity: analizandoEstilo ? 0.6 : 1 }}>
                    {analizandoEstilo ? 'Analizando…' : 'Subir documento'}
                    <input type="file" accept=".pdf,.doc,.docx" onChange={handleArchivoEstilo} style={{ display: 'none' }} disabled={analizandoEstilo} />
                  </label>
                  {resultadoEstilo && (
                    <button
                      type="button"
                      disabled={analizandoEstilo}
                      onClick={() => { setEstiloGuardado(true); setEstiloTexto(''); setErrorEstilo('') }}
                      style={st.linkGris}>
                      Cancelar
                    </button>
                  )}
                </div>
                {errorEstilo && <p style={st.aviso}>{errorEstilo}</p>}
                <p style={{ fontSize: 12, color: C.gris, margin: '10px 0 0' }}>Al subir un documento (PDF o Word) se analiza automáticamente.</p>
              </div>
            )}
          </div>
          )}

        </div>
        <div style={{ height: 40 }} />
      </div>
    </SidebarWrapper>
  )
}
