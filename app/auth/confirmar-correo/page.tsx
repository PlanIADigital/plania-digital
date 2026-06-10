'use client'
import { useRouter } from 'next/navigation'

export default function ConfirmarCorreoPage() {
  const router = useRouter()
  return (
    <div style={{ minHeight: '100vh', background: '#F4F3FB', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', fontFamily: 'sans-serif' }}>
      <div style={{ background: 'white', borderRadius: 16, padding: '48px 40px', maxWidth: 480, width: '100%', textAlign: 'center', boxShadow: '0 4px 24px rgba(61,58,140,0.10)' }}>
        
        <div style={{ fontSize: 48, marginBottom: 16 }}>📬</div>
        
        <h1 style={{ color: '#3D3A8C', fontSize: 22, fontWeight: 700, margin: '0 0 12px' }}>
          Revisa tu correo
        </h1>
        
        <p style={{ color: '#555', fontSize: 14, lineHeight: 1.7, margin: '0 0 24px' }}>
          Te enviamos un enlace de confirmación. Ábrelo desde tu correo para activar tu cuenta y comenzar a usar PlanIA Digital.
        </p>

        <div style={{ background: '#F4F3FB', borderRadius: 10, padding: '16px 20px', marginBottom: 28 }}>
          <p style={{ color: '#3D3A8C', fontSize: 13, margin: 0, lineHeight: 1.6 }}>
            💡 Si no ves el correo, revisa tu carpeta de <strong>spam o correo no deseado</strong>.
          </p>
        </div>

        <p style={{ color: '#888', fontSize: 13, margin: '0 0 16px' }}>
          ¿Ya confirmaste tu correo?
        </p>

        <button
          onClick={() => router.push('/auth/login')}
          style={{ background: '#3D3A8C', color: 'white', border: 'none', borderRadius: 8, padding: '12px 28px', fontSize: 14, fontWeight: 600, cursor: 'pointer', width: '100%' }}>
          Ir al inicio de sesión
        </button>

        <p style={{ color: '#bbb', fontSize: 11, marginTop: 24, lineHeight: 1.5 }}>
          PlanIA Digital no es una entidad afiliada, patrocinada ni respaldada por la SEP.
        </p>
      </div>
    </div>
  )
}
