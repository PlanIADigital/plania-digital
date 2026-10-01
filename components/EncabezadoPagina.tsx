// ============================================================
//  PlanIA Digital — components/EncabezadoPagina.tsx
//  [30 sep 2026] Encabezado común de página.
//  v2: tarjeta blanca (mismo lenguaje que las demás tarjetas) con el
//  título en MAYÚSCULAS, más grande que los títulos de tarjeta para que
//  se lea como encabezado de página, acento cian y subtítulo opcional.
//  Motivo: la franja índigo competía con la barra de la marca, y el
//  título sin fondo se perdía.
// ============================================================
export default function EncabezadoPagina({
  titulo,
  subtitulo,
  maxWidth = 720,
}: {
  titulo: string
  subtitulo?: string
  maxWidth?: number | string
}) {
  return (
    <header style={{
      maxWidth, margin: '16px auto 12px', boxSizing: 'border-box',
      background: 'white', border: '1px solid #E0DFF5', borderRadius: 12,
      padding: '16px 20px',
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <h1 style={{
          margin: 0, fontSize: 22, fontWeight: 800, color: '#3D3A8C',
          textTransform: 'uppercase', letterSpacing: '0.06em', lineHeight: 1.25,
        }}>
          {titulo}
        </h1>
        {subtitulo && (
          <p style={{ margin: 0, fontSize: 14, color: '#6B7280', lineHeight: 1.5 }}>{subtitulo}</p>
        )}
      </div>
      <div style={{ width: 40, height: 3, borderRadius: 99, background: '#00A896', marginTop: 10 }} />
    </header>
  )
}
