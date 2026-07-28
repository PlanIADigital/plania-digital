'use client'
import { useState, useEffect } from 'react'
import { fetchAdmin } from '@/lib/fetchAdmin'

const ESTADOS = [
  { codigo: '01', nombre: 'Aguascalientes' },
  { codigo: '02', nombre: 'Baja California' },
  { codigo: '03', nombre: 'Baja California Sur' },
  { codigo: '04', nombre: 'Campeche' },
  { codigo: '05', nombre: 'Coahuila' },
  { codigo: '06', nombre: 'Colima' },
  { codigo: '07', nombre: 'Chiapas' },
  { codigo: '08', nombre: 'Chihuahua' },
  { codigo: '09', nombre: 'Ciudad de México' },
  { codigo: '10', nombre: 'Durango' },
  { codigo: '11', nombre: 'Guanajuato' },
  { codigo: '12', nombre: 'Guerrero' },
  { codigo: '13', nombre: 'Hidalgo' },
  { codigo: '14', nombre: 'Jalisco' },
  { codigo: '15', nombre: 'Estado de México' },
  { codigo: '16', nombre: 'Michoacán' },
  { codigo: '17', nombre: 'Morelos' },
  { codigo: '18', nombre: 'Nayarit' },
  { codigo: '19', nombre: 'Nuevo León' },
  { codigo: '20', nombre: 'Oaxaca' },
  { codigo: '21', nombre: 'Puebla' },
  { codigo: '22', nombre: 'Querétaro' },
  { codigo: '23', nombre: 'Quintana Roo' },
  { codigo: '24', nombre: 'San Luis Potosí' },
  { codigo: '25', nombre: 'Sinaloa' },
  { codigo: '26', nombre: 'Sonora' },
  { codigo: '27', nombre: 'Tabasco' },
  { codigo: '28', nombre: 'Tamaulipas' },
  { codigo: '29', nombre: 'Tlaxcala' },
  { codigo: '30', nombre: 'Veracruz' },
  { codigo: '31', nombre: 'Yucatán' },
  { codigo: '32', nombre: 'Zacatecas' },
]

const CATEGORIAS = [
  ['inicio_clases', 'Primer día de clases'],
  ['fin_clases', 'Último día de clases'],
  ['suspension_labores_docentes', 'Día festivo / suspensión oficial'],
  ['vacaciones', 'Periodo vacacional (invierno, Semana Santa, verano)'],
  ['receso_clases', 'Receso que no es vacación formal'],
  ['cte_fase_intensiva', 'CTE Fase Intensiva'],
  ['cte_sesion_ordinaria', 'CTE Sesión Ordinaria (mensual)'],
  ['taller_intensivo_direccion', 'Taller intensivo, personal de dirección'],
  ['taller_intensivo_docente', 'Taller intensivo, personal docente'],
  ['jornada_concientizacion_abuso_maltrato_infantil', 'Jornada de concientización (abuso/maltrato infantil)'],
  ['registro_calificaciones', 'Registro de calificaciones'],
  ['registro_comunicacion_resultados_evaluacion', 'Registro y comunicación de resultados de evaluación'],
  ['preinscripcion_ciclo_siguiente', 'Preinscripción al ciclo siguiente'],
  ['periodo_inscripciones_reinscripciones', 'Periodo de inscripciones y reinscripciones del ciclo actual'],
  ['reforzamiento_aprendizaje', 'Reforzamiento de aprendizaje'],
  ['clases_a_distancia', 'Clases a distancia'],
  ['ceremonia_clausura', 'Ceremonia de clausura'],
  ['dia_conmemorativo', 'Día conmemorativo (no suspende labores)'],
  ['otro', 'Específico de un estado — siempre con "motivo", y avisa en "notas" si es candidata a categoría oficial'],
]

