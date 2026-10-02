'use client'
// ============================================================
//  PlanIA Digital — Botón de descarga del semáforo (educadora)
//  components/BotonWordSemaforo.tsx
//  Descarga el Word imprimible del momento elegido: encabezado
//  del jardín, tabla por código AL-XX (nombre en blanco para
//  escribirse a mano) y resumen por área con barras.
// ============================================================
import { useState } from 'react'
import { fetchConSesion } from '@/lib/fetchConSesion'

export default function BotonWordSemaforo({ momento, hayCapturas }: { momento: string; hayCapturas: boolean }) {
  const [descargando, setDescargando] = useState(false)
  const [error, setError] = useState('')
  const habilitado = hayCapturas && !descargando

  async function descargar() {
    setError('')
    setDescargando(true)
    try {
      const res = await fetchConSesion(`/api/semaforo/word?momento=${encodeURIComponent(momento)}`)
      if (!res.ok) {
        let msg = 'No se pudo generar el Word.'
        try { const j = await res.json(); if (j?.error) msg = j.error } catch {}
        setError(msg)
        return
      }
      const blob = await res.blob()
      const disp = res.headers.get('Content-Disposition') || ''
      const m = disp.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i)
      const nombre = m ? decodeURIComponent(m[1]) : `Semaforo_${momento}.docx`
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = nombre
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch {
      setError('No se pudo descargar. Revisa tu conexión e inténtalo de nuevo.')
    } finally {
      setDescargando(false)
    }
  }

  return (
    <div style={{ marginTop: 14 }}>
      <button
        type="button"
        onClick={descargar}
        disabled={!habilitado}
        style={{
          minHeight: 44, padding: '10px 18px', borderRadius: 10,
          border: `1.5px solid ${habilitado ? '#3D3A8C' : '#E5E7EB'}`,
          background: '#FFFFFF',
          color: habilitado ? '#3D3A8C' : '#9CA3AF',
          fontSize: 14, fontWeight: 700, cursor: habilitado ? 'pointer' : 'default',
        }}
      >
        {descargando ? 'Generando…' : 'Descargar Word para imprimir'}
      </button>
      <p style={{ fontSize: 12, color: '#6B7280', margin: '6px 0 0' }}>
        {hayCapturas
          ? 'Lista por código con espacio para escribir los nombres a mano, y resumen por área.'
          : 'Se habilita cuando captures al menos un área de este momento.'}
      </p>
      {error && <p style={{ fontSize: 13, color: '#8A6D1D', margin: '6px 0 0' }}>{error}</p>}
    </div>
  )
}
