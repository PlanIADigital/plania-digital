with open('app/mi-grupo/page.tsx', 'r') as f:
    content = f.read()

SEPARADOR = "\n            <div style={{ height: 1, background: '#EEEDF8', margin: '28px 0' }} />\n\n"
MARKER_START = SEPARADOR + "            <p style={s.sectionTitle}>4 · Tu estilo de narración</p>"
MARKER_END = SEPARADOR + "            <p style={s.sectionTitle}>2 · Diagnóstico grupal</p>"

idx_start = content.find(MARKER_START)
idx_end = content.find(MARKER_END)

if idx_start == -1 or idx_end == -1:
    print(f"Sección 4 ya está movida o no se encontró. start={idx_start}, end={idx_end}")
else:
    bloque_seccion4 = content[idx_start:idx_end]
    nuevo = content[:idx_start] + SEPARADOR + "            <p style={s.sectionTitle}>2 · Diagnóstico grupal</p>" + content[idx_end + len(MARKER_END):]
    INSERT_AFTER = "          {/* ── CAPA 3: PDAs del jardín (opcional) ── */"
    bloque4_separado = "\n          <div style={s.section}>\n            <p style={s.sectionTitle}>4 · Tu estilo de narración</p>" + bloque_seccion4[len(MARKER_START):] + "          </div>\n\n          "
    idx_insert = nuevo.find(INSERT_AFTER)
    if idx_insert == -1:
        print("ERROR: punto de inserción no encontrado")
    else:
        nuevo = nuevo[:idx_insert] + bloque4_separado + INSERT_AFTER + nuevo[idx_insert + len(INSERT_AFTER):]
        with open('app/mi-grupo/page.tsx', 'w') as f:
            f.write(nuevo)
        print("OK - orden corregido: 1→2→3→4→6")