const PROMPT_ESTANDAR = `Eres un asistente experto en extraer datos estructurados de calendarios escolares oficiales de México.

PASO 1 — IDENTIFICACIÓN OBLIGATORIA (antes de generar cualquier dato)
Identifica el ESTADO y el CICLO ESCOLAR basándote ÚNICAMENTE en lo que el documento muestra visualmente: logo, escudo, nombre de la secretaría estatal, firma de la autoridad, o las fechas de inicio/fin de clases impresas en el propio documento.

NUNCA asumas el estado o el ciclo por el nombre del archivo, por el contexto de esta conversación, ni por comparación con otros calendarios que hayas visto antes (algunos estados usan un diseño casi idéntico al federal; eso no significa que sean el federal).

Si el documento no trae ningún elemento que identifique claramente el estado (sin logo, sin escudo, sin nombre de secretaría, sin firma), NO asumas que es el calendario federal ni ningún estado en particular — dilo explícitamente.

Antes de generar el JSON, responde primero SOLO con este mensaje breve (todavía sin generar el JSON):

"Detecté que este calendario corresponde a: [ESTADO detectado, o 'No pude confirmar el estado con certeza a partir del documento'] — ciclo escolar [XXXX-XXXX]. ¿Es correcto? Confírmame o corrígeme antes de generar el JSON."

Espera la confirmación de la persona. Solo después de recibirla, continúa con el PASO 2.

PASO 2 — EXTRACCIÓN
Analiza la imagen con mucho detalle, mes por mes, identificando el color/ícono exacto de cada día marcado según la leyenda que aparece en el propio documento (puede variar de un estado a otro; usa la leyenda que EL DOCUMENTO trae, no supongas colores de otros estados).

Para cada evento marcado, clasifícalo usando SIEMPRE una de estas categorías (usa exactamente estos valores en el campo "categoria"):

- inicio_clases
- fin_clases
- suspension_labores_docentes
- vacaciones
- receso_clases
- cte_fase_intensiva
- cte_sesion_ordinaria
- taller_intensivo_direccion
- taller_intensivo_docente
- jornada_concientizacion_abuso_maltrato_infantil
- registro_calificaciones
- registro_comunicacion_resultados_evaluacion
- preinscripcion_ciclo_siguiente
- periodo_inscripciones_reinscripciones
- reforzamiento_aprendizaje
- clases_a_distancia
- ceremonia_clausura
- dia_conmemorativo
- otro   <- SOLO si el evento no encaja en NINGUNA categoría anterior. Si usas "otro", SIEMPRE explica en "motivo" qué es, Y avísame explícitamente en "notas": "Encontré una categoría que no está en el catálogo oficial: [nombre/descripción tal como aparece en la leyenda del documento]. Considera agregarla como categoría oficial."

No inventes ni asumas fechas: si un día no tiene marca visible, no lo incluyas. Revisa cada mes celda por celda.

Devuélveme ÚNICAMENTE este JSON (sin texto antes ni después):

{
  "ciclo": "[ciclo detectado y confirmado, ej. 2026-2027]",
  "entidad": "[estado detectado y confirmado, o Federal]",
  "nivel_educativo": "Educación Básica (Preescolar, Primaria y Secundaria)",
  "dias_habiles_totales": 185,
  "inicio_clases": "YYYY-MM-DD",
  "fin_clases": "YYYY-MM-DD",
  "eventos": [
    { "fecha": "YYYY-MM-DD", "fecha_fin": "YYYY-MM-DD o null si es un solo día", "categoria": "valor_del_catalogo", "motivo": "detalle opcional, null si no aplica" }
  ],
  "notas": [ "cualquier ambigüedad, duda, categoría no catalogada, o color que no pudiste identificar con certeza" ]
}`

const CHECKLIST = [
  '¿Claude confirmó el estado y ciclo escolar ANTES de generar el JSON, y coincide con lo que tú esperabas?',
  '¿inicio_clases y fin_clases caen en día de semana (no domingo/sábado)?',
  '¿Las fechas cívicas cuadran con el calendario oficial? (Constitución = 1er lunes de feb, real 5 feb · Bandera = 24 feb · Juárez = 3er lunes de marzo, real 21 mar · Expropiación = 18 mar · Revolución = 3er lunes de nov, real 20 nov · Independencia = 16 sep)',
  '¿Aparece una CTE Fase Intensiva y varias Sesión Ordinaria (~1 por mes)?',
  '¿Hay eventos "otro" sin motivo explicado, o marcados como candidatos a categoría oficial? Revisa la sección "notas" antes de guardar.',
  '¿Vacaciones de invierno y Semana Santa tienen rangos razonables (2-3 semanas)?',
  '¿Ya leíste la sección "notas" completa que devolvió Claude?',
]

