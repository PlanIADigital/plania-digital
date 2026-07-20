#!/bin/bash
# Fix (E) URGENT: generador solo cubría ~7 de 10 días hábiles.
# Ejecutar desde la raíz del repo: /Users/user/plania-digital

set -e

TARGET="app/api/generar-planeacion/route.ts"

if [ ! -f "$TARGET" ]; then
  echo "⚠️  No encontré $TARGET desde este directorio."
  echo "   Verifica que estás parado en /Users/user/plania-digital"
  exit 1
fi

# Backup por si acaso
cp "$TARGET" "${TARGET}.bak_$(date +%Y%m%d_%H%M%S)"
echo "✅ Backup creado."

cat > "$TARGET" << 'ENDOFFILE'
import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
const client = new Anthropic()

const MODEL = process.env.CLAUDE_SONNET_MODEL || 'claude-sonnet-4-6'

// Máximo de días que se piden en una sola llamada al modelo.
// Números más altos = menos llamadas (más barato) pero más riesgo de que
// el modelo "cierre" el array antes de completar todos los días.
// Números más bajos = más llamadas (más caro) pero máxima confiabilidad.
const MAX_DIAS_POR_LOTE = 5

const MOMENTOS_MODALIDAD: Record<string, { momentos: string[]; desarrollo: number }> = {
  'Proyectos': { momentos: ['Situación inicial', 'Organización de las acciones', '¡A trabajar!', 'Comunicamos nuestros logros', 'Reflexión sobre el aprendizaje'], desarrollo: 2 },
  'ABJ': { momentos: ['Planteamiento del juego', 'Desarrollo de las actividades', 'Compartimos la experiencia', 'Comunidad de juego'], desarrollo: 1 },
  'Taller crítico': { momentos: ['Situación inicial', 'Puesta en marcha', 'Valoramos lo aprendido', 'Reflexión'], desarrollo: 1 },
  'Rincones': { momentos: ['Asamblea inicial y planeación', 'Exploración de los rincones', 'Compartimos lo aprendido', 'Reflexión sobre el aprendizaje'], desarrollo: 1 },
  'Centros de interés': { momentos: ['Contacto con la realidad', 'Identificación e integración', 'Expresión'], desarrollo: 1 },
  'Unidad didáctica': { momentos: ['Lectura de la realidad', 'Identificación de la trama y complejidad', 'Planificación y organización', 'Exploración y descubrimiento', 'Participación activa y horizontal', 'Valoración de la experiencia'], desarrollo: 2 },
}

type DiaHabil = { fecha: string; label: string; esCTE: boolean; motivo?: string }
type DiaConMomento = DiaHabil & { momento: string; numeroGlobal: number }
type DiaGenerado = {
  numero: number
  momento_modalidad: string
  inicio: string
  desarrollo: string
  cierre: string
  materiales: string
  actividad_complementaria: string
}

const SYSTEM_PROMPT_DIAS = `Eres el Agente Generador NEM de PlanIA Digital. Generas planeaciones didácticas para preescolar (Fase 2, NEM 2022) con voz narrativa auténtica de educadora mexicana.

REGLAS DE VOZ — NO NEGOCIABLES
R1: El alumno es el sujeto principal. Verbos en infinitivo para sus acciones.
R2: Primera persona para la maestra: "coloco", "pregunto", "muestro". NUNCA "la maestra colocará".
R3: Cada actividad incluye una pregunta detonadora específica y concreta.
R4: Materiales cotidianos de bajo costo, integrados al flujo narrativo.
R5: Conectores naturales: "Enseguida", "Después", "Al final", "Para cerrar".
R6: Cada campo (inicio/desarrollo/cierre) tiene 3 a 5 oraciones fluidas.
R7: Al menos una vez por día, incluye el propósito pedagógico entre paréntesis.
R8: Incluye al menos una acción observable evaluable por día.
R4-PDA: El verbo central del PDA debe aparecer EJECUTADO en las actividades, no mencionado.
R-CONTINUIDAD: Este lote es una CONTINUACIÓN de una planeación ya iniciada. Debes dar seguimiento lógico a lo que ya ocurrió (contexto provisto), avanzar la situación problema, y NUNCA repetir materiales ni actividades ya usados.

TONO: Cálido, directo, concreto. Como cuando una maestra le cuenta a otra lo que va a hacer.

FORMATO DE SALIDA — CRÍTICO:
Responde ÚNICAMENTE con JSON válido. Sin markdown. Sin explicaciones. Sin texto fuera del JSON.

{
  "dias": [
    {
      "numero": 1,
      "momento_modalidad": "nombre del momento",
      "inicio": "texto narrativo del inicio (3-5 oraciones)",
      "desarrollo": "texto narrativo del desarrollo (3-5 oraciones)",
      "cierre": "texto narrativo del cierre (3-5 oraciones)",
      "materiales": "material 1 | material 2 | material 3",
      "actividad_complementaria": "texto breve o vacío"
    }
  ]
}`

