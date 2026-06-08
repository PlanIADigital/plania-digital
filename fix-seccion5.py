with open('app/mi-grupo/page.tsx', 'r') as f:
    content = f.read()

seccion5 = '''
          <div style={s.section}>
            <p style={s.sectionTitle}>5 · Recomendaciones del directivo</p>
            <p style={{ fontSize: 13, color: '#666', marginTop: 0, marginBottom: 16, lineHeight: 1.6 }}>
              Si tu directora te compartió observaciones o áreas de mejora, súbelas aquí. MÍA las integrará como contexto en tus planeaciones.
            </p>
            {!observacionesGuardadas ? (
              <div>
                <div style={{ background: '#F8F8FE', border: '2px dashed #C4C2E8', borderRadius: 12, padding: '24px 20px', textAlign: 'center', marginBottom: 16 }}>
                  <div style={{ fontSize: 32, marginBottom: 10 }}>🏫</div>
                  <p style={{ fontSize: 14, fontWeight: 600, color: '#3D3A8C', margin: '0 0 6px' }}>Sube el documento de tu directora</p>
                  <p style={{ fontSize: 12, color: '#888', margin: '0 0 16px', lineHeight: 1.6 }}>Acepta Word (.docx) o PDF con observaciones áulicas o recomendaciones institucionales.</p>
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#3D3A8C', color: 'white', padding: '10px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                    📁 Seleccionar archivo
                    <input type="file" accept=".pdf,.doc,.docx" onChange={handleArchivoObservaciones} style={{ display: 'none' }} />
                  </label>
                  <p style={{ fontSize: 11, color: '#aaa', marginTop: 10, marginBottom: 0 }}>Esta sección es opcional</p>
                </div>
              </div>
            ) : (
              <div>
                {resultadoObservaciones && (
                  <div style={{ background: '#ECFDF5', border: '1px solid #6EE7B7', borderRadius: 10, padding: '14px 16px', marginBottom: 16 }}>
                    <p style={{ fontSize: 12, fontWeight: 700, color: '#065F46', margin: '0 0 6px', textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>✅ Observaciones del directivo integradas</p>
                    {resultadoObservaciones.areas_mejora?.length > 0 && (
                      <div style={{ marginTop: 8 }}>
                        <p style={{ fontSize: 12, fontWeight: 600, color: '#1A1A2E', margin: '0 0 6px' }}>Áreas de mejora:</p>
                        {resultadoObservaciones.areas_mejora.map((area: string, i: number) => (
                          <p key={i} style={{ fontSize: 12, color: '#444', margin: '0 0 3px', lineHeight: 1.5 }}>• {area}</p>
                        ))}
                      </div>
                    )}
                    {resultadoObservaciones.fortalezas?.length > 0 && (
                      <div style={{ marginTop: 8 }}>
                        <p style={{ fontSize: 12, fontWeight: 600, color: '#1A1A2E', margin: '0 0 6px' }}>Fortalezas reconocidas:</p>
                        {resultadoObservaciones.fortalezas.map((f: string, i: number) => (
                          <p key={i} style={{ fontSize: 12, color: '#444', margin: '0 0 3px', lineHeight: 1.5 }}>• {f}</p>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#3D3A8C', background: '#EEEDF8', padding: '8px 16px', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>
                  🔄 Actualizar documento
                  <input type="file" accept=".pdf,.doc,.docx" onChange={handleArchivoObservaciones} style={{ display: 'none' }} />
                </label>
              </div>
            )}
          </div>

'''

INSERT_BEFORE = "          {/* ── CAPA 3: PDAs del jardín (opcional) ── */"

if INSERT_BEFORE in content:
    content = content.replace(INSERT_BEFORE, seccion5 + INSERT_BEFORE)
    with open('app/mi-grupo/page.tsx', 'w') as f:
        f.write(content)
    print("OK - sección 5 agregada")
else:
    print("ERROR: punto de inserción no encontrado")
