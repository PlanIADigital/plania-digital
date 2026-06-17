import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
const client = new Anthropic()

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

    // Calcular días hábiles
    const meses = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']
    const diasSemana = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado']

    function calcularDiasHabiles(inicio: string, fin: string) {
      const dias: { fecha: string; label: string; esCTE: boolean; motivo?: string }[] = []
      const cur = new Date(inicio + 'T12:00:00')
      const end = new Date(fin + 'T12:00:00')
      while (cur <= end) {
        const dow = cur.getDay()
        const fechaStr = cur.toISOString().split('T')[0]
        if (dow !== 0 && dow !== 6) {
          if (diasInhabilesSet.has(fechaStr)) {
            // Verificar si es CTE
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
    const MOMENTOS_MODALIDAD: Record<string, { momentos: string[]; desarrollo: number }> = {
      'Proyectos': { momentos: ['Situación inicial', 'Organización de las acciones', '¡A trabajar!', 'Comunicamos nuestros logros', 'Reflexión sobre el aprendizaje'], desarrollo: 2 },
      'ABJ': { momentos: ['Planteamiento del juego', 'Desarrollo de las actividades', 'Compartimos la experiencia', 'Comunidad de juego'], desarrollo: 1 },
      'Taller crítico': { momentos: ['Situación inicial', 'Puesta en marcha', 'Valoramos lo aprendido', 'Reflexión'], desarrollo: 1 },
      'Rincones': { momentos: ['Asamblea inicial y planeación', 'Exploración de los rincones', 'Compartimos lo aprendido', 'Reflexión sobre el aprendizaje'], desarrollo: 1 },
      'Centros de interés': { momentos: ['Contacto con la realidad', 'Identificación e integración', 'Expresión'], desarrollo: 1 },
      'Unidad didáctica': { momentos: ['Lectura de la realidad', 'Identificación de la trama y complejidad', 'Planificación y organización', 'Exploración y descubrimiento', 'Participación activa y horizontal', 'Valoración de la experiencia'], desarrollo: 2 },
    }

    const config = MOMENTOS_MODALIDAD[form.metodologia] || MOMENTOS_MODALIDAD['Proyectos']
    const momentos = config.momentos
    const idxDesarrollo = config.desarrollo
    const diasFijos = momentos.length - 1
    const diasDesarrollo = Math.max(1, diasHabiles.length - diasFijos)

    // Asignar días a momentos
    let diaIdx = 0
    const distribucion: { momento: string; dias: typeof diasHabiles }[] = []
    for (let i = 0; i < momentos.length; i++) {
      if (i === idxDesarrollo) {
        distribucion.push({ momento: momentos[i], dias: diasHabiles.slice(diaIdx, diaIdx + diasDesarrollo) })
        diaIdx += diasDesarrollo
      } else {
        distribucion.push({ momento: momentos[i], dias: diasHabiles.slice(diaIdx, diaIdx + 1) })
        diaIdx += 1
      }
    }

    // Lista de días para el prompt
    const listaDias = diasHabiles.map((d, i) => `Día ${i + 1}: ${d.label}`).join('\n')

    // ============================================================
    // 3. CONSTRUIR PROMPT
    // ============================================================
    const transversalesTexto = form.transversales?.length > 0
      ? form.transversales.map((t: any, i: number) => `Transversal ${i+1}: ${t.campo} > ${t.contenido}\nPDA: ${t.pda}`).join('\n\n')
      : 'No se definieron campos transversales.'

    const recursosTexto = form.recursos_materiales
      ? `RECURSOS INDICADOS POR LA DIRECTORA: ${form.recursos_materiales} — integrarlos en al menos una actividad.`
      : ''

    const systemPrompt = `Eres el Agente Generador NEM de PlanIA Digital. Generas planeaciones didácticas para preescolar (Fase 2, NEM 2022) con voz narrativa auténtica de educadora mexicana.

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

TONO: Cálido, directo, concreto. Como cuando una maestra le cuenta a otra lo que va a hacer.

FORMATO DE SALIDA — CRÍTICO:
Responde ÚNICAMENTE con JSON válido. Sin markdown. Sin explicaciones. Sin texto fuera del JSON.

El JSON debe tener esta estructura exacta:
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
  ],
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

    const userMessage = `Genera la planeación didáctica COMPLETA con modalidad ${form.metodologia}.

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

DISTRIBUCIÓN DE DÍAS POR MOMENTO:
${distribucion.map(d => `${d.momento}: ${d.dias.length} día(s) — ${d.dias.map(x => x.label).join(', ')}`).join('\n')}

LISTA COMPLETA DE DÍAS HÁBILES (${diasHabiles.length} días):
${listaDias}

INSTRUCCIÓN CRÍTICA: Genera exactamente ${diasHabiles.length} objetos en el array "dias". Uno por cada día hábil de la lista. El campo "numero" corresponde al número del día (1, 2, 3...). El campo "momento_modalidad" corresponde al momento de la modalidad asignado a ese día según la distribución de arriba. NUNCA repitas días. NUNCA omitas días. Sigue el orden exacto de la lista.`

    // ============================================================
    // 4. LLAMAR AL AGENTE
    // ============================================================
    const message = await client.messages.create({
      model: process.env.CLAUDE_SONNET_MODEL || 'claude-sonnet-4-6',
      max_tokens: 16000,
      messages: [{ role: 'user', content: userMessage }],
      system: systemPrompt
    })

    const content = message.content[0].type === 'text' ? message.content[0].text : ''
    const cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '').trim()
    const planeacion = JSON.parse(cleanContent)

    // ============================================================
    // 5. INYECTAR FECHAS REALES EN CADA DÍA
    // ============================================================
    if (planeacion.dias && Array.isArray(planeacion.dias)) {
      planeacion.dias = planeacion.dias.map((dia: any, i: number) => ({
        ...dia,
        numero: i + 1,
        fecha: diasHabiles[i]?.label || '',
        fecha_iso: diasHabiles[i]?.fecha || '',
      }))
    }

    // Agregar días CTE e inhábiles para mostrar en la vista
    planeacion.dias_especiales = [
      ...diasCTE.map(d => ({ fecha: d.label, fecha_iso: d.fecha, tipo: 'CTE' })),
      ...diasInhabiles.map(d => ({ fecha: d.label, fecha_iso: d.fecha, tipo: d.motivo || 'Inhábil' }))
    ].sort((a, b) => a.fecha_iso.localeCompare(b.fecha_iso))

    return NextResponse.json({ planeacion })

  } catch (error: unknown) {
    console.error('Error en Agente NEM:', error)
    const msg = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
