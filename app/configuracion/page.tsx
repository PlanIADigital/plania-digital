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
      if (data.estilo_narrativo) { setResultadoEstilo(data.estilo_narrativo); setEstiloGuardado(true) }
      setLoading(false)
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

  const turnoLabel: Record<string, string> = {
    matutino: 'Matutino',
    vespertino: 'Vespertino',
    discontinuo: 'Discontinuo',
  }

  const membresiaLabel: Record<string, string> = {
    trial: 'Prueba gratuita',
    active: 'Activa',
    cancelled: 'Cancelada',
    expired: 'Expirada',
  }

  const iniciales = profile?.full_name
    ?.split(' ').slice(0, 2).map((n: string) => n[0]).join('').toUpperCase() || '?'

  const cardTitleStyle: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: '#3D3A8C', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 20px', textAlign: 'center' }

  return (
    <SidebarWrapper profile={profile}>
      <div style={{ padding: '0 32px' }}>

        {/* ENCABEZADO */}
        <div style={{ background: 'linear-gradient(135deg, #3D3A8C 0%, #5B58B0 100%)', borderRadius: 14, padding: '28px 32px', marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <h2 style={{ color: 'white', margin: 0, fontSize: 24, fontWeight: 800, letterSpacing: '0.05em' }}>MI CONFIGURACIÓN</h2>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 24, alignItems: 'stretch' }}>

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
              { label: 'CCT principal', value: profile?.cct_primary },
              { label: 'Turno', value: turnoLabel[profile?.shift_primary] ?? profile?.shift_primary },
              { label: 'Membresía', value: membresiaLabel[profile?.membership_status] ?? profile?.membership_status },
            ].map(item => (
              <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 14, marginBottom: 14, borderBottom: '1px solid #F0EFF8' }}>
                <span style={{ fontSize: 13, color: '#888' }}>{item.label}</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#1A1A2E' }}>{item.value || '—'}</span>
              </div>
            ))}
          </div>

          {/* MI ESTILO DE NARRACIÓN — tercera columna, mismo grid */}
          <div style={{ background: 'white', border: '1px solid #E0DFF5', borderRadius: 12, padding: 24, boxSizing: 'border-box' as const, textAlign: 'center' as const, height: '100%' }}>
            <p style={cardTitleStyle}>MI ESTILO DE NARRACIÓN</p>
            <p style={{ fontSize: 12, color: '#888', margin: '0 0 16px', lineHeight: 1.5, textAlign: 'center' }}>
              Comparte cómo escribes: una carta, unas notas o cualquier texto tuyo.<br/>La finalidad es que aprendamos de tu tono y estilo personal.<br/>MÍA aprenderá de ti para que tus planeaciones tengan tu estilo pedagógico.
            </p>
            {!estiloGuardado ? (
              <div>
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
                  {/* [ago 2026] Solo aparece si había un estilo guardado antes de
                      entrar a editar — si es la primera vez (nunca hubo nada
                      guardado), no hay a qué "cancelar" volver. */}
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
                {/* [ago 2026] Ya NO borra resultadoEstilo aquí — solo abre el
                    formulario. Así, si el usuario decide no continuar, "Cancelar"
                    puede restaurar la vista guardada sin haber perdido el dato. */}
                <button onClick={() => setEstiloGuardado(false)}
                  style={{ background: 'white', border: '1.5px solid #3D3A8C', color: '#3D3A8C', padding: '7px 16px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                  ↑ Actualizar
                </button>
              </div>
            )}
          </div>

        </div>

        <div style={{ height: 40 }} />
      </div>
    </SidebarWrapper>
  )
}