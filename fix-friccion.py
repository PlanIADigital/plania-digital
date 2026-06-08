with open('app/mi-grupo/page.tsx', 'r') as f:
    content = f.read()

# Sección 1 — eliminar textarea
old1 = '''            {!diagnosticoEscolarGuardado ? (
              <div>
                <div style={{ marginBottom: 16 }}>
                  <label style={s.label}>Escribe o pega el contenido</label>
                  <textarea
                    value={diagnosticoEscolarTexto}
                    onChange={e => setDiagnosticoEscolarTexto(e.target.value)}
                    rows={5}
                    placeholder="Pega aquí el contenido de tu PMC o Programa Analítico..."
                    style={{ display: 'block', width: '100%', padding: '12px 14px', fontSize: 14, borderRadius: 8, border: '1px solid #D8D6F0', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'sans-serif', lineHeight: 1.6 } as React.CSSProperties}
                  />
                </div>
                <div style={{ background: '#F8F8FE', border: '1px dashed #C4C2E8', borderRadius: 10, padding: 16, marginBottom: 16 }}>
                  <label style={{ ...s.label, marginBottom: 4 }}>
                    O sube tu documento en Word o PDF
                    <span style={{ fontWeight: 400, color: '#888', fontSize: 13, marginLeft: 6 }}>(puedes subir hasta 2 archivos)</span>
                  </label>
                  <p style={{ fontSize: 12, color: '#888', margin: '0 0 12px', lineHeight: 1.5 }}>El sistema extraerá el texto automáticamente.</p>
                  <input type="file" accept=".pdf,.doc,.docx" onChange={handleArchivoEscolar} style={{ display: 'none' }} id="archivo-escolar" />
                  <label htmlFor="archivo-escolar" style={{ display: 'inline-block', background: 'white', border: '1.5px solid #3D3A8C', color: '#3D3A8C', padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                    📎 Seleccionar archivo
                  </label>
                  {archivoEscolarNombre && <span style={{ marginLeft: 12, fontSize: 13, color: '#00A896', fontWeight: 500 }}>✓ {archivoEscolarNombre}</span>}
                </div>
                {errorEscolar && (
                  <div style={{ background: '#fee2e2', color: '#991b1b', fontSize: 13, padding: '10px 14px', borderRadius: 8, marginBottom: 16 }}>
                    {errorEscolar}
                  </div>
                )}
                <button
                  onClick={handleAnalizarEscolar}
                  disabled={analizandoEscolar || !diagnosticoEscolarTexto.trim()}
                  style={{ background: analizandoEscolar || !diagnosticoEscolarTexto.trim() ? '#C4C2E8' : '#3D3A8C', color: 'white', border: 'none', padding: '12px 24px', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: analizandoEscolar || !diagnosticoEscolarTexto.trim() ? 'default' : 'pointer', width: '100%' }}>
                  {analizandoEscolar ? '🔍 Analizando documento...' : '✨ Analizar y guardar contexto escolar'}
                </button>
              </div>'''
new1 = '''            {!diagnosticoEscolarGuardado ? (
              <div>
                <div style={{ background: '#F8F8FE', border: '2px dashed #C4C2E8', borderRadius: 12, padding: '24px 20px', textAlign: 'center', marginBottom: 16 }}>
                  <div style={{ fontSize: 32, marginBottom: 10 }}>📄</div>
                  <p style={{ fontSize: 14, fontWeight: 600, color: '#3D3A8C', margin: '0 0 6px' }}>Sube tu PMC o Programa Analítico</p>
                  <p style={{ fontSize: 12, color: '#888', margin: '0 0 16px', lineHeight: 1.6 }}>Acepta Word (.docx) o PDF. Puedes subir hasta 2 archivos.</p>
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: analizandoEscolar ? '#C4C2E8' : '#3D3A8C', color: 'white', padding: '10px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                    {analizandoEscolar ? '🔍 Analizando...' : '📁 Seleccionar archivo'}
                    <input type="file" accept=".pdf,.doc,.docx" onChange={handleArchivoEscolar} style={{ display: 'none' }} disabled={analizandoEscolar} />
                  </label>
                  {archivoEscolarNombre && <p style={{ fontSize: 12, color: '#00A896', marginTop: 10, marginBottom: 0, fontWeight: 500 }}>✓ {archivoEscolarNombre}</p>}
                </div>
                {errorEscolar && <div style={{ background: '#fee2e2', color: '#991b1b', fontSize: 13, padding: '10px 14px', borderRadius: 8, marginBottom: 16 }}>{errorEscolar}</div>}
              </div>'''

