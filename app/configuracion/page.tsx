'use client'
import { useEffect, useState, useRef } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'
import SidebarWrapper from '@/components/SidebarWrapper'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function ConfiguracionPage() {
  const router = useRouter()
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/auth/login'); return }
      const { data } = await supabase
        .from('users').select('*')
        .eq('auth_uid', session.user.id).single()
      if (!data) { router.push('/auth/login'); return }
      setProfile(data)
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
      .update({ avatar_url: urlData.publicUrl })
      .eq('auth_uid', profile.auth_uid)
    if (updateErr) { setSaveMsg('⚠️ Error al guardar: ' + updateErr.message); setUploading(false); return }
    setProfile((prev: any) => ({ ...prev, avatar_url: urlData.publicUrl }))
    setSaveMsg('✅ Foto actualizada correctamente')
    setUploading(false)
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

  return (
    <SidebarWrapper profile={profile}>
      <div style={{ padding: '0 32px' }}>

        {/* ENCABEZADO */}
        <div style={{ background: 'linear-gradient(135deg, #3D3A8C 0%, #5B58B0 100%)', borderRadius: 14, padding: '24px 32px', marginBottom: 24, minHeight: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <h2 style={{ color: 'white', margin: 0, fontSize: 24, fontWeight: 800, letterSpacing: '0.05em' }}>MI CONFIGURACIÓN</h2>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, alignItems: 'stretch' }}>

          {/* FOTO DE PERFIL */}
          <div style={{ background: 'white', border: '1px solid #E0DFF5', borderRadius: 12, padding: 24, textAlign: 'center' }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: '#3D3A8C', textTransform: 'uppercase' as const, letterSpacing: '0.07em', margin: '0 0 20px' }}>FOTO DE PERFIL</p>
            <div style={{ display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: 16 }}>
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="Foto de perfil"
                  style={{ width: 120, height: 120, borderRadius: '50%', objectFit: 'cover', border: '3px solid #EEEDF8' }} />
              ) : (
                <div style={{ width: 120, height: 120, borderRadius: '50%', background: '#00A896', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40, fontWeight: 700, color: 'white' }}>
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

        </div>
        <div style={{ height: 40 }} />
      </div>
    </SidebarWrapper>
  )
}