const SYSTEM_PROMPT_CIERRE = `Eres el Agente de Evaluación de PlanIA Digital. Recibes una planeación didáctica completa ya generada (todos los días) y produces la rúbrica de evaluación y los ajustes razonables.

REGLA CRÍTICA — R4-PDA:
La rúbrica NUNCA se construye desde el PDA abstracto. Debes identificar las instancias CONCRETAS dentro de la narrativa de los días donde la acción del PDA principal fue ejecutada, y evaluar la calidad de esa ejecución. Ciclo: PDA define → narrativa ejecuta → rúbrica evalúa.

Si se te proporciona información de alumnos con necesidades de inclusión (código + acciones), genera ajustes razonables específicos y accionables para esos alumnos, referenciando momentos concretos de la planeación cuando sea posible. Si no hay alumnos de inclusión, responde con una cadena vacía en "ajustes_razonables".

FORMATO DE SALIDA — CRÍTICO:
Responde ÚNICAMENTE con JSON válido. Sin markdown. Sin explicaciones.

{
  "rubrica": {
    "campo": "nombre del campo formativo principal",
    "contenido": "contenido del campo principal",
    "pda": "pda literal",
    "indicador": "descripción del indicador observable",
    "nivel_3": "El alumno...",
    "nivel_2": "El alumno...",
    "nivel_1": "El alumno...",
    "nota_evaluadora": "una oración con voz de maestra"
  },
  "ajustes_razonables": "sugerencias de ajuste para NEE detectadas o texto vacío"
}`

function limpiarJSON(raw: string) {
  return raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '').trim()
}

async function generarLoteDeDias(params: {
  lote: DiaConMomento[]
  form: any
  profile: any
  transversalesTexto: string
  recursosTexto: string
  contextoPrevio: string
  materialesUsados: string[]
}): Promise<DiaGenerado[]> {
  const { lote, form, profile, transversalesTexto, recursosTexto, contextoPrevio, materialesUsados } = params

  const listaDiasLote = lote.map((d, i) => `Día ${i + 1} (${d.momento}): ${d.label}`).join('\n')
  const materialesTexto = materialesUsados.length > 0
    ? `MATERIALES YA USADOS EN DÍAS ANTERIORES (no los repitas): ${materialesUsados.join(', ')}`
    : 'Aún no se han usado materiales en esta planeación.'

  const userMessage = `Continúa la planeación didáctica con modalidad ${form.metodologia}.

CONTEXTO DEL GRUPO:
- CCT: ${profile.cct_primary} | Turno: ${profile.shift_primary} | Grado: ${profile.grade}
- Alumnos: ${profile.total_alumnos || profile.total_students || 'no registrado'}
- Contexto: ${profile.contexto_grupo || 'Grupo de preescolar Fase 2'}

DATOS DEL PROYECTO:
- Nombre: ${form.nombre_proyecto}
- Situación problema: ${form.situacion_problema}
- Finalidad: ${form.finalidad}
- Campo principal: ${form.campo_formativo}
- Contenido: ${form.contenido}
- PDA principal: ${form.pda_principal}
- Eje principal: ${form.eje_principal || 'No definido'}
- Eje secundario: ${form.eje_secundario || 'No definido'}

CAMPOS TRANSVERSALES:
${transversalesTexto}
${recursosTexto}

AVANCE PREVIO DE LA PLANEACIÓN (para dar continuidad narrativa):
${contextoPrevio || 'Este es el primer lote de días. No hay avance previo.'}

${materialesTexto}

LISTA DE DÍAS DE ESTE LOTE (${lote.length} día(s)):
${listaDiasLote}

INSTRUCCIÓN CRÍTICA: Genera EXACTAMENTE ${lote.length} objeto(s) en el array "dias", uno por cada día listado arriba, en el mismo orden. El campo "numero" va del 1 al ${lote.length} (numeración local a este lote). El campo "momento_modalidad" es el indicado entre paréntesis junto a cada día. NUNCA repitas ni omitas días.`

  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 4000,
    system: SYSTEM_PROMPT_DIAS,
    messages: [{ role: 'user', content: userMessage }],
  })

  const content = message.content[0].type === 'text' ? message.content[0].text : ''
  const parsed = JSON.parse(limpiarJSON(content))
  return parsed.dias as DiaGenerado[]
}

