with open('app/mi-grupo/page.tsx', 'r') as f:
    content = f.read()

# 1. Cambiar tipo del estado
content = content.replace(
    'const [evaluacionIndividual, setEvaluacionIndividual] = useState<string[]>([])',
    'const [evaluacionIndividual, setEvaluacionIndividual] = useState<any>([])'
)

# 2. Corregir actualizarAlumno
content = content.replace(
    'setEvaluacionIndividual(prev => { const nuevo = [...prev]; nuevo[idx] = valor; return nuevo })',
    'setEvaluacionIndividual((prev: any[]) => { const nuevo = [...prev]; nuevo[idx] = valor; return nuevo })'
)

# 3. Agregar handler nuevo antes de handleGuardarEvaluacion
old_handler = '  async function handleGuardarEvaluacion() {'
new_handler = '''  async function handleArchivoEvaluacionIndividual(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setGuardandoEval(true); setErrorEval(''); setGuardadoEval(false)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const resTexto = await fetch('/api/extraer-texto', { method: 'POST', body: formData })
      const dataTexto = await resTexto.json()
      if (dataTexto.error) { setErrorEval('Error al leer el archivo: ' + dataTexto.error); setGuardandoEval(false); return }
      const { data: { session } } = await supabase.auth.getSession()
      const resAnalisis = await fetch('/api/analizar-evaluacion-individual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          texto_evaluacion: dataTexto.texto,
          grado: profile.grado || '2°',
          total_alumnos: profile.total_students || profile.total_alumnos || 24,
          auth_uid: session?.user?.id
        })
      })
      const dataAnalisis = await resAnalisis.json()
      if (dataAnalisis.error) { setErrorEval('Error al analizar: ' + dataAnalisis.error); setGuardandoEval(false); return }
      setEvaluacionIndividual(dataAnalisis.resultado)
      setGuardadoEval(true)
    } catch {
      setErrorEval('Error de conexión. Intenta de nuevo.')
    }
    setGuardandoEval(false)
  }

  async function handleGuardarEvaluacion() {'''

if old_handler in content and 'handleArchivoEvaluacionIndividual' not in content:
    content = content.replace(old_handler, new_handler)

# 4. Reemplazar sección 3 (21 cajas por nuevo flujo)
old_seccion = '''          {/* ── CAPA 2: Evaluación individual ── */}
          <div style={s.section}>
            <p style={s.sectionTitle}>3 · Diagnóstico individual</p>
            <p style={{ fontSize: 13, color: '#666', marginTop: 0, marginBottom: 8, lineHeight: 1.6 }}>
              Anota las necesidades específicas de cada alumno. Esta información personaliza aún más tus planeaciones.
            </p>
            <p style={{ fontSize: 12, color: '#aaa', marginTop: 0, marginBottom: 20, lineHeight: 1.5 }}>
              🔒 Los alumnos se identifican solo por número, sin nombres reales (protección de datos).
            </p>
            <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 10, marginBottom: 20 }}>
              {evaluacionIndividual.map((obs, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <span style={{ minWidth: 28, height: 28, borderRadius: '50%', background: '#EEEDF8', color: '#3D3A8C', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 8 }}>
                    {idx + 1}
                  </span>
                  <textarea
                    value={obs}
                    onChange={e => actualizarAlumno(idx, e.target.value)}
                    rows={2}
                    placeholder={`Alumno ${idx + 1} — observaciones específicas...`}
                    style={{ flex: 1, padding: '8px 12px', fontSize: 13, borderRadius: 8, border: '1px solid #D8D6F0', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'sans-serif', lineHeight: 1.5 } as React.CSSProperties}
                  />
                </div>
              ))}
            </div>
            {errorEval && <p style={{ color: '#DC2626', fontSize: 13, marginBottom: 12, background: '#FEF2F2', padding: '8px 12px', borderRadius: 6 }}>{errorEval}</p>}
            <button onClick={handleGuardarEvaluacion} disabled={guardandoEval}
              style={{ background: guardandoEval ? '#F0EFF8' : '#3D3A8C', color: guardandoEval ? '#3D3A8C' : 'white', border: 'none', padding: '12px 24px', fontSize: 14, cursor: guardandoEval ? 'default' : 'pointer', width: '100%', borderRadius: 8, fontWeight: 600 }}>
              {guardandoEval ? 'Guardando...' : '💾 Guardar evaluación individual'}
            </button>
            {guardadoEval && <p style={{ fontSize: 13, color: '#065f46', background: '#d1fae5', padding: '8px 12px', borderRadius: 6, marginTop: 12, marginBottom: 0 }}>✅ Evaluación individual guardada correctamente.</p>}
          </div>'''

