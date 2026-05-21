'use client'
import { useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
)

export default function RegisterPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [role, setRole] = useState('educadora')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleRegister() {
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName, role } }
    })
    if (error) { setError(error.message); setLoading(false) }
    else router.push('/dashboard')
  }

  return (
    <div style={{maxWidth:400,margin:'80px auto',fontFamily:'sans-serif',padding:24}}>
      <h1 style={{color:'#3D3A8C'}}>PlanIA Digital</h1>
      <h2>Crear cuenta</h2>
      <input placeholder="Nombre completo" value={fullName}
        onChange={e=>setFullName(e.target.value)}
        style={{display:'block',width:'100%',marginBottom:12,padding:8,fontSize:16}} />
      <input placeholder="Correo electrónico" value={email}
        onChange={e=>setEmail(e.target.value)}
        style={{display:'block',width:'100%',marginBottom:12,padding:8,fontSize:16}} />
      <input placeholder="Contraseña" type="password" value={password}
        onChange={e=>setPassword(e.target.value)}
        style={{display:'block',width:'100%',marginBottom:12,padding:8,fontSize:16}} />
      <select value={role} onChange={e=>setRole(e.target.value)}
        style={{display:'block',width:'100%',marginBottom:16,padding:8,fontSize:16}}>
        <option value="educadora">Educadora</option>
        <option value="maestro_musica">Maestro de Música</option>
        <option value="directivo">Directivo</option>
      </select>
      <button onClick={handleRegister} disabled={loading}
        style={{background:'#00A896',color:'white',border:'none',padding:'12px 24px',fontSize:16,cursor:'pointer',width:'100%',borderRadius:6}}>
        {loading ? 'Registrando...' : 'Crear cuenta'}
      </button>
      {error && <p style={{marginTop:16,color:'red',fontSize:14}}>{error}</p>}
      <p style={{marginTop:24}}>¿Ya tienes cuenta? <a href="/auth/login">Inicia sesión</a></p>
    </div>
  )
}
