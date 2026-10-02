// ============================================================
//  PlanIA Digital — components/EncabezadoPagina.tsx
//  [30 sep 2026] Encabezado común de página.
//  v2: tarjeta blanca con título en MAYÚSCULAS, acento cian y
//  subtítulo opcional (a la derecha si cabe, debajo si no).
//  v3 [1 oct 2026]: `antetitulo` opcional (texto pequeño ARRIBA del
//  título, p. ej. el saludo). Con antetítulo, todo se apila en tres
//  renglones: antetítulo / título / subtítulo — evita desbordes en
//  celular con saludos o nombres largos.
// ============================================================
export default function EncabezadoPagina({
  titulo,
  subtitulo,
  antetitulo,
  maxWidth = 720,
}: {
  titulo: string
  subtitulo?: string
  antetitulo?: string
  maxWidth?: number | string
}) {
  const estiloTitulo: React.CSSProperties = {
    margin: 0, fontSize: 22, fontWeight: 800, color: '#3D3A8C',
    textTransform: 'uppercase', letterSpacing: '0.06em', lineHeight: 1.25,
    overflowWrap: 'anywhere',
  }
  return (
    <header style={{
      maxWidth, margin: '16px auto 12px', boxSizing: 'border-box',
      background: 'white', border: '1px solid #E0DFF5', borderRadius: 12,
      padding: '16px 20px',
    }}>
      {antetitulo ? (
        <>
          <p style={{ margin: '0 0 2px', fontSize: 15, fontWeight: 600, color: '#6B7280' }}>{antetitulo}</p>
          <h1 style={estiloTitulo}>{titulo}</h1>
          {subtitulo && <p style={{ margin: '6px 0 0', fontSize: 14, color: '#6B7280', lineHeight: 1.5 }}>{subtitulo}</p>}
        </>
      ) : (
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <h1 style={estiloTitulo}>{titulo}</h1>
          {subtitulo && <p style={{ margin: 0, fontSize: 14, color: '#6B7280', lineHeight: 1.5 }}>{subtitulo}</p>}
        </div>
      )}
      <div style={{ width: 40, height: 3, borderRadius: 99, background: '#00A896', marginTop: 10 }} />
    </header>
  )
}
