'use client'
import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { useRouter } from 'next/navigation'
import SidebarWrapper from '@/components/SidebarWrapper'

const supabase = createClient()

function ajustarAlturaTextarea(e: React.FormEvent<HTMLTextAreaElement>) {
  const el = e.currentTarget
  el.style.height = 'auto'
  el.style.height = `${el.scrollHeight}px`
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

  // [sep 2026] Estado de cuenta — fecha de pago, ciclo vigente y días
  // hábiles generados dentro de ese ciclo. Viene de la vista
  // v_estado_cuenta vía /api/estado-cuenta (fuente única de verdad,
  // reusable por otras pantallas en el futuro).
  const [estadoCuenta, setEstadoCuenta] = useState<{
    fecha_pago: string
    ciclo_inicio: string
    ciclo_fin: string
    dias_habiles_generados_ciclo: number
  } | null>(null)
  const [cargandoEstadoCuenta, setCargandoEstadoCuenta] = useState(true)

  // Datos institucionales — Zona/Sector/Región/Turno, sugeridos del
  // catálogo oficial SEP y confirmables aquí (misma fuente única de
  // verdad que usan Mi Grupo y el onboarding).
  const [datosCctSugeridos, setDatosCctSugeridos] = useState<any>(null)
  const [zonaEditable, setZonaEditable] = useState('')
  const [sectorEditable, setSectorEditable] = useState('')
  const [regionEditable, setRegionEditable] = useState('')
  const [turnoEditable, setTurnoEditable] = useState('')
  const [confirmandoInstitucional, setConfirmandoInstitucional] = useState(false)
  const [institucionalConfirmado, setInstitucionalConfirmado] = useState(false)
  const [editandoInstitucional, setEditandoInstitucional] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // [ago 2026] Trasladado desde app/mi-grupo/page.tsx (Sección 4) —
  // el dato vive en users.estilo_narrativo, es un rasgo de la persona,
  // no del grupo/ciclo que atiende ese año, así que corresponde vivir
  // en configuración de cuenta.
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
        const resEstado = await fetch(`/api/estado-cuenta?auth_uid=${session.user.id}`)
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
    if (upErr) { setSaveMsg('⚠️ Error al subir la foto: ' + upErr.message); setUploading(false); return }
    const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path)
    const { error: updateErr } = await supabase
      .from('users')
      .update({ avatar_url: urlData.publicUrl + '?t=' + Date.now() })
      .eq('auth_uid', profile.auth_uid)
    if (updateErr) { setSaveMsg('⚠️ Error al guardar: ' + updateErr.message); setUploading(false); return }
        setProfile((prev: any) => ({ ...prev, avatar_url: urlData.publicUrl + '?t=' + Date.now() }))
    setSaveMsg('✅ Foto actualizada correctamente')
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

    async function guardarWhatsapp() {
    if (!profile || !whatsappValor.trim()) return
    setErrorWhatsapp('')
    setGuardandoWhatsapp(true)

    try {
      const resDup = await fetch('/api/verificar-whatsapp-duplicado', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ whatsapp: whatsappValor.trim(), excluir_auth_uid: profile.auth_uid }),
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

  // [ago 2026] Trasladado desde app/mi-grupo/page.tsx tal cual — misma
  // lógica, mismo endpoint /api/analizar-estilo-narrativo.
  async function analizarEstiloConTexto(texto: string): Promise<boolean> {
    if (!texto.trim()) { setErrorEstilo('Escribe o sube un texto.'); return false }
    setAnalizandoEstilo(true); setErrorEstilo('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return false
      const res = await fetch('/api/analizar-estilo-narrativo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texto, auth_uid: session.user.id })
      })
      const data = await res.json()
      if (data.ok) { setResultadoEstilo(data.resultado); setEstiloGuardado(true); return true }
      setErrorEstilo('Error al analizar.')
      return false
    } catch {
      setErrorEstilo('Error de conexión.')
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
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontFamily: 'sans-serif' }}>
      <p style={{ color: '#3D3A8C' }}>Cargando...</p>
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

  const cardTitleStyle: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: '#3D3A8C', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 20px', textAlign: 'center' }

  // Fila label/valor de solo lectura — mismo patrón que ya usa "Datos de cuenta"
  const filaLectura = (label: string, valor?: string | null) => (
    <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 14, marginBottom: 14, borderBottom: '1px solid #F0EFF8' }}>
      <span style={{ fontSize: 13, color: '#888' }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 600, color: '#1A1A2E' }}>{valor || '—'}</span>
    </div>
  )

  const campoEditable: React.CSSProperties = { display: 'block', width: '100%', padding: '7px 10px', fontSize: 13, borderRadius: 8, border: '1.5px solid #D8D6F0', boxSizing: 'border-box', marginBottom: 12 }

  return (
    <SidebarWrapper profile={profile}>
      <div style={{ padding: '0 32px' }}>

        {/* ENCABEZADO */}
        <div style={{ background: 'linear-gradient(135deg, #3D3A8C 0%, #5B58B0 100%)', borderRadius: 14, padding: '28px 32px', marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <h2 style={{ color: 'white', margin: 0, fontSize: 24, fontWeight: 800, letterSpacing: '0.05em' }}>MI CONFIGURACIÓN</h2>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 24, alignItems: 'stretch' }}>

          {/* DATOS INSTITUCIONALES — fuente única de verdad para CCT/Zona/Sector/Región/Turno */}
          <div style={{ background: 'white', border: '1px solid #E0DFF5', borderRadius: 12, padding: 24, height: '100%', boxSizing: 'border-box' as const }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: '#3D3A8C', textTransform: 'uppercase' as const, letterSpacing: '0.07em', margin: '0 0 20px' }}>DATOS INSTITUCIONALES</p>

            {filaLectura('CCT', profile?.cct_primary)}

            {institucionalConfirmado && !editandoInstitucional ? (
              <>
                {filaLectura('Zona', profile?.zona)}
                {filaLectura('Sector', profile?.sector)}
                {filaLectura('Región', profile?.region)}
                {filaLectura('Turno', profile?.shift_primary ? profile.shift_primary.charAt(0).toUpperCase() + profile.shift_primary.slice(1) : '')}
                <button onClick={() => setEditandoInstitucional(true)}
                  style={{ background: 'none', border: 'none', color: '#3D3A8C', fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: 0 }}>
                  Editar
                </button>
              </>
            ) : (
              <>
                {datosCctSugeridos && (
                  <p style={{ fontSize: 11, color: '#0F6E56', margin: '0 0 12px' }}>
                    📍 Sugerido del catálogo oficial SEP — revisa que sea correcto y corrígelo si hace falta.
                  </p>
                )}
                <label style={{ fontSize: 11, color: '#888', fontWeight: 600, display: 'block', marginBottom: 4 }}>Zona</label>
                <input value={zonaEditable} onChange={e => setZonaEditable(e.target.value)} style={campoEditable} />

                <label style={{ fontSize: 11, color: '#888', fontWeight: 600, display: 'block', marginBottom: 4 }}>Sector</label>
                <input value={sectorEditable} onChange={e => setSectorEditable(e.target.value)} placeholder='o "No aplica"' style={campoEditable} />

                <label style={{ fontSize: 11, color: '#888', fontWeight: 600, display: 'block', marginBottom: 4 }}>Región</label>
                <input value={regionEditable} onChange={e => setRegionEditable(e.target.value)} style={campoEditable} />

                <label style={{ fontSize: 11, color: '#888', fontWeight: 600, display: 'block', marginBottom: 4 }}>Turno</label>
                <select value={turnoEditable} onChange={e => setTurnoEditable(e.target.value)}
                  style={{ ...campoEditable, background: 'white', cursor: 'pointer' }}>
                  <option value="" disabled>— Selecciona —</option>
                  <option value="matutino">Matutino</option>
                  <option value="vespertino">Vespertino</option>
                  <option value="discontinuo">Discontinuo</option>
                </select>

                <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                  <button onClick={confirmarDatosInstitucionales} disabled={confirmandoInstitucional}
                    style={{ background: '#3D3A8C', color: 'white', border: 'none', padding: '8px 16px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: confirmandoInstitucional ? 'default' : 'pointer', opacity: confirmandoInstitucional ? 0.6 : 1 }}>
                    {confirmandoInstitucional ? 'Guardando...' : '✅ Confirmar'}
                  </button>
                  {institucionalConfirmado && (
                    <button onClick={() => setEditandoInstitucional(false)}
                      style={{ background: 'white', border: '1.5px solid #D8D6F0', color: '#888', padding: '8px 16px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                      Cancelar
                    </button>
                  )}
                </div>
              </>
            )}
          </div>

          {/* FOTO DE PERFIL */}
          <div style={{ background: 'white', border: '1px solid #E0DFF5', borderRadius: 12, padding: 24, textAlign: 'center' }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: '#3D3A8C', textTransform: 'uppercase' as const, letterSpacing: '0.07em', margin: '0 0 20px' }}>FOTO DE PERFIL</p>
            <div style={{ display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: 16 }}>
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="Foto de perfil"
                  style={{ width: 120, height: 120, borderRadius: '50%', objectFit: 'cover', border: '3px solid #EEEDF8' }} />
              ) : (
                <div style={{ width: 120, height: 120, borderRadius: '50%', background: '#00A896', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40,fontWeight: 700, color: 'white' }}>
                  {iniciales}
                </div>
              )}
              <div>
                <p style={{ margin: '0 0 10px', fontSize: 13, color: '#888', lineHeight: 1.5 }}>
                  Tu foto aparece en el menú lateral.<br/>
                  Formatos: JPG, PNG. Máximo 2MB.
                </p>
                <button onClick={() => fileRef.current?.click()} disabled={uploading}
                  style={{ background: '#3D3A8C', color: 'white', border: 'none', padding: '9px 18px', borderRadius: 8, cursor: uploading ? 'default' : 'pointer', fontSize: 13, fontWeight: 600, opacity: uploading ? 0.7 : 1 }}>
                  {uploading ? 'Subiendo...' : '📷 Cambiar foto'}
                </button>
                <input ref={fileRef} type="file" accept="image/jpeg,image/png" onChange={handleFoto} style={{ display: 'none' }} />
              </div>
            </div>
            {saveMsg && (
              <p style={{ margin: '16px 0 0', fontSize: 13, padding: '8px 12px', borderRadius: 6,
                background: saveMsg.startsWith('✅') ? '#d1fae5' : '#fee2e2',
                color: saveMsg.startsWith('✅') ? '#065f46' : '#991b1b' }}>
                {saveMsg}
              </p>
            )}
          </div>

          {/* DATOS DE CUENTA */}
          <div style={{ background: 'white', border: '1px solid #E0DFF5', borderRadius: 12, padding: 24, height: '100%', boxSizing: 'border-box' as const }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: '#3D3A8C', textTransform: 'uppercase' as const, letterSpacing: '0.07em', margin: '0 0 20px' }}>DATOS DE CUENTA</p>
            {[
              { label: 'Nombre completo', value: profile?.full_name },
              { label: 'Correo electrónico', value: profile?.email },
              { label: 'Rol', value: rolLabel[profile?.role] ?? profile?.role },
              { label: 'Membresía', value: membresiaLabel[profile?.membership_status] ?? profile?.membership_status },
                        ].map(item => filaLectura(item.label, item.value))}
            {/* WhatsApp — único campo editable de esta tarjeta, el resto son
                de solo lectura porque dependen de otro flujo (CCT, rol, etc.) */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, color: '#888' }}>WhatsApp</span>
              {!editandoWhatsapp ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#1A1A2E' }}>{profile?.whatsapp || '—'}</span>
                                    <button
                    onClick={() => { setWhatsappValor(profile?.whatsapp || ''); setEditandoWhatsapp(true); setErrorWhatsapp('') }}
                    style={{ background: 'none', border: 'none', color: '#3D3A8C', fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: 0 }}
                  >
                    Editar
                  </button>
                </span>
              ) : (
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input
                    value={whatsappValor}
                    onChange={e => setWhatsappValor(e.target.value)}
                    placeholder="10 dígitos"
                    style={{ width: 130, padding: '5px 8px', fontSize: 13, borderRadius: 6, border: '1px solid #D8D6F0', outline: 'none' }}
                  />
                  <button
                    onClick={guardarWhatsapp}
                    disabled={guardandoWhatsapp || !whatsappValor.trim()}
                    style={{ background: '#3D3A8C', color: 'white', border: 'none', padding: '5px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                  >
                    {guardandoWhatsapp ? '...' : 'Guardar'}
                  </button>
                  <button
                    onClick={() => { setEditandoWhatsapp(false); setErrorWhatsapp('') }}
                    disabled={guardandoWhatsapp}
                    style={{ background: 'none', border: 'none', color: '#888', fontSize: 12, cursor: 'pointer' }}
                  >
                    Cancelar
                  </button>
                </span>
              )}
            </div>
            {errorWhatsapp && (
              <p style={{ margin: '8px 0 0', fontSize: 12, color: '#991b1b', background: '#fee2e2', padding: '6px 10px', borderRadius: 6, textAlign: 'right' as const }}>
                {errorWhatsapp}
              </p>
            )}
          </div>

        </div>

                <div style={{ height: 24 }} />

        {/* ESTADO DE CUENTA — ancho completo, muestra el ciclo de pago
            vigente y cuánto se ha usado dentro de él */}
        {!cargandoEstadoCuenta && estadoCuenta && (
          <>
            <div style={{ background: 'white', border: '1px solid #E0DFF5', borderRadius: 12, padding: '20px 32px', boxSizing: 'border-box' as const }}>
              <p style={cardTitleStyle}>ESTADO DE CUENTA</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 24 }}>
                <div style={{ textAlign: 'center' as const }}>
                  <p style={{ fontSize: 11, color: '#888', margin: '0 0 4px', textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>Membresía</p>
                  <p style={{ fontSize: 15, fontWeight: 700, color: '#1A1A2E', margin: 0 }}>
                    {membresiaLabel[profile?.membership_status] ?? profile?.membership_status}
                  </p>
                </div>
                <div style={{ textAlign: 'center' as const }}>
                  <p style={{ fontSize: 11, color: '#888', margin: '0 0 4px', textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>Ciclo actual</p>
                  <p style={{ fontSize: 15, fontWeight: 700, color: '#1A1A2E', margin: 0 }}>
                    {new Date(estadoCuenta.ciclo_inicio).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}
                    {' – '}
                    {new Date(estadoCuenta.ciclo_fin).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}
                  </p>
                </div>
                <div style={{ textAlign: 'center' as const }}>
                  <p style={{ fontSize: 11, color: '#888', margin: '0 0 4px', textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>Días hábiles generados</p>
                  <p style={{ fontSize: 15, fontWeight: 700, color: '#3D3A8C', margin: 0 }}>
                    {estadoCuenta.dias_habiles_generados_ciclo}
                  </p>
                </div>
              </div>
            </div>
            <div style={{ height: 24 }} />
          </>
        )}

        {/* MI ESTILO DE NARRACIÓN — ahora ancho completo, delgada */}
        <div style={{ background: 'white', border: '1px solid #E0DFF5', borderRadius: 12, padding: '20px 32px', boxSizing: 'border-box' as const, textAlign: 'center' as const }}>
          <p style={cardTitleStyle}>MI ESTILO DE NARRACIÓN</p>
          <p style={{ fontSize: 12, color: '#888', margin: '0 0 16px', lineHeight: 1.5, textAlign: 'center' }}>
            Comparte cómo escribes: una carta, unas notas o cualquier texto tuyo. La finalidad es que aprendamos de tu tono y estilo personal. MÍA aprenderá de ti para que tus planeaciones tengan tu estilo pedagógico.
          </p>
          {!estiloGuardado ? (
            <div style={{ maxWidth: 640, margin: '0 auto' }}>
              <textarea value={estiloTexto} onChange={e => setEstiloTexto(e.target.value)} onInput={ajustarAlturaTextarea} rows={4}
                placeholder="Ej: Estimadas familias, quiero compartirles que esta semana trabajamos con los niños explorando..."
                style={{ display: 'block', width: '100%', padding: '10px 12px', fontSize: 13, borderRadius: 8, border: '1px solid #D8D6F0', boxSizing: 'border-box', resize: 'none', overflow: 'hidden', fontFamily: 'sans-serif', lineHeight: 1.6, marginBottom: 10 } as React.CSSProperties}
              />
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' as const, justifyContent: 'center' }}>
                <button onClick={handleAnalizarEstilo} disabled={analizandoEstilo || !estiloTexto.trim()}
                style={{ background: analizandoEstilo || !estiloTexto.trim() ? '#C4C2E8' : '#3D3A8C', color: 'white', border: 'none', padding: '8px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                  {analizandoEstilo ? '🔍 Analizando...' : '✨ Analizar'}
                </button>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'white', border: '1.5px solid #3D3A8C', color: '#3D3A8C', padding: '8px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                  {analizandoEstilo ? '🔍 Analizando...' : '📎 Subir'}
                  <input type="file" accept=".pdf,.doc,.docx" onChange={handleArchivoEstilo} style={{ display: 'none' }} disabled={analizandoEstilo} />
                </label>
                {resultadoEstilo && (
                  <button
                    type="button"
                    disabled={analizandoEstilo}
                    onClick={() => { setEstiloGuardado(true); setEstiloTexto(''); setErrorEstilo('') }}
                    style={{ background: 'white', border: '1.5px solid #D8D6F0', color: '#888', padding: '8px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: analizandoEstilo ? 'default' : 'pointer' }}>
                    Cancelar
                  </button>
                )}
              </div>
              {errorEstilo && (
                <p style={{ marginTop: 10, fontSize: 12, color: '#991b1b', background: '#fee2e2', padding: '6px 10px', borderRadius: 6, display: 'inline-block' }}>{errorEstilo}</p>
              )}
              <p style={{ fontSize: 10, color: '#aaa', marginTop: 6 }}>Al subir un documento se analiza automáticamente</p>
            </div>
          ) : (
            <div>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#065f46', margin: '0 0 4px' }}>✅ Estilo de escritura guardado</p>
              {resultadoEstilo?.tono && <p style={{ fontSize: 12, color: '#444', margin: '0 0 12px' }}><strong>Tono:</strong> {resultadoEstilo.tono}</p>}
              <button onClick={() => setEstiloGuardado(false)}
                style={{ background: 'white', border: '1.5px solid #3D3A8C', color: '#3D3A8C', padding: '7px 16px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                ↑ Actualizar
              </button>
            </div>
          )}
        </div>

        <div style={{ height: 40 }} />
      </div>
    </SidebarWrapper>
  )
}