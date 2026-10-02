// ============================================================
//  PlanIA Digital — components/EncabezadoPagina.tsx
//  [30 sep 2026] Encabezado común de página (tarjeta blanca).
//  v4 [1 oct 2026]: patrón consistente de TRES renglones apilados en
//  todas las páginas, para que la tarjeta tenga la misma altura y el
//  cambio de página no "brinque":
//    1) antetítulo pequeño en gris (verbo en infinitivo o saludo)
//    2) título grande en MAYÚSCULAS
//    3) subtítulo en gris (contexto: fecha, grupo, ciclo…)
//  y el acento cian debajo.
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
  return (
    <header style={{
      maxWidth, margin: '16px auto 12px', boxSizing: 'border-box',
      background: 'white', border: '1px solid #E0DFF5', borderRadius: 12,
      padding: '16px 20px',
    }}>
      {antetitulo && (
        <p style={{ margin: '0 0 2px', fontSize: 15, fontWeight: 600, color: '#6B7280' }}>{antetitulo}</p>
      )}
      <h1 style={{
        margin: 0, fontSize: 22, fontWeight: 800, color: '#3D3A8C',
        textTransform: 'uppercase', letterSpacing: '0.06em', lineHeight: 1.25,
        overflowWrap: 'anywhere',
      }}>
        {titulo}
      </h1>
      {subtitulo && (
        <p style={{ margin: '6px 0 0', fontSize: 14, color: '#6B7280', lineHeight: 1.5 }}>{subtitulo}</p>
      )}
      <div style={{ width: 40, height: 3, borderRadius: 99, background: '#00A896', marginTop: 10 }} />
    </header>
  )
}