# Sección 2 — eliminar textarea
old2 = '''            <div style={{ marginBottom: 20 }}>
              <label style={s.label}>Escribe o pega tu diagnóstico *</label>
              <textarea
                value={diagnosticoTexto}
                onChange={e => setDiagnosticoTexto(e.target.value)}
                rows={8}
                placeholder="Ej: El grupo presenta dificultades en la expresión oral, varios niños no logran sostener conversaciones breves..."
                style={{ display: 'block', width: '100%', padding: '12px 14px', fontSize: 14, borderRadius: 8, border: '1px solid #D8D6F0', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'sans-serif', lineHeight: 1.6 } as React.CSSProperties}
              />
            </div>

            <div style={{ background: '#F8F8FE', border: '1px dashed #C4C2E8', borderRadius: 10, padding: 16, marginBottom: 24 }}>
              <label style={{ ...s.label, marginBottom: 4 }}>
                O sube tu diagnóstico en Word o PDF
                <span style={{ fontWeight: 400, color: '#888', fontSize: 13, marginLeft: 6 }}>(opcional)</span>
              </label>
              <p style={{ fontSize: 12, color: '#888', margin: '0 0 12px', lineHeight: 1.5 }}>El sistema extraerá el texto automáticamente.</p>
              <input type="file" accept=".pdf,.doc,.docx" onChange={handleArchivo} style={{ display: 'none' }} id="archivo-diagnostico" />
              <label htmlFor="archivo-diagnostico" style={{ display: 'inline-block', background: 'white', border: '1.5px solid #3D3A8C', color: '#3D3A8C', padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                📎 Seleccionar archivo
              </label>
              {archivoNombre && <span style={{ marginLeft: 12, fontSize: 13, color: '#00A896', fontWeight: 500 }}>✓ {archivoNombre}</span>}
            </div>

            {errorDiagnostico && <p style={{ color: '#DC2626', fontSize: 13, marginBottom: 16, background: '#FEF2F2', padding: '8px 12px', borderRadius: 6 }}>{errorDiagnostico}</p>}

            <button onClick={handleAnalizar} disabled={analizando || !diagnosticoTexto.trim()}
              style={{ background: !diagnosticoTexto.trim() ? '#D0D0D0' : '#00A896', color: 'white', border: 'none', padding: '13px 24px', fontSize: 15, cursor: !diagnosticoTexto.trim() ? 'default' : 'pointer', width: '100%', borderRadius: 8, fontWeight: 600 }}>
              ✨ Analizar diagnóstico y sugerir PDAs
            </button>

            {guardado && <p style={{ fontSize: 13, color: '#065f46', background: '#d1fae5', padding: '8px 12px', borderRadius: 6, marginTop: 12, marginBottom: 0 }}>✅ Diagnóstico guardado. Los PDAs prioritarios ya están disponibles al crear tu próxima planeación.</p>}'''
new2 = '''            <div style={{ background: '#F8F8FE', border: '2px dashed #C4C2E8', borderRadius: 12, padding: '24px 20px', textAlign: 'center', marginBottom: 16 }}>
              <div style={{ fontSize: 32, marginBottom: 10 }}>📋</div>
              <p style={{ fontSize: 14, fontWeight: 600, color: '#3D3A8C', margin: '0 0 6px' }}>Sube tu diagnóstico de grupo</p>
              <p style={{ fontSize: 12, color: '#888', margin: '0 0 16px', lineHeight: 1.6 }}>Acepta Word (.docx) o PDF con las necesidades y áreas de oportunidad de tu grupo.</p>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: analizando ? '#C4C2E8' : '#00A896', color: 'white', padding: '10px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                {analizando ? '🔍 Analizando...' : '📁 Seleccionar archivo'}
                <input type="file" accept=".pdf,.doc,.docx" onChange={handleArchivo} style={{ display: 'none' }} disabled={analizando} />
              </label>
              {archivoNombre && <p style={{ fontSize: 12, color: '#00A896', marginTop: 10, marginBottom: 0, fontWeight: 500 }}>✓ {archivoNombre}</p>}
            </div>
            {errorDiagnostico && <p style={{ color: '#DC2626', fontSize: 13, marginBottom: 16, background: '#FEF2F2', padding: '8px 12px', borderRadius: 6 }}>{errorDiagnostico}</p>}
            {guardado && <p style={{ fontSize: 13, color: '#065f46', background: '#d1fae5', padding: '8px 12px', borderRadius: 6, marginBottom: 0 }}>✅ Diagnóstico guardado. Los PDAs prioritarios ya están disponibles al crear tu próxima planeación.</p>}'''

