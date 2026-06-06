'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import { supabase } from '@/lib/supabase'


export default function MiGrupoPage() {
  const router = useRouter()
  const [profile, setProfile] = useState<any>(null)
  const [diagnosticoTexto, setDiagnosticoTexto] = useState('')
  const [analizando, setAnalizando] = useState(false)
  const [pdas, setPdas] = useState<any[]>([])
  const [guardado, setGuardado] = useState(false)
  const [error, setError] = useState('')
  const [archivoNombre, setArchivoNombre] = useState('')

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/auth/login'); return }
      const { data } = await supabase.from('users').select('*').eq('auth_uid', session.user.id).single()
      if (!data?.profile_completed) { router.push('/onboarding'); return }
      setProfile(data)
      if (data.diagnostico_texto) {
        setDiagnosticoTexto(data.diagnostico_texto)
      }
      if (data.pdas_prioritarios?.length > 0) {
        setPdas(data.pdas_prioritarios)
      }
    }
    load()
  }, [])

  async function handleArchivo(e: React.ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0]
    if (!archivo) return
    setArchivoNombre(archivo.name)
    const formData = new FormData()
    formData.append('file', archivo)
    try {
      const res = await fetch('/api/extraer-texto', {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()
      if (data.texto) {
        setDiagnosticoTexto(data.texto)
      } else {
        setError('No se pudo extraer el texto del archivo.')
      }
    } catch {
      setError('Error al procesar el archivo.')
    }
  }

  async function handleAnalizar() {
    if (!diagnosticoTexto.trim()) {
      setError('Escribe o sube tu diagnóstico antes de analizar.')
      return
    }
    setAnalizando(true)
    setError('')
    setPdas([])
    setGuardado(false)
    try {
      const res = await fetch('/api/analizar-diagnostico', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          diagnostico_texto: diagnosticoTexto,
          grado: profile?.grado || '2°',
          auth_uid: profile?.auth_uid,
        })
      })
      const data = await res.json()
      if (data.pdas_sugeridos) {
        setPdas(data.pdas_sugeridos)
        setGuardado(true)
      } else {
        setError(data.error || 'No se pudieron analizar los PDAs.')
      }
    } catch {
      setError('Error de conexión.')
    }
    setAnalizando(false)
  }

  const s = {
    section: { background: 'white', borderRadius: 12, padding: 28, marginBottom: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' } as React.CSSProperties,
    sectionTitle: { fontSize: 12, fontWeight: 700, color: '#3D3A8C', textTransform: 'uppercase' as const, letterSpacing: '0.08em', marginBottom: 16, marginTop: 0 } as React.CSSProperties,
    label: { display: 'block', marginBottom: 6, fontWeight: 600, color: '#1A1A2E', fontSize: 14 } as React.CSSProperties,
  }

  if (!profile) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
      <p style={{ color: '#3D3A8C' }}>Cargando...</p>
    </div>
  )

  return (
    <Sidebar profile={profile}>
      <div style={{ maxWidth: 680, margin: '40px auto', padding: '0 32px' }}>

        <div style={s.section}>
          <h2 style={{ color: '#3D3A8C', marginTop: 0, marginBottom: 4, fontSize: 22, fontWeight: 700 }}>
            Diagnóstico de mi grupo
          </h2>
          <p style={{ color: '#888', fontSize: 13, marginBottom: 24, marginTop: 0 }}>
            {profile.cct_primary} · {profile.grado || '2°'} grado · {profile.total_students || 24} alumnos
          </p>

          {/* Sección texto */}
          <div style={{ marginBottom: 20 }}>
            <label style={s.label}>Escribe o pega tu diagnóstico *</label>
            <p style={{ fontSize: 12, color: '#888', margin: '0 0 10px', lineHeight: 1.5 }}>
              Describe las áreas de oportunidad y necesidades detectadas en tus alumnos. El sistema analizará el texto y sugerirá los PDAs más relevantes para atenderlas.
            </p>
            <textarea
              value={diagnosticoTexto}
              onChange={e => setDiagnosticoTexto(e.target.value)}
              rows={8}
              placeholder="Ej: El grupo presenta dificultades en la expresión oral, varios niños no logran sostener conversaciones breves. En pensamiento matemático se detectó que la mayoría no identifica cantidades mayores a 5..."
              style={{ display: 'block', width: '100%', padding: '12px 14px', fontSize: 14, borderRadius: 8, border: '1px solid #D8D6F0', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'sans-serif', lineHeight: 1.6 } as React.CSSProperties}
            />
          </div>

          {/* Subir archivo */}
          <div style={{ background: '#F8F8FE', border: '1px dashed #C4C2E8', borderRadius: 10, padding: 16, marginBottom: 24 }}>
            <label style={{ ...s.label, marginBottom: 4 }}>
              O sube tu diagnóstico en Word o PDF
              <span style={{ fontWeight: 400, color: '#888', fontSize: 13, marginLeft: 6 }}>(opcional)</span>
            </label>
            <p style={{ fontSize: 12, color: '#888', margin: '0 0 12px', lineHeight: 1.5 }}>
              El sistema extraerá el texto automáticamente.
            </p>
            <input
              type="file"
              accept=".pdf,.doc,.docx"
              onChange={handleArchivo}
              style={{ display: 'none' }}
              id="archivo-diagnostico"
            />
            <label htmlFor="archivo-diagnostico" style={{ display: 'inline-block', background: 'white', border: '1.5px solid #3D3A8C', color: '#3D3A8C', padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              📎 Seleccionar archivo
            </label>
            {archivoNombre && (
              <span style={{ marginLeft: 12, fontSize: 13, color: '#00A896', fontWeight: 500 }}>
                ✓ {archivoNombre}
              </span>
            )}
          </div>

          {error && (
            <p style={{ color: '#DC2626', fontSize: 13, marginBottom: 16, background: '#FEF2F2', padding: '8px 12px', borderRadius: 6 }}>
              {error}
            </p>
          )}

          <button
            onClick={handleAnalizar}
            disabled={analizando || !diagnosticoTexto.trim()}
            style={{ background: analizando ? '#F0EFF8' : '#00A896', color: analizando ? '#3D3A8C' : 'white', border: 'none', padding: '13px 24px', fontSize: 15, cursor: analizando ? 'default' : 'pointer', width: '100%', borderRadius: 8, fontWeight: 600 }}>
            {analizando ? '🔍 Analizando las necesidades de tu grupo...' : '✨ Analizar diagnóstico y sugerir PDAs'}
          </button>

          {guardado && (
            <p style={{ fontSize: 13, color: '#065f46', background: '#d1fae5', padding: '8px 12px', borderRadius: 6, marginTop: 12, marginBottom: 0 }}>
              ✅ Diagnóstico guardado. Los PDAs prioritarios ya están disponibles al crear tu próxima planeación.
            </p>
          )}
        </div>

        {/* Resultados agrupados por campo+contenido */}
        {pdas.length > 0 && (() => {
          // Agrupar PDAs por campo+contenido
          const grupos: Record<string, { campo: string; contenido: string; items: any[] }> = {}
          pdas.forEach((p) => {
            const key = `${p.campo}||${p.contenido}`
            if (!grupos[key]) grupos[key] = { campo: p.campo, contenido: p.contenido, items: [] }
            grupos[key].items.push(p)
          })
          const gruposArray = Object.values(grupos)
          return (
            <div style={s.section}>
              <p style={s.sectionTitle}>PDAs sugeridos para tu grupo</p>
              <p style={{ fontSize: 13, color: '#666', marginTop: 0, marginBottom: 20, lineHeight: 1.6 }}>
                Basados en las necesidades detectadas en tu diagnóstico. Estos PDAs aparecerán destacados al crear tu próxima planeación.
              </p>
              {gruposArray.map((grupo, gi) => (
                <div key={gi} style={{ border: '1.5px solid #E0F5F3', borderRadius: 10, padding: 16, marginBottom: 12, background: 'white' }}>
                  {/* Encabezado del grupo */}
                  <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' as const }}>
                    <span style={{ background: '#EEEDF8', color: '#3D3A8C', fontSize: 11, padding: '3px 10px', borderRadius: 20, fontWeight: 700 }}>
                      {grupo.campo}
                    </span>
                    <span style={{ background: '#F0FFF8', color: '#059669', fontSize: 11, padding: '3px 10px', borderRadius: 20, fontWeight: 600 }}>
                      {grupo.items.length} PDA{grupo.items.length > 1 ? 's' : ''} prioritario{grupo.items.length > 1 ? 's' : ''}
                    </span>
                  </div>
                  <p style={{ margin: '0 0 12px', fontSize: 12, color: '#888' }}>Contenido</p>
                  <p style={{ margin: '0 0 14px', fontSize: 14, fontWeight: 600, color: '#1A1A2E', lineHeight: 1.5 }}>{grupo.contenido}</p>
                  {/* PDAs del grupo */}
                  <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 10 }}>
                    {grupo.items.map((p, pi) => (
                      <div key={pi} style={{ background: '#F8FFFE', border: '1px solid #C8EFE9', borderRadius: 8, padding: 12 }}>
                        {grupo.items.length > 1 && (
                          <p style={{ margin: '0 0 6px', fontSize: 11, fontWeight: 700, color: '#00A896', textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}>
                            PDA {pi + 1}
                          </p>
                        )}
                        <p style={{ margin: '0 0 8px', fontSize: 13, color: '#1A1A2E', lineHeight: 1.6, fontStyle: 'italic' }}>{p.pda}</p>
                        <p style={{ margin: '0 0 2px', fontSize: 11, color: '#888' }}>¿Por qué este PDA?</p>
                        <p style={{ margin: 0, fontSize: 12, color: '#444', lineHeight: 1.5 }}>{p.justificacion}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )
        })()}

        <div style={{ height: 40 }} />
      </div>
    </Sidebar>
  )
}