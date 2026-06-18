'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import SidebarWrapper from '@/components/SidebarWrapper'
import { supabase } from '@/lib/supabase'

const MENSAJES_ANALISIS = [
  '🔍 Leyendo las necesidades de tu grupo...',
  '📚 Revisando los 371 PDAs del Programa NEM 2022...',
  '🧩 Identificando áreas de oportunidad clave...',
  '✨ Seleccionando los PDAs más relevantes para tus alumnos...',
  '📋 Preparando tus resultados...',
]

function PantallaAnimacion({ grado, totalAlumnos, cct }: { grado: string; totalAlumnos: number; cct: string }) {
  const [mensajeIdx, setMensajeIdx] = useState(0)
  const [puntos, setPuntos] = useState('')
  useEffect(() => {
    const intervaloMensaje = setInterval(() => {
      setMensajeIdx(prev => (prev + 1) % MENSAJES_ANALISIS.length)
    }, 2200)
    const intervaloPuntos = setInterval(() => {
      setPuntos(prev => prev.length >= 3 ? '' : prev + '.')
    }, 500)
    return (
    <SidebarWrapper profile={profile}>
      {analizando ? (
        <PantallaAnimacion grado={profile.grado || '2°'} totalAlumnos={totalAlumnos} cct={profile.cct_primary || ''} />
      ) : (
        <div style={s.page}>

          {/* ENCABEZADO */}
          <div style={{ background: 'linear-gradient(135deg, #3D3A8C 0%, #5B58B0 100%)', borderRadius: 14, padding: '24px 32px', marginBottom: 20, textAlign: 'center' }}>
            <h2 style={{ color: 'white', margin: '0 0 6px', fontSize: 24, fontWeight: 800, letterSpacing: '0.05em' }}>MI GRUPO</h2>
            <p style={{ color: 'rgba(255,255,255,0.75)', margin: '0 0 16px', fontSize: 13 }}>
              {profile.school_name && <><strong style={{ color: 'rgba(255,255,255,0.9)' }}>JN:</strong> {nombreCorto(profile.school_name)} · </>}
              <strong style={{ color: 'rgba(255,255,255,0.9)' }}>CCT:</strong> {profile.cct_primary} · <strong style={{ color: 'rgba(255,255,255,0.9)' }}>Turno:</strong> {profile.shift_primary ? profile.shift_primary.charAt(0).toUpperCase() + profile.shift_primary.slice(1) : ''} · <strong style={{ color: 'rgba(255,255,255,0.9)' }}>Grupo:</strong> {profile.grado || '2°'} A
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#F4F3FB', borderRadius: 8, padding: '10px 14px', justifyContent: 'center' }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: '#1A1A2E', flexShrink: 0 }}>Cantidad de alumnos:</label>
              <input type="number" min="1" max="50" placeholder="Ej: 24"
                value={profile.total_alumnos || ''}
                onChange={async (e) => {
                  const val = parseInt(e.target.value)
                  if (!val || val < 1) return
                  setProfile((prev: any) => ({ ...prev, total_alumnos: val }))
                  const { data: { session } } = await supabase.auth.getSession()
                  if (session) {
                    await supabase.from('users').update({ total_alumnos: val }).eq('auth_uid', session.user.id)
                    setAlumnosGuardado(true)
                    setTimeout(() => setAlumnosGuardado(false), 2000)
                  }
                }}
                style={{ width: 72, padding: '6px 10px', fontSize: 14, borderRadius: 8, border: profile.total_alumnos ? '1.5px solid #00A896' : '1.5px solid #D8D6F0', textAlign: 'center', outline: 'none' }}
              />
              {alumnosGuardado && <span style={{ fontSize: 11, color: '#00A896', fontWeight: 600 }}>✓ Guardado</span>}
            </div>
          </div>

          {/* GRID 2 COLUMNAS */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, alignItems: 'stretch' }}>

            {/* COLUMNA IZQUIERDA: 1.1 PMC + 1.2 PA + 3.1 + 3.2 */}
            <div style={{ background: 'white', border: '1px solid #E0DFF5', borderRadius: 12, padding: 24, boxSizing: 'border-box' as const }}>

              {/* 1 · Diagnóstico Escolar */}
              <div style={{ marginBottom: 28, paddingBottom: 28, borderBottom: '1px solid #F0EFF8' }}>
                <p style={s.cardTitle}>1 · Diagnóstico Escolar</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div>
                    <p style={s.subTitle}>1.1 · PMC</p>
                    <p style={s.desc}>Contexto institucional del jardín: Entorno, organización y recursos.</p>
                    {!diagnosticoEscolarGuardado ? (
                      <div>
                        <label style={{ ...s.btn, opacity: analizandoEscolar ? 0.6 : 1 }}>
                          {analizandoEscolar ? '🔍 Analizando...' : '📁 Seleccionar'}
                          <input type="file" accept=".pdf,.doc,.docx,.pptx" onChange={handleArchivoPMC} style={{ display: 'none' }} disabled={analizandoEscolar} />
                        </label>
                        {archivoEscolarNombre && <p style={{ fontSize: 11, color: '#00A896', margin: '6px 0 0' }}>✓ {archivoEscolarNombre}</p>}
                        {diagnosticoEscolarTexto && !analizandoEscolar && (
                          <button onClick={handleAnalizarPMC} style={{ display: 'block', marginTop: 8, background: '#3D3A8C', color: 'white', border: 'none', padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', width: '100%' }}>
                            ✨ Analizar PMC
                          </button>
                        )}
                        {errorEscolar && <div style={s.err}>{errorEscolar}</div>}
                      </div>
                    ) : (
                      <div style={s.ok}>
                        <p style={s.okText}>✅ PMC guardado</p>
                        {resultadoEscolar?.contexto_social && <p style={{ fontSize: 11, color: '#444', margin: '4px 0 0', lineHeight: 1.4 }}>{resultadoEscolar.contexto_social}</p>}
                        <button onClick={() => { setDiagnosticoEscolarGuardado(false); setResultadoEscolar(null); setDiagnosticoEscolarTexto(''); setArchivoEscolarNombre('') }}
                          style={{ background: 'none', border: 'none', color: '#888', fontSize: 11, cursor: 'pointer', padding: '4px 0 0', display: 'block' }}>Actualizar</button>
                      </div>
                    )}
                  </div>
                  <div>
                    <p style={s.subTitle}>1.2 · Programa Analítico</p>
                    <p style={s.desc}>PDAs y contenidos priorizados por tu colectivo. Acepta .docx, .pptx, .pdf.</p>
                    {!paActivo ? (
                      <div>
                        <label style={{ ...s.btn, opacity: analizandoPA ? 0.6 : 1, cursor: analizandoPA ? 'default' : 'pointer' }}>
                          {analizandoPA ? '🔍 Analizando...' : '📁 Seleccionar'}
                          <input type="file" accept=".pdf,.doc,.docx,.pptx" onChange={handleArchivoPA} style={{ display: 'none' }} disabled={analizandoPA} />
                        </label>
                        {analizandoPA && <p style={{ fontSize: 11, color: '#3D3A8C', margin: '6px 0 0' }}>MÍA está leyendo el PA...</p>}
                        {errorPA && <div style={s.err}>{errorPA}</div>}
                      </div>
                    ) : (
                      <div>
                        <div style={{ ...s.ok, borderRadius: historialVisible ? '8px 8px 0 0' : 8 }}>
                          <p style={s.okText}>✅ PA cargado · <span style={{ fontWeight: 400 }}>v{paActivo.version_numero}</span></p>
                          <p style={{ fontSize: 11, color: '#555', margin: '2px 0 0' }}>{formatearFecha(paActivo.fecha_carga)}</p>
                          {paActivo.pda_ponderacion?.resumen_pa && (
                            <p style={{ fontSize: 11, color: '#444', margin: '4px 0 0', lineHeight: 1.4 }}>{paActivo.pda_ponderacion.resumen_pa}</p>
                          )}
                          {paActivo.nota_directivo && (
                            <p style={{ fontSize: 11, color: '#185FA5', margin: '4px 0 0' }}>💬 {paActivo.nota_directivo}</p>
                          )}
                          {paActivo.pda_ponderacion?.inconsistencias?.length > 0 && (
                            <div style={{ marginTop: 6, background: '#FFFBEB', border: '1px solid #FCD34D', borderRadius: 6, padding: '6px 8px' }}>
                              <p style={{ margin: 0, fontSize: 11, color: '#92400E', fontWeight: 700 }}>⚠ {paActivo.pda_ponderacion.inconsistencias.length} observación{paActivo.pda_ponderacion.inconsistencias.length > 1 ? 'es' : ''} de MÍA</p>
                            </div>
                          )}
                          <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                            <button onClick={toggleHistorial} style={{ background: 'none', border: 'none', color: '#0F6E56', fontSize: 11, fontWeight: 600, cursor: 'pointer', padding: 0 }}>
                              {historialVisible ? '▴ Ocultar' : '▾ Historial'}
                            </button>
                            <label style={{ color: '#0F6E56', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                              ↑ Actualizar
                              <input type="file" accept=".pdf,.doc,.docx,.pptx" onChange={handleArchivoPA} style={{ display: 'none' }} disabled={analizandoPA} />
                            </label>
                          </div>
                        </div>
                        {historialVisible && (
                          <div style={{ background: 'white', border: '1.5px solid #00A896', borderTop: 'none', borderRadius: '0 0 8px 8px', padding: '8px 12px' }}>
                            {cargandoHistorial ? <p style={{ fontSize: 11, color: '#888', margin: 0 }}>Cargando...</p> : historialPA.map((v: any, i: number) => (
                              <div key={v.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', paddingBottom: i < historialPA.length - 1 ? 6 : 0, marginBottom: i < historialPA.length - 1 ? 6 : 0, borderBottom: i < historialPA.length - 1 ? '1px solid #F0FDF9' : 'none' }}>
                                <div style={{ width: 7, height: 7, borderRadius: '50%', background: v.activo ? '#1D9E75' : '#D1D5DB', marginTop: 4, flexShrink: 0 }} />
                                <div>
                                  <span style={{ fontSize: 12, fontWeight: 600, color: '#1A1A2E' }}>v{v.version_numero}</span>
                                  {v.activo && <span style={{ marginLeft: 6, fontSize: 10, background: '#D1FAE5', color: '#065F46', padding: '1px 6px', borderRadius: 10, fontWeight: 600 }}>activa</span>}
                                  <p style={{ margin: '1px 0 0', fontSize: 11, color: '#888' }}>{formatearFecha(v.fecha_carga)}</p>
                                  {v.nota_directivo && <p style={{ margin: '3px 0 0', fontSize: 11, color: '#185FA5' }}>💬 {v.nota_directivo}</p>}
                                </div>
                              </div>
                            ))}
                            {paActivo && (() => {
                              const dias = Math.floor((Date.now() - new Date(paActivo.fecha_carga).getTime()) / (1000 * 60 * 60 * 24))
                              if (dias < 30) return null
                              return (
                                <div style={{ marginTop: 8, background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 6, padding: '8px 10px', display: 'flex', gap: 6 }}>
                                  <span style={{ flexShrink: 0 }}>🔔</span>
                                  <p style={{ margin: 0, fontSize: 11, color: '#1E40AF', lineHeight: 1.5 }}>
                                    <strong>MÍA:</strong> Han pasado {dias} días. Si hubo ajustes en tu último CTE, actualiza el PA.
                                  </p>
                                </div>
                              )
                            })()}
                          </div>
                        )}
                        {errorPA && <div style={s.err}>{errorPA}</div>}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* 3 · Recomendaciones Directivas */}
              <div>
                <p style={s.cardTitle}>3 · Recomendaciones Directivas</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div>
                    <p style={s.subTitle}>3.1 · Áreas de Oportunidad</p>
                    <p style={s.desc}>Observaciones de tu última visita áulica. MÍA las integrará en tus planeaciones.</p>
                    {!observacionesGuardadas ? (
                      <div>
                        <textarea value={observacionesTexto} onChange={e => setObservacionesTexto(e.target.value)} rows={3}
                          placeholder="Ej: La directora me indicó trabajar más la expresión oral..."
                          style={{ display: 'block', width: '100%', padding: '8px 10px', fontSize: 12, borderRadius: 8, border: '1px solid #D8D6F0', boxSizing: 'border-box' as const, resize: 'vertical' as const, fontFamily: 'sans-serif', lineHeight: 1.5, marginBottom: 8, textAlign: 'left' as const }} />
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' as const, justifyContent: 'center' }}>
                          <button onClick={handleAnalizarObservaciones} disabled={analizandoObservaciones || !observacionesTexto.trim()}
                            style={{ background: analizandoObservaciones || !observacionesTexto.trim() ? '#C4C2E8' : '#3D3A8C', color: 'white', border: 'none', padding: '7px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                            {analizandoObservaciones ? '🔍...' : '✨ Guardar'}
                          </button>
                          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'white', border: '1.5px solid #3D3A8C', color: '#3D3A8C', padding: '7px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                            📎 Archivo
                            <input type="file" accept=".pdf,.doc,.docx" onChange={handleArchivoObservaciones} style={{ display: 'none' }} />
                          </label>
                        </div>
                        {archivoObservacionesNombre && <p style={{ fontSize: 11, color: '#00A896', margin: '5px 0 0' }}>✓ {archivoObservacionesNombre}</p>}
                        {errorObservaciones && <div style={s.err}>{errorObservaciones}</div>}
                        <p style={{ fontSize: 10, color: '#aaa', marginTop: 6 }}>Opcional</p>
                      </div>
                    ) : (
                      <div style={s.ok}>
                        <p style={s.okText}>✅ Observaciones integradas</p>
                        {resultadoObservaciones?.areas_mejora?.slice(0, 2).map((area: string, i: number) => (
                          <p key={i} style={{ fontSize: 11, color: '#444', margin: '3px 0 0', lineHeight: 1.4 }}>• {area}</p>
                        ))}
                        <button onClick={() => { setObservacionesGuardadas(false); setResultadoObservaciones(null); setObservacionesTexto('') }}
                          style={{ background: 'none', border: 'none', color: '#888', fontSize: 11, cursor: 'pointer', padding: '4px 0 0', display: 'block' }}>Actualizar</button>
                      </div>
                    )}
                  </div>
                  <div>
                    <p style={s.subTitle}>3.2 · PDAs del jardín <span style={{ fontSize: 10, background: '#F8F8FE', color: '#888', border: '1px solid #D8D6F0', padding: '1px 6px', borderRadius: 10, fontWeight: 600, marginLeft: 4 }}>Opcional</span></p>
                    <p style={s.desc}>PDAs acordados por el colectivo este ciclo. El sistema los integrará con tu diagnóstico.</p>
                    {!guardadoJardin ? (
                      <div>
                        <label style={{ ...s.btn, opacity: guardandoJardin ? 0.6 : 1 }}>
                          {guardandoJardin ? '⏳ Guardando...' : '📁 Seleccionar'}
                          <input type="file" accept=".pdf,.doc,.docx" onChange={handleArchivoJardin} style={{ display: 'none' }} disabled={guardandoJardin} />
                        </label>
                        {archivoJardinNombre && <p style={{ fontSize: 11, color: '#00A896', margin: '6px 0 0' }}>✓ {archivoJardinNombre}</p>}
                        {errorJardin && <div style={s.err}>{errorJardin}</div>}
                      </div>
                    ) : (
                      <div style={s.ok}>
                        <p style={s.okText}>✅ PDAs del jardín guardados</p>
                        <label style={{ background: 'none', border: 'none', color: '#888', fontSize: 11, cursor: 'pointer', padding: '4px 0 0', display: 'block' }}>
                          Actualizar
                          <input type="file" accept=".pdf,.doc,.docx" onChange={handleArchivoJardin} style={{ display: 'none' }} />
                        </label>
                      </div>
                    )}
                  </div>
                </div>
              </div>

            </div>

            {/* COLUMNA DERECHA: 2.1 + 2.2 + 4 */}
            <div style={{ background: 'white', border: '1px solid #E0DFF5', borderRadius: 12, padding: 24, boxSizing: 'border-box' as const }}>

              {/* 2 · Diagnóstico Pedagógico */}
              <div style={{ marginBottom: 28, paddingBottom: 28, borderBottom: '1px solid #F0EFF8' }}>
                <p style={s.cardTitle}>2 · Diagnóstico Pedagógico</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div>
                    <p style={s.subTitle}>2.1 · Grupal</p>
                    <p style={s.desc}>Necesidades y áreas de oportunidad de tu grupo.</p>
                    {!guardado ? (
                      <div>
                        <label style={{ ...s.btnGreen, opacity: analizando ? 0.6 : 1 }}>
                          {analizando ? '🔍 Analizando...' : '📁 Seleccionar'}
                          <input type="file" accept=".pdf,.doc,.docx" onChange={handleArchivo} style={{ display: 'none' }} disabled={analizando} />
                        </label>
                        {archivoNombre && <p style={{ fontSize: 11, color: '#00A896', margin: '6px 0 0' }}>✓ {archivoNombre}</p>}
                        {diagnosticoTexto && !analizando && (
                          <button onClick={handleAnalizar} style={{ display: 'block', marginTop: 8, background: '#3D3A8C', color: 'white', border: 'none', padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', width: '100%' }}>
                            ✨ Analizar
                          </button>
                        )}
                        {errorDiagnostico && <div style={s.err}>{errorDiagnostico}</div>}
                      </div>
                    ) : (
                      <div style={s.ok}>
                        <p style={s.okText}>✅ Diagnóstico guardado</p>
                        <p style={{ fontSize: 11, color: '#444', margin: '3px 0 0' }}>{pdas.length} PDAs prioritarios identificados</p>
                        <button onClick={() => { setGuardado(false); setDiagnosticoTexto(''); setPdas([]); setArchivoNombre('') }}
                          style={{ background: 'none', border: 'none', color: '#888', fontSize: 11, cursor: 'pointer', padding: '4px 0 0', display: 'block' }}>Actualizar</button>
                      </div>
                    )}
                  </div>
                  <div>
                    <p style={s.subTitle}>2.2 · Individual</p>
                    <p style={s.desc}>Evaluación por alumno. MÍA protege nombres y detecta NEE.</p>
                    {!evalCompleta ? (
                      <div>
                        <label style={{ ...s.btn, opacity: guardandoEval ? 0.6 : 1 }}>
                          {guardandoEval ? '✦ Analizando...' : '📁 Seleccionar'}
                          <input type="file" accept=".docx,.pdf" style={{ display: 'none' }} disabled={guardandoEval} onChange={handleArchivoEvaluacionIndividual} />
                        </label>
                        <p style={{ fontSize: 10, color: '#aaa', margin: '5px 0 0' }}>🔒 Nombres nunca almacenados</p>
                        {errorEval && <div style={s.err}>{errorEval}</div>}
                      </div>
                    ) : (
                      <div style={s.ok}>
                        <p style={s.okText}>✅ Evaluación completa</p>
                        <p style={{ fontSize: 11, color: '#444', margin: '3px 0 0' }}>{(evaluacionIndividual as any).total_alumnos_detectados || 0} alumnos · {(evaluacionIndividual as any).alumnos_con_nee > 0 ? `⚠ ${(evaluacionIndividual as any).alumnos_con_nee} con NEE` : 'sin NEE detectadas'}</p>
                        <label style={{ background: 'none', border: 'none', color: '#888', fontSize: 11, cursor: 'pointer', padding: '4px 0 0', display: 'block' }}>
                          Actualizar
                          <input type="file" accept=".docx,.pdf" style={{ display: 'none' }} onChange={handleArchivoEvaluacionIndividual} />
                        </label>
                      </div>
                    )}
                  </div>
                </div>

                {pdas.length > 0 && (() => {
                  const grupos: Record<string, { campo: string; contenido: string; items: any[] }> = {}
                  pdas.forEach((p) => {
                    const key = `${p.campo}||${p.contenido}`
                    if (!grupos[key]) grupos[key] = { campo: p.campo, contenido: p.contenido, items: [] }
                    grupos[key].items.push(p)
                  })
                  return (
                    <div style={{ marginTop: 16, borderTop: '1px solid #EEEDF8', paddingTop: 14 }}>
                      <p style={{ fontSize: 11, fontWeight: 700, color: '#3D3A8C', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 10px' }}>PDAs priorizados para tu grupo</p>
                      {Object.values(grupos).map((grupo, gi) => (
                        <div key={gi} style={{ border: '1px solid #E0F5F3', borderRadius: 8, padding: '10px 12px', marginBottom: 8 }}>
                          <div style={{ display: 'flex', gap: 6, marginBottom: 6, flexWrap: 'wrap' as const }}>
                            <span style={{ background: '#EEEDF8', color: '#3D3A8C', fontSize: 10, padding: '2px 8px', borderRadius: 20, fontWeight: 700 }}>{grupo.campo}</span>
                            <span style={{ background: '#F0FFF8', color: '#059669', fontSize: 10, padding: '2px 8px', borderRadius: 20, fontWeight: 600 }}>{grupo.items.length} PDA{grupo.items.length > 1 ? 's' : ''}</span>
                          </div>
                          <p style={{ margin: '0 0 6px', fontSize: 12, fontWeight: 600, color: '#1A1A2E', lineHeight: 1.4 }}>{grupo.contenido}</p>
                          {grupo.items.map((p, pi) => (
                            <div key={pi} style={{ background: '#F8FFFE', border: '1px solid #C8EFE9', borderRadius: 6, padding: '8px 10px', marginBottom: 4 }}>
                              <p style={{ margin: '0 0 4px', fontSize: 12, color: '#1A1A2E', lineHeight: 1.5, fontStyle: 'italic' }}>{p.pda}</p>
                              <p style={{ margin: 0, fontSize: 11, color: '#666', lineHeight: 1.4 }}>{p.justificacion}</p>
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  )
                })()}
              </div>

              {/* 4 · Estilo narrativo */}
              <div>
                <p style={s.cardTitle}>4 · Mi estilo de narración</p>
                <p style={{ fontSize: 12, color: '#888', margin: '0 0 12px', lineHeight: 1.5, textAlign: 'center' }}>
                  Comparte cómo escribes: una carta a padres, unas notas, cualquier texto tuyo.<br/>MÍA aprenderá de ti para que tus planeaciones suenen a ti.
                </p>
                {!estiloGuardado ? (
                  <div>
                    <textarea value={estiloTexto} onChange={e => setEstiloTexto(e.target.value)} rows={4}
                      placeholder="Ej: Estimadas familias, quiero compartirles que esta semana trabajamos con los niños explorando..."
                      style={{ display: 'block', width: '100%', padding: '10px 12px', fontSize: 13, borderRadius: 8, border: '1px solid #D8D6F0', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'sans-serif', lineHeight: 1.6, marginBottom: 10 } as React.CSSProperties}
                    />
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' as const, justifyContent: 'center' }}>
                      <button onClick={handleAnalizarEstilo} disabled={analizandoEstilo || !estiloTexto.trim()}
                        style={{ background: analizandoEstilo || !estiloTexto.trim() ? '#C4C2E8' : '#3D3A8C', color: 'white', border: 'none', padding: '8px 16px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                        {analizandoEstilo ? '🔍 Analizando...' : '✨ Analizar estilo'}
                      </button>
                      <label style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'white', border: '1.5px solid #3D3A8C', color: '#3D3A8C', padding: '8px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                        📎 O sube un documento
                        <input type="file" accept=".pdf,.doc,.docx" onChange={handleArchivoEstilo} style={{ display: 'none' }} />
                      </label>
                    </div>
                    {archivoEstiloNombre && <p style={{ fontSize: 11, color: '#00A896', margin: '6px 0 0' }}>✓ {archivoEstiloNombre}</p>}
                    {errorEstilo && <div style={s.err}>{errorEstilo}</div>}
                  </div>
                ) : (
                  <div style={s.ok}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <p style={s.okText}>✅ Estilo de escritura guardado</p>
                      <button onClick={() => { setEstiloGuardado(false); setResultadoEstilo(null); setEstiloTexto('') }}
                        style={{ background: 'none', border: 'none', color: '#888', fontSize: 11, cursor: 'pointer', padding: 0 }}>Actualizar</button>
                    </div>
                    {resultadoEstilo?.tono && <p style={{ fontSize: 12, color: '#444', margin: '4px 0 0' }}><strong>Tono:</strong> {resultadoEstilo.tono}</p>}
                  </div>
                )}
              </div>

            </div>
          </div>

          <div style={{ height: 40 }} />
        </div>
      )}
    </SidebarWrapper>
  )
}
