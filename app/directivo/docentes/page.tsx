'use client'
// ============================================================
//  PlanIA Digital — app/directivo/docentes/page.tsx
//  [2 oct 2026] Mis docentes (antes solo redirigía al dashboard).
//  Lista de las docentes de los CCT del directivo (cualquier membresía,
//  también fundadoras) con el resumen del ciclo activo. Cada tarjeta
//  se toca completa para ver el detalle. El directivo SOLO VE.
//  Campos formativos: los 4 siempre visibles con colores oficiales
//  (lib/coloresCampos.ts); trabajados en color, pendientes en gris.
// ============================================================
import { useRouter } from 'next/navigation'
import SidebarWrapper from '@/components/SidebarWrapper'
import EncabezadoPagina from '@/components/EncabezadoPagina'
import { chipCampo } from '@/lib/coloresCampos'
import {
  useDocentesDirectivo, nombreJardin, CAMPOS_FORMATIVOS, ROL_DOCENTE, type DocenteResumen,
} from '@/lib/useDocentesDirectivo'

const C = {
  indigo: '#3D3A8C',
  indigoClaro: '#EEEDF8',
  cianClaro: '#E0F5F3',
  texto: '#1A1A2E',
  suave: '#6B7280',
  borde: '#E0DFF5',
}

const chip: React.CSSProperties = {
  fontSize: 12, padding: '4px 10px', borderRadius: 20, fontWeight: 600,
  background: C.indigoClaro, color: C.indigo, whiteSpace: 'nowrap',
}

// "3° B · 12 alumnos", o un aviso claro si aún no configura su grupo.
function textoGrupo(d: DocenteResumen): string {
  if (!d.grado) return 'Aún no configura su grupo'
  const grupo = `${d.grado}${d.grupo_letra ? ` ${d.grupo_letra}` : ''}`
  return d.total_alumnos ? `${grupo} · ${d.total_alumnos} alumnos` : grupo
}

function iniciales(nombre: string | null): string {
  return (nombre || '?').split(' ').filter(Boolean).slice(0, 2).map(n => n[0]).join('').toUpperCase()
}

export default function MisDocentesPage() {
  const router = useRouter()
  const { profile, docentes, ciclo, errorCarga, loading } = useDocentesDirectivo()

  if (loading || !profile) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
      <p style={{ color: C.indigo }}>Cargando...</p>
    </div>
  )

  const subtitulo = [nombreJardin(profile.school_name), ciclo && `Ciclo ${ciclo}`].filter(Boolean).join(' · ')

  return (
    <SidebarWrapper profile={profile}>
      <div style={{ padding: '0 16px 48px' }}>
        <EncabezadoPagina antetitulo="Acompañar" titulo="Mis docentes" subtitulo={subtitulo} />

        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          {errorCarga ? (
            <div style={{ background: 'white', border: `1px solid ${C.borde}`, borderRadius: 12, padding: '28px 20px', textAlign: 'center' }}>
              <p style={{ fontSize: 14, color: C.texto, margin: 0, lineHeight: 1.6 }}>{errorCarga}</p>
            </div>
          ) : docentes.length === 0 ? (
            <div style={{ background: 'white', border: `1px solid ${C.borde}`, borderRadius: 12, padding: '28px 20px', textAlign: 'center' }}>
              <p style={{ fontSize: 14, color: C.texto, margin: '0 0 6px' }}>
                Aún no hay docentes con el CCT {profile.cct_primary}.
              </p>
              <p style={{ fontSize: 13, color: C.suave, margin: 0, lineHeight: 1.5 }}>
                Cuando una educadora se registre con este CCT, aparecerá aquí.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {docentes.map(docente => {
                const r = docente.resumen
                const sinPlanes = r.planeaciones === 0
                return (
                  <button
                    key={docente.id}
                    onClick={() => router.push(`/directivo/docentes/${docente.id}`)}
                    aria-label={`Ver detalle de ${docente.full_name || 'la docente'}`}
                    style={{
                      width: '100%', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit',
                      background: 'white', border: `1px solid ${C.borde}`, borderRadius: 12,
                      padding: '14px 14px 14px 16px', display: 'block',
                    }}
                  >
                    {/* Nombre */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      {docente.avatar_url ? (
                        <img src={docente.avatar_url} alt="" style={{
                          width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', flexShrink: 0,
                          border: `2px solid ${C.indigoClaro}`,
                        }} />
                      ) : (
                      <div style={{
                        width: 40, height: 40, borderRadius: '50%', background: C.indigoClaro, flexShrink: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 14, fontWeight: 800, color: C.indigo,
                      }}>
                        {iniciales(docente.full_name)}
                      </div>
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ margin: 0, fontWeight: 700, color: C.texto, fontSize: 15, overflowWrap: 'anywhere' }}>
                          {docente.full_name}
                        </p>
                        <p style={{ margin: '2px 0 0', fontSize: 13, color: C.suave }}>
                          {ROL_DOCENTE[docente.role] || docente.role} · {textoGrupo(docente)}
                        </p>
                      </div>
                      <span style={{ color: C.indigo, fontSize: 22, fontWeight: 300, flexShrink: 0 }} aria-hidden="true">›</span>
                    </div>

                    {/* Datos */}
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 12 }}>
                      <span style={{ ...chip, ...(sinPlanes ? { background: '#F3F4F6', color: C.suave } : { background: C.cianClaro, color: '#0F6E56' }) }}>
                        {sinPlanes ? 'Sin planeaciones aún' : `${r.planeaciones} ${r.planeaciones === 1 ? 'planeación' : 'planeaciones'}`}
                      </span>
                      {!sinPlanes && <span style={chip}>{r.pdaDistintos} PDA</span>}
                      {r.prioritarios.hayDiagnostico && (
                        <span style={chip}>{r.prioritarios.atendidos}/{r.prioritarios.total} prioritarios</span>
                      )}
                      {r.alumnosConApoyos > 0 && <span style={chip}>{r.alumnosConApoyos} con apoyos</span>}
                    </div>

                    {/* Campos formativos: trabajados en color, pendientes en gris */}
                    {!sinPlanes && (
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                        {CAMPOS_FORMATIVOS.map(campo => {
                          const trabajado = r.campos.includes(campo.nombre)
                          const c = chipCampo(campo.nombre)
                          return (
                            <span
                              key={campo.nombre}
                              title={`${campo.nombre}${trabajado ? '' : ' (aún sin trabajar)'}`}
                              style={{
                                fontSize: 11.5, padding: '3px 9px', borderRadius: 10, fontWeight: 600, whiteSpace: 'nowrap',
                                ...(trabajado
                                  ? { background: c.bg, color: c.color }
                                  : { background: 'white', color: '#9CA3AF', border: '1px dashed #D1D5DB' }),
                              }}
                            >
                              {campo.corto}
                            </span>
                          )
                        })}
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </SidebarWrapper>
  )
}
