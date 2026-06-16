// ============================================================
//  PlanIA Digital — Dashboard Super Admin
//  app/admin/page.tsx
// ============================================================
'use client'
import { useEffect, useState } from 'react'

export default function AdminDashboard() {
  const [calendarioOk, setCalendarioOk] = useState<boolean | null>(null)
  const [usuarios, setUsuarios] = useState({ total: 0, educadoras: 0, directivos: 0, trials: 0 })

  useEffect(() => {
    async function cargar() {
      try {
        const [calRes, usrRes] = await Promise.all([
          fetch('/api/admin/calendario-estado'),
          fetch('/api/admin/usuarios'),
        ])
        const calData = await calRes.json()
        const usrData = await usrRes.json()
        setCalendarioOk(calData.federal && calData.estatal)
        const u = usrData.usuarios || []
        setUsuarios({
          total: u.length,
          educadoras: u.filter((x: any) => ['educadora','educador'].includes(x.role)).length,
          directivos: u.filter((x: any) => x.role === 'directivo').length,
          trials: u.filter((x: any) => x.subscription_status === 'trial').length,
        })
      } catch {}
    }
    cargar()
  }, [])

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111827', marginBottom: 4 }}>Dashboard</h1>
      <p style={{ fontSize: 13, color: '#6B7280', marginBottom: 24 }}>Estado general de PlanIA al día de hoy</p>

      {/* Alerta calendario solo si no está cargado */}
      {calendarioOk === false && (
        <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 10, padding: '12px 16px', marginBottom: 24, display: 'flex', gap: 10 }}>
          <span>⚠️</span>
          <p style={{ fontSize: 13, color: '#92400E', margin: 0 }}>
            <strong>Calendario SEP no cargado</strong> — el generador no puede excluir festivos ni sesiones CTE.{' '}
            <a href="/admin/calendario" style={{ color: '#92400E', fontWeight: 600 }}>Cargarlo ahora</a>
          </p>
        </div>
      )}

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Usuarios activos', value: usuarios.total, color: '#3D3A8C' },
          { label: 'Educadoras', value: usuarios.educadoras, color: '#111827' },
          { label: 'Directivos', value: usuarios.directivos, color: '#111827' },
          { label: 'Trial activos', value: usuarios.trials, color: '#D97706' },
        ].map(k => (
          <div key={k.label} style={{ background: 'white', border: '1px solid #E5E7EB', borderRadius: 12, padding: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <p style={{ fontSize: 12, color: '#6B7280', margin: '0 0 6px' }}>{k.label}</p>
            <p style={{ fontSize: 28, fontWeight: 700, color: k.color, margin: 0 }}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div style={{ background: 'white', border: '1px solid #E5E7EB', borderRadius: 12, padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>📅</span>
              <span style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>Calendario SEP</span>
            </div>
            {calendarioOk === null ? (
              <span style={{ fontSize: 11, color: '#9CA3AF' }}>Verificando...</span>
            ) : calendarioOk ? (
              <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20, background: '#D1FAE5', color: '#065F46' }}>✅ Completo</span>
            ) : (
              <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20, background: '#FEF3C7', color: '#92400E' }}>Pendiente</span>
            )}
          </div>
          <p style={{ fontSize: 12, color: '#6B7280', marginBottom: 12 }}>
            {calendarioOk ? 'Ciclo 2025–2026 cargado. Federal + Nuevo León.' : 'Ciclo 2025–2026 sin cargar. Necesario para calcular días hábiles.'}
          </p>
          <a href="/admin/calendario" style={{ fontSize: 12, fontWeight: 600, color: '#3D3A8C', textDecoration: 'none' }}>Ir a Calendario →</a>
        </div>

        <div style={{ background: 'white', border: '1px solid #E5E7EB', borderRadius: 12, padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>🤖</span>
              <span style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>Modelos IA</span>
            </div>
            <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20, background: '#D1FAE5', color: '#065F46' }}>Al día</span>
          </div>
          <p style={{ fontSize: 12, color: '#6B7280', marginBottom: 12 }}>Sonnet 4.6 · Haiku 4.5 activos en Vercel.</p>
          <a href="/admin/modelos" style={{ fontSize: 12, fontWeight: 600, color: '#3D3A8C', textDecoration: 'none' }}>Ver modelos →</a>
        </div>
      </div>
    </div>
  )
}
