'use client'
// ============================================================
//  PlanIA Digital — Botón de descarga del semáforo (directora)
//  components/BotonExcelSemaforo.tsx
//  Descarga el concentrado del jardín + una hoja por grupo que
//  ya envió. Solo códigos AL-XX: los nombres los escribe la
//  escuela en el archivo impreso (nunca se guardan en PlanIA).
// ============================================================
import { useState } from 'react'
import { fetchConSesion } from '@/lib/fetchConSesion'

export default function BotonExcelSemaforo({ momento, enviados }: { momento: string; enviados: number }) {
  const [descargando, setDescargando] = useState(false)
  const [error, setError] = useState('')
  const habilitado = enviados > 0 && !descargando

  async function descargar() {
    setError('')
    setDescargando(true)
    try {
      const res = await fetchConSesion(`/api/directivo/semaforo/excel?momento=${encodeURIComponent(momento)}`)
      if (!res.ok) {
        let msg = 'No se pudo generar el archivo.'
        try { const j = await res.json(); if (j?.error) msg = j.error } catch {}
        setError(msg)
        return
      }
      const blob = await res.blob()
      const disp = res.headers.get('Content-Disposition') || ''
      const m = disp.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i)
      const nombre = m ? decodeURIComponent(m[1]) : `Semaforo_${momento}.xlsx`
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
          minHeight: 44, padding: '10px 18px', borderRadius: 10, border: 'none',
          background: habilitado ? '#00806F' : '#E5E7EB',
          color: habilitado ? '#FFFFFF' : '#9CA3AF',
          fontSize: 14, fontWeight: 700, cursor: habilitado ? 'pointer' : 'default',
        }}
      >
        {descargando ? 'Generando…' : 'Descargar Excel'}
      </button>
      <p style={{ fontSize: 12, color: '#6B7280', margin: '6px 0 0' }}>
        {enviados > 0
          ? 'Concentrado del jardín y una hoja por grupo que ya envió.'
          : 'Se habilita cuando al menos un grupo envíe su semáforo.'}
      </p>
      {error && <p style={{ fontSize: 13, color: '#8A6D1D', margin: '6px 0 0' }}>{error}</p>}
    </div>
  )
}