new_seccion = '''          {/* ── CAPA 2: Evaluación individual — nuevo flujo ── */}
          <div style={s.section}>
            <p style={s.sectionTitle}>3 · Diagnóstico individual</p>
            <p style={{ fontSize: 13, color: '#666', marginTop: 0, marginBottom: 16, lineHeight: 1.6 }}>
              Sube tu evaluación individual (Word o PDF). MÍA extrae las observaciones pedagógicas, protege los nombres y detecta NEE automáticamente.
            </p>
            {!evaluacionIndividual || (Array.isArray(evaluacionIndividual) && evaluacionIndividual.every((x: any) => !x)) || (typeof evaluacionIndividual === 'object' && !Array.isArray(evaluacionIndividual) && !(evaluacionIndividual as any).resumen_general) ? (
              <div>
                <div style={{ background: '#F8F8FE', border: '2px dashed #C4C2E8', borderRadius: 12, padding: '28px 20px', textAlign: 'center', marginBottom: 16 }}>
                  <div style={{ fontSize: 36, marginBottom: 12 }}>📋</div>
                  <p style={{ fontSize: 14, fontWeight: 600, color: '#3D3A8C', margin: '0 0 6px' }}>Sube tu evaluación individual</p>
                  <p style={{ fontSize: 12, color: '#888', margin: '0 0 20px', lineHeight: 1.6 }}>Acepta Word (.docx) o PDF. Puede ser una tabla con todos tus alumnos o archivos por alumno.</p>
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: guardandoEval ? '#F0EFF8' : '#3D3A8C', color: guardandoEval ? '#3D3A8C' : 'white', padding: '11px 24px', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                    {guardandoEval ? '✦ MÍA está analizando...' : '📁 Seleccionar archivo'}
                    <input type="file" accept=".docx,.pdf" style={{ display: 'none' }} disabled={guardandoEval} onChange={handleArchivoEvaluacionIndividual} />
                  </label>
                  <p style={{ fontSize: 11, color: '#aaa', marginTop: 12, marginBottom: 0 }}>🔒 Los nombres reales nunca se almacenan</p>
                </div>
                {errorEval && <p style={{ color: '#DC2626', fontSize: 13, background: '#FEF2F2', padding: '8px 12px', borderRadius: 6 }}>{errorEval}</p>}
              </div>
            ) : (
              <div>
                {typeof evaluacionIndividual === 'object' && !Array.isArray(evaluacionIndividual) && (evaluacionIndividual as any).resumen_general && (
                  <div style={{ background: '#ECFDF5', border: '1px solid #6EE7B7', borderRadius: 10, padding: '14px 16px', marginBottom: 16 }}>
                    <p style={{ fontSize: 12, fontWeight: 700, color: '#065F46', margin: '0 0 6px', textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>✅ Análisis completado</p>
                    <p style={{ fontSize: 13, color: '#1A1A2E', margin: '0 0 8px', lineHeight: 1.6 }}>{(evaluacionIndividual as any).resumen_general}</p>
                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' as const }}>
                      <span style={{ fontSize: 11, background: '#D1FAE5', color: '#065F46', padding: '2px 10px', borderRadius: 20, fontWeight: 600 }}>{(evaluacionIndividual as any).total_alumnos_detectados || 0} alumnos analizados</span>
                      {(evaluacionIndividual as any).alumnos_con_nee > 0 && (
                        <span style={{ fontSize: 11, background: '#FEF3C7', color: '#92400E', padding: '2px 10px', borderRadius: 20, fontWeight: 600 }}>⚠️ {(evaluacionIndividual as any).alumnos_con_nee} con NEE detectadas</span>
                      )}
                    </div>
                  </div>
                )}
                {typeof evaluacionIndividual === 'object' && !Array.isArray(evaluacionIndividual) && (evaluacionIndividual as any).alertas?.length > 0 && (
                  <div style={{ background: '#EEEDF8', borderRadius: 10, padding: '12px 14px', marginBottom: 16 }}>
                    <p style={{ fontSize: 11, fontWeight: 700, color: '#3D3A8C', margin: '0 0 8px', textTransform: 'uppercase' as const }}>✦ Observaciones de MÍA</p>
                    {(evaluacionIndividual as any).alertas.map((alerta: string, i: number) => (
                      <p key={i} style={{ fontSize: 12, color: '#3D3A8C', margin: '0 0 4px', lineHeight: 1.5 }}>• {alerta}</p>
                    ))}
                  </div>
                )}
                {typeof evaluacionIndividual === 'object' && !Array.isArray(evaluacionIndividual) && (evaluacionIndividual as any).alumnos?.filter((a: any) => a.nee?.length > 0).length > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <p style={{ fontSize: 12, fontWeight: 700, color: '#1A1A2E', margin: '0 0 8px' }}>Alumnos con necesidades específicas:</p>
                    {(evaluacionIndividual as any).alumnos.filter((a: any) => a.nee?.length > 0).map((alumno: any, i: number) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px', background: '#F8F8FE', borderRadius: 8, marginBottom: 6 }}>
                        <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#EEEDF8', color: '#3D3A8C', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{String(alumno.referencia || '').replace('Alumno ', '')}</div>
                        <div style={{ flex: 1 }}>
                          <p style={{ fontSize: 12, color: '#1A1A2E', margin: '0 0 3px' }}>{alumno.observaciones}</p>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' as const }}>{alumno.nee?.map((n: string, j: number) => (<span key={j} style={{ fontSize: 10, background: '#FEF3C7', color: '#92400E', padding: '1px 7px', borderRadius: 10, fontWeight: 600 }}>{n}</span>))}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#3D3A8C', background: '#EEEDF8', padding: '8px 16px', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>
                  🔄 Actualizar evaluación
                  <input type="file" accept=".docx,.pdf" style={{ display: 'none' }} onChange={handleArchivoEvaluacionIndividual} />
                </label>
              </div>
            )}
          </div>'''

if old_seccion in content:
    content = content.replace(old_seccion, new_seccion)
    print("Sección 3 reemplazada OK")
else:
    print("AVISO: sección 3 no encontrada — puede que ya esté actualizada")

with open('app/mi-grupo/page.tsx', 'w') as f:
    f.write(content)
print("Archivo guardado OK")