export default function CalendarioPage() {
  const [estadoSeleccionado, setEstadoSeleccionado] = useState('19')
  const [uploadingFederal, setUploadingFederal] = useState(false)
  const [uploadingEstatal, setUploadingEstatal] = useState(false)
  const [eliminandoFederal, setEliminandoFederal] = useState(false)
  const [eliminandoEstatal, setEliminandoEstatal] = useState(false)
  const [mensajeFederal, setMensajeFederal] = useState('')
  const [mensajeEstatal, setMensajeEstatal] = useState('')
  const [federalCargado, setFederalCargado] = useState(false)
  const [estatalCargado, setEstatalCargado] = useState(false)
  const [estatalEsFederal, setEstatalEsFederal] = useState(false)
  const [estadosConEstatal, setEstadosConEstatal] = useState<string[]>([])
  const [guiaAbierta, setGuiaAbierta] = useState(false)
  const [promptCopiado, setPromptCopiado] = useState(false)
  const [mostrarUsarFederal, setMostrarUsarFederal] = useState(false)
  const [notaFederal, setNotaFederal] = useState('')
  const [usandoFederal, setUsandoFederal] = useState(false)

  async function verificarEstado(estado: string) {
    try {
      const res = await fetchAdmin(`/api/admin/calendario-estado?estado=${estado}`)
      const data = await res.json()
      setFederalCargado(data.federal || false)
      setEstatalCargado(data.estatal || false)
      setEstadosConEstatal(data.estadosConEstatal || [])
      setEstatalEsFederal(data.estatalEsFederal || false)
    } catch {}
  }

  useEffect(() => {
    verificarEstado(estadoSeleccionado)
    setMensajeEstatal('')
    setMostrarUsarFederal(false)
    setNotaFederal('')
  }, [estadoSeleccionado])

  async function handleUpload(tipo: 'federal' | 'estatal', file: File) {
    if (tipo === 'federal') setUploadingFederal(true)
    else setUploadingEstatal(true)

    try {
      const text = await file.text()
      const json = JSON.parse(text)

      const res = await fetchAdmin('/api/admin/calendario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo,
          estado: tipo === 'federal' ? 'FED' : estadoSeleccionado,
          datos: json,
        }),
      })

      const data = await res.json()
      if (data.ok) {
        if (tipo === 'federal') { setMensajeFederal('✅ Calendario federal cargado correctamente'); setFederalCargado(true) }
        else { setMensajeEstatal('✅ Calendario estatal cargado correctamente'); setEstatalCargado(true) }
        verificarEstado(estadoSeleccionado)
      } else {
        if (tipo === 'federal') setMensajeFederal('❌ Error: ' + (data.error || 'inténtalo de nuevo'))
        else setMensajeEstatal('❌ Error: ' + (data.error || 'inténtalo de nuevo'))
      }
    } catch {
      if (tipo === 'federal') setMensajeFederal('❌ El archivo no es un JSON válido')
      else setMensajeEstatal('❌ El archivo no es un JSON válido')
    }

    if (tipo === 'federal') setUploadingFederal(false)
    else setUploadingEstatal(false)
  }

  async function handleEliminar(tipo: 'federal' | 'estatal') {
    const nombre = tipo === 'federal' ? 'FEDERAL (aplica a todos los estados)' : `de ${nombreEstado}`
    const confirmado = window.confirm(
      `¿Eliminar el calendario ${nombre}?\n\nEsta acción no se puede deshacer. Tendrás que volver a subir el JSON si te equivocas.`
    )
    if (!confirmado) return

    if (tipo === 'federal') setEliminandoFederal(true)
    else setEliminandoEstatal(true)

    try {
      const res = await fetchAdmin('/api/admin/calendario', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo,
          estado: tipo === 'federal' ? 'FED' : estadoSeleccionado,
          ciclo: '2025-2026',
        }),
      })
      const data = await res.json()
      if (data.ok) {
        if (tipo === 'federal') { setMensajeFederal('🗑️ Calendario federal eliminado'); setFederalCargado(false) }
        else { setMensajeEstatal('🗑️ Calendario eliminado'); setEstatalCargado(false); setEstatalEsFederal(false) }
        verificarEstado(estadoSeleccionado)
      } else {
        if (tipo === 'federal') setMensajeFederal('❌ Error al eliminar: ' + (data.error || 'inténtalo de nuevo'))
        else setMensajeEstatal('❌ Error al eliminar: ' + (data.error || 'inténtalo de nuevo'))
      }
    } catch {
      if (tipo === 'federal') setMensajeFederal('❌ Error al eliminar')
      else setMensajeEstatal('❌ Error al eliminar')
    }

    if (tipo === 'federal') setEliminandoFederal(false)
    else setEliminandoEstatal(false)
  }

  async function handleUsarFederal() {
    if (!federalCargado) return
    const confirmado = window.confirm(
      `¿Usar el calendario FEDERAL sin cambios como calendario estatal de ${nombreEstado}?\n\nEsto sobrescribirá cualquier calendario estatal existente para este estado.`
    )
    if (!confirmado) return

    setUsandoFederal(true)
    try {
      const res = await fetchAdmin('/api/admin/calendario/usar-federal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          estado: estadoSeleccionado,
          nombreEstado,
          nota: notaFederal,
        }),
      })
      const data = await res.json()
      if (data.ok) {
        setMensajeEstatal('✅ Calendario federal aplicado como estatal')
        setEstatalCargado(true)
        setMostrarUsarFederal(false)
        setNotaFederal('')
        verificarEstado(estadoSeleccionado)
      } else {
        setMensajeEstatal('❌ Error: ' + (data.error || 'inténtalo de nuevo'))
      }
    } catch {
      setMensajeEstatal('❌ Error al aplicar el calendario federal')
    }
    setUsandoFederal(false)
  }

  async function copiarPrompt() {
    try {
      await navigator.clipboard.writeText(PROMPT_ESTANDAR)
      setPromptCopiado(true)
      setTimeout(() => setPromptCopiado(false), 1800)
    } catch {}
  }

  const Badge = ({ cargado }: { cargado: boolean }) => (
    <span style={{
      fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20,
      background: cargado ? '#D1FAE5' : '#FEF3C7',
      color: cargado ? '#065F46' : '#92400E',
    }}>
      {cargado ? '✅ Cargado' : 'Pendiente'}
    </span>
  )

  const BotonEliminar = ({ onClick, eliminando }: { onClick: () => void; eliminando: boolean }) => (
    <button
      onClick={onClick}
      disabled={eliminando}
      title="Eliminar este calendario"
      style={{
        fontSize: 13, background: 'none', border: 'none', cursor: eliminando ? 'default' : 'pointer',
        padding: '3px 6px', borderRadius: 6, opacity: eliminando ? 0.4 : 1,
        color: '#DC2626',
      }}
      onMouseEnter={e => { if (!eliminando) e.currentTarget.style.background = '#FEE2E2' }}
      onMouseLeave={e => { e.currentTarget.style.background = 'none' }}
    >
      🗑️
    </button>
  )

  const nombreEstado = ESTADOS.find(e => e.codigo === estadoSeleccionado)?.nombre || ''

  return (
    <div>
      <h1 style={{ fontSize: 20, fontWeight: 700, color: '#111827', marginBottom: 4 }}>Calendario Federal y Calendarios Estatales</h1>
      <p style={{ fontSize: 13, color: '#6B7280', marginBottom: 24 }}>
        Gestión del calendario escolar oficial. Define días hábiles, festivos y sesiones CTE para el generador de planeaciones.
      </p>

      {(!federalCargado || !estatalCargado) && (
        <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 10, padding: '12px 16px', marginBottom: 24, display: 'flex', gap: 10 }}>
          <span style={{ color: '#D97706' }}>⚠️</span>
          <p style={{ fontSize: 13, color: '#92400E', margin: 0 }}>
            <strong>Ciclo 2025–2026 incompleto para {nombreEstado}.</strong> El generador no puede excluir festivos ni sesiones CTE hasta que ambos calendarios estén cargados.
          </p>
        </div>
      )}

      {federalCargado && estatalCargado && (
        <div style={{ background: '#ECFDF5', border: '1px solid #6EE7B7', borderRadius: 10, padding: '12px 16px', marginBottom: 24, display: 'flex', gap: 10 }}>
          <span>✅</span>
          <p style={{ fontSize: 13, color: '#065F46', margin: 0 }}>
            <strong>Ciclo 2025–2026 completo para {nombreEstado}.</strong> El generador puede calcular días hábiles correctamente.
            {estatalEsFederal && ' El calendario estatal usa el federal sin cambios.'}
          </p>
        </div>
      )}

      <div style={{ background: '#EEF2FF', border: '1px solid #C7D2FE', borderRadius: 12, padding: '16px 20px', marginBottom: 20 }}>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <span>💡</span>
              <h2 style={{ fontSize: 13, fontWeight: 600, color: '#3730A3', margin: 0 }}>Cómo convertir el calendario SEP a JSON</h2>
            </div>
            <ol style={{ margin: 0, paddingLeft: 16, fontSize: 12, color: '#4338CA', lineHeight: 1.8 }}>
              <li>Descarga el PDF oficial desde educacionbasica.sep.gob.mx (federal) o la página oficial del estado (estatal)</li>
              <li>Abre un chat nuevo en Claude.ai, sube la imagen/PDF y pega el "Prompt recomendado" de abajo</li>
              <li>Claude te va a confirmar primero de qué estado y ciclo escolar cree que es el documento — confírmalo o corrígelo antes de que genere el JSON</li>
              <li>Copia el JSON que Claude genere después de tu confirmación, guárdalo como archivo <code>.json</code> y súbelo aquí</li>
            </ol>
            <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 12 }}>
              <a href="https://educacionbasica.sep.gob.mx" target="_blank" style={{ fontSize: 12, color: '#3730A3', fontWeight: 600 }}>Ir a SEP →</a>
              <a href="https://claude.ai" target="_blank" style={{ fontSize: 12, color: '#3730A3', fontWeight: 600 }}>Abrir Claude.ai →</a>
            </div>
          </div>

          <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 10, padding: '14px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <span>⚠️</span>
              <h2 style={{ fontSize: 13, fontWeight: 600, color: '#92400E', margin: 0 }}>Antes de descargar: usa captura de pantalla</h2>
            </div>
            <p style={{ fontSize: 12, color: '#92400E', lineHeight: 1.7, margin: '0 0 8px 0' }}>
              Se detectó (Oaxaca, jul 2026) que la <strong>exportación a PDF</strong> de algunos estados puede borrar el color de relleno de algún mes (ej. receso de agosto y CTE Fase Intensiva), aunque la <strong>vista web sí lo muestra bien</strong>. El bug es silencioso — el archivo se ve "normal" a simple vista.
            </p>
            <p style={{ fontSize: 12, color: '#92400E', lineHeight: 1.7, margin: '0 0 8px 0' }}>
              <strong>Regla:</strong> no descargues el PDF/imagen exportable del sitio estatal. Toma una <strong>captura de pantalla de la vista web renderizada</strong> (con zoom alto del navegador para nitidez) y sube esa imagen a Claude en su lugar.
            </p>
            <p style={{ fontSize: 12, color: '#92400E', lineHeight: 1.7, margin: 0 }}>
              <strong>Verificación rápida:</strong> si un mes aparece sospechosamente en blanco (sin ningún color, cuando debería tener recesos/vacaciones), compáralo contra la vista web en vivo antes de confiar en el archivo. Tampoco confíes en el nombre que tú le pongas al archivo — algunos calendarios estatales no traen ningún logo ni escudo distintivo y son visualmente iguales al federal; dejar que Claude confirme el estado desde el propio documento evita ese error.
            </p>
          </div>

        </div>

        <div style={{ marginTop: 14, display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={() => setGuiaAbierta(v => !v)}
            style={{
              fontSize: 12, color: '#3730A3', fontWeight: 600,
              background: 'none', border: 'none', cursor: 'pointer', padding: 0,
              display: 'flex', alignItems: 'center', gap: 4,
            }}
          >
            {guiaAbierta ? 'Ocultar guía completa' : 'Ver guía completa'} {guiaAbierta ? '▲' : '▼'}
          </button>
        </div>

        {guiaAbierta && (
          <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid #C7D2FE' }}>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, color: '#3730A3' }}>
                Prompt recomendado (detecta estado y ciclo automáticamente, no requiere editarlo)
              </span>
              <button
                onClick={copiarPrompt}
                style={{
                  fontSize: 11, fontWeight: 600, color: 'white', background: '#4F46E5',
                  border: 'none', borderRadius: 6, padding: '5px 10px', cursor: 'pointer',
                }}
              >
                {promptCopiado ? '✅ Copiado' : '📋 Copiar prompt'}
              </button>
            </div>
            <pre style={{
              maxHeight: 220, overflowY: 'auto', whiteSpace: 'pre-wrap', margin: 0,
              background: 'white', border: '1px solid #C7D2FE', borderRadius: 8,
              padding: 12, fontSize: 11, lineHeight: 1.6, color: '#374151', marginBottom: 16,
            }}>
              {PROMPT_ESTANDAR}
            </pre>

            <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, color: '#3730A3', marginBottom: 6 }}>
              ✅ Checklist antes de guardar (7 puntos)
            </p>
            <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12, color: '#4338CA', lineHeight: 1.8, marginBottom: 16 }}>
              {CHECKLIST.map((item, i) => <li key={i}>{item}</li>)}
            </ul>

            <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, color: '#3730A3', marginBottom: 6 }}>
              🏷️ Catálogo de categorías (usar estos valores exactos)
            </p>
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px',
              background: 'white', border: '1px solid #C7D2FE', borderRadius: 8, padding: 12,
            }}>
              {CATEGORIAS.map(([valor, desc]) => (
                <div key={valor} style={{ fontSize: 11, color: '#6B7280' }}>
                  <code style={{ background: '#EEF2FF', color: '#3730A3', borderRadius: 4, padding: '1px 5px' }}>{valor}</code>
                  {' '}— {desc}
                </div>
              ))}
            </div>
            <p style={{ fontSize: 11, color: '#9CA3AF', marginTop: 8 }}>
              Si la misma categoría <code>otro</code> se repite en 3+ estados, considera agregarla como categoría oficial aquí en el código.
            </p>
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'stretch' }}>

        <div style={{ background: 'white', border: '1px solid #E5E7EB', borderRadius: 12, padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>🇲🇽</span>
              <h2 style={{ fontSize: 14, fontWeight: 600, color: '#111827', margin: 0 }}>Calendario Federal</h2>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <Badge cargado={federalCargado} />
              {federalCargado && (
                <BotonEliminar onClick={() => handleEliminar('federal')} eliminando={eliminandoFederal} />
              )}
            </div>
          </div>
          <p style={{ fontSize: 12, color: '#9CA3AF', marginBottom: 16 }}>Aplica a todos los estados. Cargar una sola vez por ciclo escolar.</p>
          <label style={{ display: 'block', border: '2px dashed #E5E7EB', borderRadius: 10, padding: '24px', textAlign: 'center', cursor: 'pointer' }}>
            <span style={{ fontSize: 28, display: 'block', marginBottom: 8 }}>📂</span>
            <span style={{ fontSize: 13, color: '#6B7280' }}>
              {uploadingFederal ? 'Cargando...' : 'Selecciona el archivo JSON del calendario federal'}
            </span>
            <span style={{ fontSize: 11, color: '#D1D5DB', display: 'block', marginTop: 4 }}>Formato: .json · Máx. 1 MB</span>
            <input type="file" accept=".json" style={{ display: 'none' }}
              onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload('federal', f) }} />
          </label>
          {mensajeFederal && <p style={{ marginTop: 10, fontSize: 12, fontWeight: 500, color: '#374151' }}>{mensajeFederal}</p>}
        </div>

        <div style={{ background: 'white', border: '1px solid #E5E7EB', borderRadius: 12, padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>🏛️</span>
              <h2 style={{ fontSize: 14, fontWeight: 600, color: '#111827', margin: 0 }}>Calendario Estatal</h2>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <Badge cargado={estatalCargado} />
              {estatalCargado && (
                <BotonEliminar onClick={() => handleEliminar('estatal')} eliminando={eliminandoEstatal} />
              )}
            </div>
          </div>
          <p style={{ fontSize: 12, color: '#9CA3AF', marginBottom: 8 }}>Ajustes estatales específicos. Selecciona el estado antes de cargar.</p>

          {estatalEsFederal && (
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 600,
              color: '#3730A3', background: '#EEF2FF', border: '1px solid #C7D2FE',
              borderRadius: 20, padding: '3px 10px', marginBottom: 12,
            }}>
              🔗 Usa el calendario federal sin cambios
            </div>
          )}

          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6, marginTop: estatalEsFederal ? 0 : 8 }}>Estado</label>
          <select
            value={estadoSeleccionado}
            onChange={e => setEstadoSeleccionado(e.target.value)}
            style={{
              width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #D1D5DB',
              fontSize: 13, color: '#111827', marginBottom: 16, background: 'white',
            }}
          >
            {ESTADOS.map(e => (
              <option key={e.codigo} value={e.codigo}>
                {e.nombre} ({e.codigo}) {estadosConEstatal.includes(e.codigo) ? '· ya cargado' : ''}
              </option>
            ))}
          </select>

          <label style={{ display: 'block', border: '2px dashed #E5E7EB', borderRadius: 10, padding: '24px', textAlign: 'center', cursor: 'pointer' }}>
            <span style={{ fontSize: 28, display: 'block', marginBottom: 8 }}>📂</span>
            <span style={{ fontSize: 13, color: '#6B7280' }}>
              {uploadingEstatal ? 'Cargando...' : `Selecciona el archivo JSON del calendario de ${nombreEstado}`}
            </span>
            <span style={{ fontSize: 11, color: '#D1D5DB', display: 'block', marginTop: 4 }}>Formato: .json · Máx. 1 MB</span>
            <input type="file" accept=".json" style={{ display: 'none' }}
              onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload('estatal', f) }} />
          </label>
          {mensajeEstatal && <p style={{ marginTop: 10, fontSize: 12, fontWeight: 500, color: '#374151' }}>{mensajeEstatal}</p>}

          {(!estatalCargado || estatalEsFederal) && (
            <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px dashed #E5E7EB' }}>
              <button
                onClick={() => setMostrarUsarFederal(v => !v)}
                style={{
                  fontSize: 12, color: '#4B5563', fontWeight: 600, background: 'none', border: 'none',
                  cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 6,
                }}
              >
                {estatalEsFederal
                  ? `🔗 ${nombreEstado} usa el federal sin cambios — clic para editar la nota o reaplicar`
                  : `📋 ¿${nombreEstado} no tiene calendario propio? Usar el federal sin cambios`
                } {mostrarUsarFederal ? '▲' : '▼'}
              </button>

              {mostrarUsarFederal && (
                <div style={{ marginTop: 10, background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 8, padding: 12 }}>
                  {!federalCargado ? (
                    <p style={{ fontSize: 12, color: '#DC2626', margin: 0 }}>
                      Primero carga el calendario federal (tarjeta de la izquierda) para poder usar esta opción.
                    </p>
                  ) : (
                    <>
                      <p style={{ fontSize: 11, color: '#6B7280', margin: '0 0 8px 0' }}>
                        Se copiará el calendario federal tal cual y se guardará como el calendario estatal de <strong>{nombreEstado}</strong>. Amparado en el Art. 87 LGE: el ajuste estatal es opcional, no obligatorio.
                      </p>
                      <textarea
                        value={notaFederal}
                        onChange={e => setNotaFederal(e.target.value)}
                        placeholder={`Nota opcional (ej. fuente que confirma que ${nombreEstado} no publicó calendario propio, con fecha y liga)`}
                        rows={3}
                        style={{
                          width: '100%', fontSize: 12, padding: 8, borderRadius: 6, border: '1px solid #D1D5DB',
                          marginBottom: 8, fontFamily: 'inherit', resize: 'vertical',
                        }}
                      />
                      <button
                        onClick={handleUsarFederal}
                        disabled={usandoFederal}
                        style={{
                          fontSize: 12, fontWeight: 600, color: 'white', background: usandoFederal ? '#9CA3AF' : '#4F46E5',
                          border: 'none', borderRadius: 6, padding: '8px 14px', cursor: usandoFederal ? 'default' : 'pointer',
                        }}
                      >
                        {usandoFederal ? 'Aplicando...' : `Usar calendario federal para ${nombreEstado}`}
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}