# Sección 6 — eliminar textarea
old6 = '''            <textarea
              value={pdasJardinTexto}
              onChange={e => setPdasJardinTexto(e.target.value)}
              rows={5}
              placeholder="Pega aquí los PDAs que tu directora indicó trabajar, o sube el archivo..."
              style={{ display: 'block', width: '100%', padding: '12px 14px', fontSize: 14, borderRadius: 8, border: '1px solid #D8D6F0', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'sans-serif', lineHeight: 1.6, marginBottom: 16 } as React.CSSProperties}
            />
            <div style={{ background: '#F8F8FE', border: '1px dashed #C4C2E8', borderRadius: 10, padding: 16, marginBottom: 16 }}>
              <p style={{ fontSize: 12, color: '#888', margin: '0 0 12px', lineHeight: 1.5 }}>O sube el documento que compartió tu directora (Word o PDF)</p>
              <input type="file" accept=".pdf,.doc,.docx" onChange={handleArchivoJardin} style={{ display: 'none' }} id="archivo-jardin" />
              <label htmlFor="archivo-jardin" style={{ display: 'inline-block', background: 'white', border: '1.5px solid #3D3A8C', color: '#3D3A8C', padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                📎 Seleccionar archivo
              </label>
              {archivoJardinNombre && <span style={{ marginLeft: 12, fontSize: 13, color: '#00A896', fontWeight: 500 }}>✓ {archivoJardinNombre}</span>}
            </div>
            {errorJardin && <p style={{ color: '#DC2626', fontSize: 13, marginBottom: 12, background: '#FEF2F2', padding: '8px 12px', borderRadius: 6 }}>{errorJardin}</p>}
            <button onClick={handleGuardarJardin} disabled={guardandoJardin || !pdasJardinTexto.trim()}
              style={{ background: !pdasJardinTexto.trim() ? '#D0D0D0' : guardandoJardin ? '#F0EFF8' : '#3D3A8C', color: !pdasJardinTexto.trim() || guardandoJardin ? '#888' : 'white', border: 'none', padding: '12px 24px', fontSize: 14, cursor: !pdasJardinTexto.trim() ? 'default' : 'pointer', width: '100%', borderRadius: 8, fontWeight: 600 }}>
              {guardandoJardin ? 'Guardando...' : '💾 Guardar PDAs del jardín'}
            </button>
            {guardadoJardin && <p style={{ fontSize: 13, color: '#065f46', background: '#d1fae5', padding: '8px 12px', borderRadius: 6, marginTop: 12, marginBottom: 0 }}>✅ PDAs del jardín guardados. Se integrarán en tus próximas planeaciones.</p>}'''
new6 = '''            <div style={{ background: '#F8F8FE', border: '2px dashed #C4C2E8', borderRadius: 12, padding: '24px 20px', textAlign: 'center', marginBottom: 16 }}>
              <div style={{ fontSize: 32, marginBottom: 10 }}>📌</div>
              <p style={{ fontSize: 14, fontWeight: 600, color: '#3D3A8C', margin: '0 0 6px' }}>Sube el documento de tu directora</p>
              <p style={{ fontSize: 12, color: '#888', margin: '0 0 16px', lineHeight: 1.6 }}>Acepta Word (.docx) o PDF con los PDAs acordados para este ciclo.</p>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: guardandoJardin ? '#C4C2E8' : '#3D3A8C', color: 'white', padding: '10px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                {guardandoJardin ? '⏳ Guardando...' : '📁 Seleccionar archivo'}
                <input type="file" accept=".pdf,.doc,.docx" onChange={handleArchivoJardin} style={{ display: 'none' }} disabled={guardandoJardin} />
              </label>
              {archivoJardinNombre && <p style={{ fontSize: 12, color: '#00A896', marginTop: 10, marginBottom: 0, fontWeight: 500 }}>✓ {archivoJardinNombre}</p>}
            </div>
            {errorJardin && <p style={{ color: '#DC2626', fontSize: 13, marginBottom: 12, background: '#FEF2F2', padding: '8px 12px', borderRadius: 6 }}>{errorJardin}</p>}
            {guardadoJardin && <p style={{ fontSize: 13, color: '#065f46', background: '#d1fae5', padding: '8px 12px', borderRadius: 6, marginBottom: 0 }}>✅ PDAs del jardín guardados. Se integrarán en tus próximas planeaciones.</p>}'''

for old, new, name in [(old1, new1, 'S1'), (old2, new2, 'S2'), (old6, new6, 'S6')]:
    if old in content:
        content = content.replace(old, new)
        print(f'✓ {name} OK')
    else:
        print(f'- {name} ya actualizada o no encontrada')

with open('app/mi-grupo/page.tsx', 'w') as f:
    f.write(content)
print('Archivo guardado')
