// ============================================================
//  PlanIA Digital — Dashboard Super Admin
//  app/admin/page.tsx
// ============================================================
'use client'
import { useEffect, useState } from 'react'
import { fetchAdmin } from '@/lib/fetchAdmin'

const NOMBRES_ESTADO: Record<string, string> = {
  '01': 'Aguascalientes', '02': 'Baja California', '03': 'Baja California Sur',
  '04': 'Campeche', '05': 'Coahuila', '06': 'Colima', '07': 'Chiapas',
  '08': 'Chihuahua', '09': 'Ciudad de México', '10': 'Durango',
  '11': 'Guanajuato', '12': 'Guerrero', '13': 'Hidalgo', '14': 'Jalisco',
  '15': 'Estado de México', '16': 'Michoacán', '17': 'Morelos', '18': 'Nayarit',
  '19': 'Nuevo León', '20': 'Oaxaca', '21': 'Puebla', '22': 'Querétaro',
  '23': 'Quintana Roo', '24': 'San Luis Potosí', '25': 'Sinaloa', '26': 'Sonora',
  '27': 'Tabasco', '28': 'Tamaulipas', '29': 'Tlaxcala', '30': 'Veracruz',
  '31': 'Yucatán', '32': 'Zacatecas',
}

export default function AdminDashboard() {
  const [calendarioOk, setCalendarioOk] = useState<boolean | null>(null)
  const [federalCargado, setFederalCargado] = useState(false)
  const [estadosConEstatal, setEstadosConEstatal] = useState<string[]>([])
  const [usuarios, setUsuarios] = useState({ total: 0, educadoras: 0, directivos: 0, trials: 0 })

  useEffect(() => {
    async function cargar() {
      try {
        const [calRes, usrRes] = await Promise.all([
          fetchAdmin('/api/admin/calendario-estado'),
          fetchAdmin('/api/admin/usuarios'),
        ])
        const calData = await calRes.json()
        const usrData = await usrRes.json()

        setFederalCargado(calData.federal || false)
        setEstadosConEstatal(calData.estadosConEstatal || [])
        // "Completo" solo si federal está cargado Y al menos un estado tiene su calendario estatal
        setCalendarioOk((calData.federal || false) && (calData.estadosConEstatal || []).length > 0)

        const u = usrData.usuarios || []
        setUsuarios({
          total: u.length,
          educadoras: u.filter((x: any) => ['educadora','educador'].includes(x.role)).length,
          directivos: u.filter((x: any) => x.role === 'directivo').length,
          trials: u.filter((x: any) => x.membership_status === 'trial').length,
        })
      } catch {}
    }
    cargar()
  }, [])

  const nombresEstados = estadosConEstatal.map(c => NOMBRES_ESTADO[c] || c)
  const descripcionCalendario = federalCargado
    ? (nombresEstados.length > 0
        ? `Ciclo 2025–2026: Federal + ${nombresEstados.length} estado${nombresEstados.length > 1 ? 's' : ''} (${nombresEstados.join(', ')}).`
        : 'Ciclo 2025–2026: Federal cargado. Ningún estado tiene calendario estatal aún.')
    : 'Ciclo 2025–2026 sin cargar. Necesario para calcular días hábiles.'

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111827', marginBottom: 4 }}>Dashboard</h1>
      <p style={{ fontSize: 13, color: '#6B7280', marginBottom: 24 }}>Estado general de PlanIA al día de hoy</p>

      {calendarioOk === false && (
        <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 10, padding: '12px 16px', marginBottom: 24, display: 'flex', gap: 10 }}>
          <span>⚠️</span>
          <p style={{ fontSize: 13, color: '#92400E', margin: 0 }}>
            <strong>Calendario SEP incompleto</strong> — el generador no puede excluir festivos ni sesiones CTE para los estados sin calendario.{' '}
            <a href="/admin/calendario" style={{ color: '#92400E', fontWeight: 600 }}>Cargarlo ahora</a>
          </p>
        </div>
      )}

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
          <p style={{ fontSize: 12, color: '#6B7280', marginBottom: 12 }}>{descripcionCalendario}</p>
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