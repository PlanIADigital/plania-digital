import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

const client = new Anthropic()

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

export async function POST(request: NextRequest) {
  try {
    const {
      nombre_proyecto,
      situacion_problema,
      finalidad,
      campo_principal,
      grado,
      eje_sugerido,
      // ============================================================
      // [jul 2026, FASE 1.2] Jerarquía pedagógica — mismos tres campos
      // que ya usa generar-planeacion/route.ts (obtenerPrioridadesPedagogicas).
      // 1er orden: necesidad del alumno (pdas_prioritarios_grupo, de
      // evaluacion_individual) + contexto comunitario (contexto_social,
      // de diagnostico_escolar/PMC) — la NEM 2022 exige combinar ambos.
      // 2do orden: pdas_jardin, acordados por el colectivo — complementario,
      // nunca sustituye al 1er orden. El frontend (nueva/page.tsx) es
      // responsable de extraer estos 3 valores de `profile` y mandarlos
      // aquí; si no vienen, esta ruta funciona igual que antes (sin
      // personalización adicional), no rompe nada.
      // ============================================================
      pdas_prioritarios_grupo,
      contexto_social,
      pdas_jardin,
    } = await request.json()

    // 1. Cargar catálogo completo desde Supabase
    const { data: catalogo } = await supabase
      .from('pda_catalog')
      .select('id, campo, contenido, pda, grado')
      .eq('grado', grado || '2°')
      .order('campo')

    if (!catalogo || catalogo.length === 0) {
      return NextResponse.json({ error: 'Catálogo no disponible' }, { status: 500 })
    }

    // 2. Construir resumen del catálogo para el prompt (excluye el campo principal)
    const camposDisponibles = [...new Set(catalogo.map((r: any) => r.campo))]
      .filter(c => c !== campo_principal)

    const resumenCatalogo = camposDisponibles.map(campo => {
      const contenidos = [...new Set(
        catalogo.filter((r: any) => r.campo === campo).map((r: any) => r.contenido)
      )]
      return `CAMPO: ${campo}\nCONTENIDOS: ${contenidos.join(' | ')}`
    }).join('\n\n')

    const pdaPorContenido = catalogo.reduce((acc: any, r: any) => {
      const key = `${r.campo}||${r.contenido}`
      if (!acc[key]) acc[key] = []
      acc[key].push(r.pda)
      return acc
    }, {})

    const resumenPDAs = Object.entries(pdaPorContenido)
      .filter(([key]) => !key.startsWith(campo_principal))
      .map(([key, pdas]) => {
        const [campo, contenido] = key.split('||')
        return `${campo} > ${contenido}:\n${(pdas as string[]).map(p => `  - ${p}`).join('\n')}`
      }).join('\n\n')

    // [jul 2026] Si "Mi Avance" mandó un eje sugerido (para equilibrar
    // ejes poco abordados), se le presenta al modelo como candidato
    // preferente — pero SOLO como sugerencia. La coherencia pedagógica
    // real del proyecto siempre tiene prioridad; el modelo puede
    // ignorarlo si no encaja con la situación problema.
    const ejeSugeridoTexto = eje_sugerido
      ? `\n\nEJE SUGERIDO EXTERNAMENTE (por el módulo "Mi Avance", para equilibrar cobertura de ejes poco usados): "${eje_sugerido}". Úsalo como eje_principal SOLO SI es genuinamente coherente con la situación problema y la finalidad de este proyecto específico. Si no tiene relación real y forzarlo produciría una articulación artificial, ignóralo por completo y elige el eje que realmente corresponda — la coherencia pedagógica real siempre tiene prioridad sobre esta sugerencia externa.`
      : ''

    // [jul 2026, FASE 1.2] Bloque de 1er orden — necesidad + contexto.
    const necesidadesTexto = Array.isArray(pdas_prioritarios_grupo) && pdas_prioritarios_grupo.length > 0
      ? `\n\nNECESIDADES DE APRENDIZAJE DEL GRUPO (evaluación individual de la educadora — 1ER ORDEN DE PRIORIDAD): ${pdas_prioritarios_grupo.join(' | ')}`
      : ''

    const contextoComunitarioTexto = contexto_social
      ? `\n\nCONTEXTO COMUNITARIO DEL GRUPO (también 1ER ORDEN, junto con las necesidades de arriba — la NEM 2022 exige combinar necesidad + contexto para una selección precisa): ${contexto_social}`
      : ''

    // [jul 2026, FASE 1.2] Bloque de 2do orden — PDAs del jardín.
    const pdasJardinTexto = Array.isArray(pdas_jardin) && pdas_jardin.length > 0
      ? `\n\nPDAs ACORDADOS POR EL COLECTIVO DEL JARDÍN (2DO ORDEN — complementario; considéralos si son coherentes con el proyecto, pero NUNCA en lugar de las necesidades individuales o el contexto comunitario de arriba si ambos aplican): ${pdas_jardin.join(' | ')}`
      : ''

    // 3. Llamar a Haiku
    const message = await client.messages.create({
      model: process.env.CLAUDE_HAIKU_MODEL || 'claude-haiku-4-5-20251001',
      max_tokens: 1500,
      system: `Eres un agente pedagógico especializado en el Programa de Preescolar NEM 2022 Fase 2 de México. 
Tu tarea es analizar un proyecto didáctico y seleccionar los 3 campos formativos transversales más relevantes desde un catálogo oficial.

REGLAS CRÍTICAS:
- Los PDAs deben ser LITERALES y EXACTOS del catálogo proporcionado. Sin parafrasear ni modificar.
- Selecciona exactamente 3 campos formativos, todos diferentes entre sí y diferentes al campo principal.
- Elige el contenido y PDA que tenga relación más directa con la situación problema y finalidad del proyecto.
- JERARQUÍA DE PRIORIDAD (si se te proporcionan estos datos): si hay "NECESIDADES DE APRENDIZAJE DEL GRUPO" o "CONTEXTO COMUNITARIO DEL GRUPO" en el mensaje, esas son 1ER ORDEN — dales preferencia sobre cualquier otro candidato al elegir los 3 transversales, siempre que exista coherencia real con la situación problema (nunca fuerces una relación artificial). Los "PDAs ACORDADOS POR EL COLECTIVO DEL JARDÍN" son 2DO ORDEN — complementarios, puedes incluir alguno si aplica, pero NUNCA elijas los 3 transversales exclusivamente del jardín si hay necesidades individuales o contexto comunitario coherentes con el proyecto que no consideraste.
- Para los ejes articuladores, elige de esta lista EXACTA: ["Inclusión", "Pensamiento crítico", "Interculturalidad crítica", "Igualdad de género", "Vida saludable", "Apropiación de las culturas a través de la lectura y la escritura", "Artes y experiencias estéticas"]
- El eje_principal debe ser el que mejor articule el proyecto completo de forma transversal.
- El eje_secundario debe complementar al principal sin repetirlo.
- Si se te proporciona un eje sugerido externamente, considéralo como candidato preferente para el eje_principal SOLO SI es genuinamente coherente con la situación problema y la finalidad — nunca lo elijas si no tiene relación real. La coherencia pedagógica real siempre tiene prioridad sobre cualquier sugerencia externa.
- NUNCA uses etiquetas diagnósticas, clínicas o de discapacidad al justificar tu elección — la legislación vigente prohíbe etiquetar a alumnos neurodivergentes. Refiérete solo a necesidades y contextos, nunca a diagnósticos.
- Responde SOLO con JSON válido, sin markdown, sin explicaciones.

FORMATO DE SALIDA EXACTO:
{
  "transversales": [
    { "campo": "...", "contenido": "...", "pda": "..." },
    { "campo": "...", "contenido": "...", "pda": "..." },
    { "campo": "...", "contenido": "...", "pda": "..." }
  ],
  "eje_principal": "nombre exacto del eje principal",
  "eje_secundario": "nombre exacto del eje secundario",
  "ejes_disponibles": ["Inclusión", "Pensamiento crítico", "Interculturalidad crítica", "Igualdad de género", "Vida saludable", "Apropiación de las culturas a través de la lectura y la escritura", "Artes y experiencias estéticas"]
}`,
      messages: [{
        role: 'user',
        content: `PROYECTO:
Nombre: ${nombre_proyecto}
Situación problema: ${situacion_problema}
Finalidad: ${finalidad}
Campo principal ya elegido: ${campo_principal}

CATÁLOGO DISPONIBLE (campos y contenidos):
${resumenCatalogo}

PDAs DISPONIBLES POR CONTENIDO:
${resumenPDAs}${ejeSugeridoTexto}${necesidadesTexto}${contextoComunitarioTexto}${pdasJardinTexto}

Selecciona los 3 campos transversales más relevantes para este proyecto. Los PDAs deben ser literales del catálogo.`
      }]
    })

    const content = message.content[0].type === 'text' ? message.content[0].text : ''
    const clean = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const resultado = JSON.parse(clean)

    // [jul 2026] Enriquecer cada transversal sugerido con su id real
    // de pda_catalog. Como el modelo está obligado a devolver el texto
    // LITERAL del catálogo, el match por igualdad exacta es confiable.
    // Si algún transversal no encuentra match (el modelo se desvió del
    // texto exacto), queda con id: null — se loguea para detectarlo,
    // pero no bloquea la generación de la planeación.
    const transversalesConId = (resultado.transversales || []).map((t: any) => {
      const match = catalogo.find((r: any) =>
        r.campo === t.campo && r.contenido === t.contenido && r.pda === t.pda
      )
      if (!match) {
        console.error('⚠️ Transversal sugerido por IA no encontró match exacto en el catálogo:', t)
      }
      return { ...t, id: match?.id || null }
    })

    return NextResponse.json({ ...resultado, transversales: transversalesConId })

  } catch (error: unknown) {
    console.error('Error en sugerir-campos:', error)
    const msg = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}