async function generarRubricaYAjustes(params: {
  form: any
  profile: any
  todosLosDias: DiaGenerado[]
}): Promise<{ rubrica: any; ajustes_razonables: string }> {
  const { form, profile, todosLosDias } = params

  const resumenDias = todosLosDias.map(d =>
    `Día ${d.numero} (${d.momento_modalidad}): Inicio: ${d.inicio} Desarrollo: ${d.desarrollo} Cierre: ${d.cierre}`
  ).join('\n\n')

  const alumnosInclusion = profile.alumnos_inclusion?.length > 0
    ? JSON.stringify(profile.alumnos_inclusion)
    : 'No hay alumnos con necesidades de inclusión registrados en este grupo.'

  const userMessage = `PDA principal a evaluar: ${form.pda_principal}
Campo formativo: ${form.campo_formativo}
Contenido: ${form.contenido}

ALUMNOS CON NECESIDADES DE INCLUSIÓN:
${alumnosInclusion}

PLANEACIÓN COMPLETA YA GENERADA:
${resumenDias}

Genera la rúbrica basada en las instancias concretas donde el PDA fue ejecutado en la narrativa de arriba, y los ajustes razonables correspondientes.`

  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 1500,
    system: SYSTEM_PROMPT_CIERRE,
    messages: [{ role: 'user', content: userMessage }],
  })

  const content = message.content[0].type === 'text' ? message.content[0].text : ''
  return JSON.parse(limpiarJSON(content))
}

export async function POST(request: NextRequest) {
  try {
    const { form, profile } = await request.json()

    // ============================================================
    // 1. OBTENER DÍAS HÁBILES DESDE SUPABASE
    // ============================================================
    const { createClient } = await import('@supabase/supabase-js')
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SECRET_KEY!
    )

    const { data: calData } = await supabaseAdmin
      .from('calendarios_sep')
      .select('datos')
      .eq('ciclo', '2025-2026')
      .eq('tipo', 'estatal')
      .single()

    const calDatos = calData?.datos || {}
    const diasInhabilesSet = new Set<string>()

    if (calDatos.dias_inhabiles) {
      for (const d of calDatos.dias_inhabiles) {
        if (d.fecha) diasInhabilesSet.add(d.fecha)
      }
    }
    if (calDatos.sesiones_cte) {
      for (const s of calDatos.sesiones_cte) {
        if (s.fecha) diasInhabilesSet.add(s.fecha)
        if (s.fechas) s.fechas.forEach((f: string) => diasInhabilesSet.add(f))
      }
    }
    if (calDatos.periodos_vacaciones) {
      for (const v of calDatos.periodos_vacaciones) {
        if (v.inicio && v.fin) {
          const cur = new Date(v.inicio + 'T12:00:00')
          const end = new Date(v.fin + 'T12:00:00')
          while (cur <= end) {
            diasInhabilesSet.add(cur.toISOString().split('T')[0])
            cur.setDate(cur.getDate() + 1)
          }
        }
      }
    }

    const meses = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']
    const diasSemana = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado']

    function calcularDiasHabiles(inicio: string, fin: string): DiaHabil[] {
      const dias: DiaHabil[] = []
      const cur = new Date(inicio + 'T12:00:00')
      const end = new Date(fin + 'T12:00:00')
      while (cur <= end) {
        const dow = cur.getDay()
        const fechaStr = cur.toISOString().split('T')[0]
        if (dow !== 0 && dow !== 6) {
          if (diasInhabilesSet.has(fechaStr)) {
            const esCTE = calDatos.sesiones_cte?.some((s: any) =>
              s.fecha === fechaStr || s.fechas?.includes(fechaStr)
            ) || false
            dias.push({ fecha: fechaStr, label: `${diasSemana[dow]} ${cur.getDate()} de ${meses[cur.getMonth()]}`, esCTE, motivo: esCTE ? 'CTE' : 'Inhábil' })
          } else {
            dias.push({ fecha: fechaStr, label: `${diasSemana[dow]} ${cur.getDate()} de ${meses[cur.getMonth()]}`, esCTE: false })
          }
        }
        cur.setDate(cur.getDate() + 1)
      }
      return dias
    }

    const todosDias = calcularDiasHabiles(form.fecha_inicio, form.fecha_fin)
    const diasHabiles = todosDias.filter(d => !d.esCTE && !d.motivo)
    const diasCTE = todosDias.filter(d => d.esCTE)
    const diasInhabiles = todosDias.filter(d => d.motivo && !d.esCTE)

    // ============================================================
    // 2. CALCULAR DISTRIBUCIÓN DE DÍAS POR MOMENTO
    // ============================================================
    const config = MOMENTOS_MODALIDAD[form.metodologia] || MOMENTOS_MODALIDAD['Proyectos']
    const momentos = config.momentos