'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
)

export default function DashboardPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadUser() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/auth/login'); return }
      setUser(session.user)
      const { data } = await supabase
        .from('users')
        .select('*')
        .eq('auth_uid', session.user.id)
        .single()
      if (!data?.profile_completed) { router.push('/onboarding'); return }
      setProfile(data)
      setLoading(false)
    }
    loadUser()
  }, [])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  if (loading) return (
    <div style={{display:'flex',justifyContent:'center',alignItems:'center',height:'100vh',fontFamily:'sans-serif'}}>
      <p style={{color:'#3D3A8C'}}>Cargando...</p>
    </div>
  )

  return (
    <div style={{minHeight:'100vh',background:'#E8F5F2',fontFamily:'sans-serif'}}>
      <nav style={{background:'#3D3A8C',padding:'16px 32px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <h1 style={{color:'white',margin:0,fontSize:20}}>PlanIA Digital</h1>
        <button onClick={handleLogout}
          style={{background:'transparent',color:'white',border:'1px solid white',padding:'8px 16px',cursor:'pointer',borderRadius:4}}>
          Cerrar sesión
        </button>
      </nav>
      <div style={{maxWidth:800,margin:'40px auto',padding:'0 24px'}}>
        <div style={{background:'white',borderRadius:12,padding:32,marginBottom:24,boxShadow:'0 2px 8px rgba(0,0,0,0.08)'}}>
          <h2 style={{color:'#3D3A8C',marginTop:0}}>
            Bienvenida, {profile?.full_name} 👋
          </h2>
          <p style={{color:'#666',margin:0}}>
            {profile?.cct_primary} · {profile?.shift_primary} · Rol: <strong>{profile?.role}</strong> · Membresía: <strong>{profile?.membership_status}</strong>
          </p>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
          <div style={{background:'white',borderRadius:12,padding:24,boxShadow:'0 2px 8px rgba(0,0,0,0.08)'}}>
            <h3 style={{color:'#00A896',marginTop:0}}>📋 Mis planeaciones</h3>
            <p style={{color:'#999',fontSize:14}}>Aún no tienes planeaciones.<br/>¡Crea tu primera hoy!</p>
            <button onClick={() => router.push('/planeacion/nueva')}
  style={{background:'#00A896',color:'white',border:'none',padding:'10px 20px',borderRadius:6,cursor:'pointer',fontSize:14,marginTop:8}}>
  + Nueva planeación
</button>
          </div>
          <div style={{background:'white',borderRadius:12,padding:24,boxShadow:'0 2px 8px rgba(0,0,0,0.08)'}}>
            <h3 style={{color:'#3D3A8C',marginTop:0}}>📊 Cobertura PDA</h3>
            <p style={{color:'#999',fontSize:14}}>Ciclo 2025-2026<br/>0 PDAs cubiertos este ciclo.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
