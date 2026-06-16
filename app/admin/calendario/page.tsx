'use client'
import { useState, useEffect } from 'react'

export default function CalendarioPage() {
  const [uploadingFederal, setUploadingFederal] = useState(false)
  const [uploadingEstatal, setUploadingEstatal] = useState(false)
  const [mensajeFederal, setMensajeFederal] = useState('')
  const [mensajeEstatal, setMensajeEstatal] = useState('')
  const [federalCargado, setFederalCargado] = useState(false)
  const [estatalCargado, setEstatalCargado] = useState(false)

  useEffect(() => {
    async function verificarEstado() {
      try {
        const res = await fetch('/api/admin/calendario-estado')
        const data = await res.json()
        setFederalCargado(data.federal || false)
        setEstatalCargado(data.estatal || false)
      } catch {}
    }
    verificarEstado()
  }, [])

  async function handleUpload(tipo: 'federal' | 'estatal', file: File) {
    if (tipo === 'federal') setUploadingFederal(true)
    else setUploadingEstatal(true)

    try {
      const text = await file.text()
      const json = JSON.parse(text)

      const res = await fetch('/api/admin/calendario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo, datos: json }),
      })

      const data = await res.json()
      if (data.ok) {
        if (tipo === 'federal') { setMensajeFederal('✅ Calendario federal cargado correctamente'); setFederalCargado(true) }
        else { setMensajeEstatal('✅ Calendario estatal cargado correctamente'); setEstatalCargado(true) }
      } else {
        if (tipo === 'federal') setMensajeFederal('❌ Error: ' + (data.error || 'inténtalo de nuevo'))
        else setMensajeEstatal('❌ Error: ' + (data.error || 'inténtalo de nuevo'))
      }
    } catch {
      if (tipo === 'federal') setMensajeFederal('❌ El archivo no es un JSON válido')
      else setMensajeEstatal('❌ El archivo no es un JSON válido')
    }

    if (tipo === 'federal') setUploadingFederal(false)
    else setUploadingEstatal(false)
  }

  const Badge = ({ cargado }: { cargado: boolean }) => (
    <span style={{
      fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20,
      background: cargado ? '#D1FAE5' : '#FEF3C7',
      color: cargado ? '#065F46' : '#92400E',
    }}>
      {cargado ? '✅ Cargado' : 'Pendiente'}
    </span>
  )

  return (
    <div>
      <h1 style={{ fontSize: 20, fontWeight: 700, color: '#111827', marginBottom: 4 }}>Calendario SEP</h1>
      <p style={{ fontSize: 13, color: '#6B7280', marginBottom: 24 }}>
        Gestión del calendario escolar oficial. Define días hábiles, festivos y sesiones CTE para el generador de planeaciones.
      </p>

      {/* Alerta solo si alguno está pendiente */}
      {(!federalCargado || !estatalCargado) && (
        <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 10, padding: '12px 16px', marginBottom: 24, display: 'flex', gap: 10 }}>
          <span style={{ color: '#D97706' }}>⚠️</span>
          <p style={{ fontSize: 13, color: '#92400E', margin: 0 }}>
            <strong>Ciclo 2025–2026 incompleto.</strong> El generador no puede excluir festivos ni sesiones CTE hasta que ambos calendarios estén cargados.
          </p>
        </div>
      )}

      {/* Ambos cargados */}
      {federalCargado && estatalCargado && (
        <div style={{ background: '#ECFDF5', border: '1px solid #6EE7B7', borderRadius: 10, padding: '12px 16px', marginBottom: 24, display: 'flex', gap: 10 }}>
          <span>✅</span>
          <p style={{ fontSize: 13, color: '#065F46', margin: 0 }}>
            <strong>Ciclo 2025–2026 completo.</strong> Ambos calendarios están cargados. El generador puede calcular días hábiles correctamente.
          </p>
        </div>
      )}

      {/* Instrucciones */}
      <div style={{ background: '#EEF2FF', border: '1px solid #C7D2FE', borderRadius: 12, padding: '16px 20px', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <span>💡</span>
          <h2 style={{ fontSize: 13, fontWeight: 600, color: '#3730A3', margin: 0 }}>Cómo convertir el PDF del calendario SEP a JSON</h2>
        </div>
        <ol style={{ margin: 0, paddingLeft: 16, fontSize: 12, color: '#4338CA', lineHeight: 1.8 }}>
          <li>Descarga el PDF oficial desde educacionbasica.sep.gob.mx</li>
          <li>Abre un chat nuevo en Claude.ai y sube el PDF</li>
          <li>Pide: <em>"Extrae todas las fechas en formato JSON con ciclo, inicio_clases, fin_clases, dias_inhabiles y sesiones_cte"</em></li>
          <li>Copia el JSON, guárdalo como archivo <code>.json</code> y súbelo aquí</li>
        </ol>
        <div style={{ marginTop: 10, display: 'flex', gap: 12 }}>
          <a href="https://educacionbasica.sep.gob.mx" target="_blank" style={{ fontSize: 12, color: '#3730A3', fontWeight: 600 }}>Ir a SEP →</a>
          <a href="https://claude.ai" target="_blank" style={{ fontSize: 12, color: '#3730A3', fontWeight: 600 }}>Abrir Claude.ai →</a>
        </div>
      </div>

      {/* Federal */}
      <div style={{ background: 'white', border: '1px solid #E5E7EB', borderRadius: 12, padding: '20px', marginBottom: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>🇲🇽</span>
            <h2 style={{ fontSize: 14, fontWeight: 600, color: '#111827', margin: 0 }}>Calendario SEP Federal</h2>
          </div>
          <Badge cargado={federalCargado} />
        </div>
        <p style={{ fontSize: 12, color: '#9CA3AF', marginBottom: 16 }}>Aplica a todos los estados. Cargar al inicio de cada ciclo escolar.</p>
        <label style={{ display: 'block', border: '2px dashed #E5E7EB', borderRadius: 10, padding: '24px', textAlign: 'center', cursor: 'pointer' }}>
          <span style={{ fontSize: 28, display: 'block', marginBottom: 8 }}>📂</span>
          <span style={{ fontSize: 13, color: '#6B7280' }}>
            {uploadingFederal ? 'Cargando...' : 'Selecciona el archivo JSON del calendario federal'}
          </span>
          <span style={{ fontSize: 11, color: '#D1D5DB', display: 'block', marginTop: 4 }}>Formato: .json · Máx. 1 MB</span>
          <input type="file" accept=".json" style={{ display: 'none' }}
            onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload('federal', f) }} />
        </label>
        {mensajeFederal && <p style={{ marginTop: 10, fontSize: 12, fontWeight: 500, color: '#374151' }}>{mensajeFederal}</p>}
      </div>

      {/* Estatal */}
      <div style={{ background: 'white', border: '1px solid #E5E7EB', borderRadius: 12, padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>🏛️</span>
            <h2 style={{ fontSize: 14, fontWeight: 600, color: '#111827', margin: 0 }}>Calendario SEP Nuevo León</h2>
          </div>
          <Badge cargado={estatalCargado} />
        </div>
        <p style={{ fontSize: 12, color: '#9CA3AF', marginBottom: 16 }}>Ajustes estatales de Nuevo León. Coordinación SENL / SEP NL.</p>
        <label style={{ display: 'block', border: '2px dashed #E5E7EB', borderRadius: 10, padding: '24px', textAlign: 'center', cursor: 'pointer' }}>
          <span style={{ fontSize: 28, display: 'block', marginBottom: 8 }}>📂</span>
          <span style={{ fontSize: 13, color: '#6B7280' }}>
            {uploadingEstatal ? 'Cargando...' : 'Selecciona el archivo JSON del calendario estatal'}
          </span>
          <span style={{ fontSize: 11, color: '#D1D5DB', display: 'block', marginTop: 4 }}>Formato: .json · Máx. 1 MB</span>
          <input type="file" accept=".json" style={{ display: 'none' }}
            onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload('estatal', f) }} />
        </label>
        {mensajeEstatal && <p style={{ marginTop: 10, fontSize: 12, fontWeight: 500, color: '#374151' }}>{mensajeEstatal}</p>}
      </div>
    </div>
  )
}
