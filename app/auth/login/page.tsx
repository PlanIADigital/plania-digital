'use client'
import { useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
)

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleLogin() {
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setError(error.message); setLoading(false) }
    else router.push('/dashboard')
  }

  return (
    <div style={{maxWidth:400,margin:'80px auto',fontFamily:'sans-serif',padding:24}}>
      <h1 style={{color:'#3D3A8C'}}>PlanIA Digital</h1>
      <h2>Iniciar sesión</h2>
      <input placeholder="Correo electrónico" value={email}
        onChange={e=>setEmail(e.target.value)}
        style={{display:'block',width:'100%',marginBottom:12,padding:8,fontSize:16}} />
      <input placeholder="Contraseña" type="password" value={password}
        onChange={e=>setPassword(e.target.value)}
        onKeyDown={e=>e.key==='Enter'&&handleLogin()}
        style={{display:'block',width:'100%',marginBottom:16,padding:8,fontSize:16}} />
      <button onClick={handleLogin} disabled={loading}
        style={{background:'#3D3A8C',color:'white',border:'none',padding:'12px 24px',fontSize:16,cursor:'pointer',width:'100%',borderRadius:6}}>
        {loading ? 'Entrando...' : 'Iniciar sesión'}
      </button>
      {error && <p style={{marginTop:16,color:'red',fontSize:14}}>{error}</p>}
      <p style={{marginTop:24}}>¿No tienes cuenta? <a href="/auth/register">Regístrate</a></p>
    </div>
  )
}
