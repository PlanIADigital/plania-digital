'use client'
import { useEffect } from 'react'

interface DetalleModalProps {
  titulo: string
  onClose: () => void
  children: React.ReactNode
}

export default function DetalleModal({ titulo, onClose, children }: DetalleModalProps) {
  useEffect(() => {
    function handleEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleEsc)
    return () => document.removeEventListener('keydown', handleEsc)
  }, [onClose])

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(26,26,46,0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: 24,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'white',
          borderRadius: 16,
          padding: '22px 26px',
          maxWidth: 480,
          width: '100%',
          maxHeight: '78vh',
          overflowY: 'auto',
          boxShadow: '0 16px 48px rgba(26,26,46,0.28)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, gap: 12 }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#3D3A8C', lineHeight: 1.4, textTransform: 'uppercase', letterSpacing: '0.02em' }}>{titulo}</h3>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            style={{ background: 'none', border: 'none', fontSize: 18, color: '#888', cursor: 'pointer', lineHeight: 1, flexShrink: 0, padding: 0 }}
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}