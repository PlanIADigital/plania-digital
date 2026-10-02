// app/api/sugerir-fase1/route.ts
// [30 sep 2026] Fase 1 de Nueva Planeación — "El alma de tu planeación".
// MÍA PROPONE, la educadora DECIDE: esta ruta solo devuelve opciones;
// nunca escribe en la planeación. La educadora valida cada paso en pantalla.
//
// Acciones (campo `accion` del body):
//   'detectar'     → problemáticas detectadas desde Mi Grupo (con caché por huella)
//   'problematica' → 2 redacciones de la situación problema
//   'proposito'    → 2 propósitos derivados de la problemática confirmada
//   'titulo'       → 3 títulos derivados de problemática + propósito
//
// Privacidad: los datos de Mi Grupo se leen AQUÍ, en el servidor, nunca
// del navegador. De la evaluación individual solo se usan resumen_general
// y pdas_prioritarios_grupo — jamás alumnos, alumnos_con_nee ni alertas.

import { CICLO_ESCOLAR_ACTIVO } from '@/lib/calendarioEscolar'
import { resumenSemaforoGrupo } from '@/lib/semaforoServidor'
import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createHash } from 'crypto'
import { supabaseAdmin as supabase } from '@/lib/supabase'
import { verificarUsuario } from '@/lib/verificarUsuario'

const client = new Anthropic()
const MODELO = process.env.CLAUDE_HAIKU_MODEL || 'claude-haiku-4-5-20251001'
const MAX_CHARS_FUENTE = 2500

type Origen = 'PMC' | 'PA' | 'Grupo' | 'Semáforo' | 'Dirección' | 'Jardín'
const ORIGENES: Origen[] = ['PMC', 'PA', 'Grupo', 'Semáforo', 'Dirección', 'Jardín']

interface ProblematicaDetectada {
  id: string
  texto: string
  origen: Origen
}

// ------------------------------------------------------------------
// Utilidades
// ------------------------------------------------------------------

// Convierte cualquier valor jsonb (texto, lista u objeto) en texto plano,
// recortado para acotar tokens.
function aTexto(valor: any, max = MAX_CHARS_FUENTE): string {
  const partes: string[] = []
  function recorrer(v: any) {
    if (v === null || v === undefined) return
    if (typeof v === 'string') { if (v.trim()) partes.push(v.trim()); return }
    if (Array.isArray(v)) { v.forEach(recorrer); return }
    if (typeof v === 'object') { Object.values(v).forEach(recorrer) }
  }
  recorrer(valor)
  const texto = partes.join(' | ')
  return texto.length > max ? texto.slice(0, max) + '…' : texto
}

function limpiar(valor: any, max = 800): string {
  return typeof valor === 'string' ? valor.trim().slice(0, max) : ''
}

function extraerJSON(texto: string): any {
  const inicio = texto.indexOf('{')
  const fin = texto.lastIndexOf('}')
  if (inicio === -1 || fin === -1) throw new Error('La respuesta de MÍA no tuvo un formato válido.')
  return JSON.parse(texto.slice(inicio, fin + 1))
}

function opcionesValidas(resultado: any, cantidad: number): string[] {
  const lista = Array.isArray(resultado?.opciones) ? resultado.opciones : []
  const limpias = lista
    .filter((o: any) => typeof o === 'string' && o.trim())
    .map((o: string) => o.trim().replace(/^["“]|["”]$/g, ''))
    .slice(0, cantidad)
  if (limpias.length === 0) throw new Error('MÍA no devolvió opciones. Intenta de nuevo.')
  return limpias
}

async function preguntarAMia(system: string, contenido: string, maxTokens: number) {
  const message = await client.messages.create({
    model: MODELO,
    max_tokens: maxTokens,
    system,
    messages: [{ role: 'user', content: contenido }],
  })
  console.log('[sugerir-fase1] tokens entrada/salida:', message.usage?.input_tokens, message.usage?.output_tokens)
  const texto = message.content[0]?.type === 'text' ? message.content[0].text : ''
  return extraerJSON(texto)
}

const REGLAS_BASE = `Eres MÍA, colega pedagógica experta en el Programa de Preescolar NEM 2022 (Fase 2) de México. Hablas con calidez y claridad, como una educadora con experiencia.
Tu papel es PROPONER opciones; la educadora siempre decide. Nunca presentes algo como definitivo.
REGLAS:
- Redacta en español de México, claro y profesional, sin tecnicismos innecesarios.
- Nunca uses nombres de niños, códigos de alumno (AL-XX) ni etiquetas diagnósticas, clínicas o de discapacidad; la legislación vigente prohíbe etiquetar. Habla del grupo y de necesidades, nunca de diagnósticos.
- No inventes datos que no estén en la información recibida. No atribuyas causas ni afirmes nada sobre el entorno, las familias o el jardín que no esté en esa información o en lo que escribió la educadora.
- Usa lenguaje de la NEM: habla de barreras para el aprendizaje o de áreas de oportunidad. Evita palabras de déficit como "rezago" o "retraso", y evita "académico" (es preescolar).
- Responde SOLO con JSON válido, sin markdown ni explicaciones.`

// ------------------------------------------------------------------
// Carga del usuario y de sus fuentes de Mi Grupo (solo en servidor)
// ------------------------------------------------------------------

async function cargarUsuario(request: NextRequest) {
  const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
  if (!token) return null
  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) return null
  const { data } = await supabase
    .from('users')
    .select('id, auth_uid, grado, diagnostico_escolar, diagnostico_texto, evaluacion_individual, observaciones_directivo, pdas_jardin, problematicas_detectadas')
    .eq('auth_uid', user.id)
    .single()
  return data
}

async function reunirFuentes(u: any): Promise<Record<Origen, string>> {
  const { data: pa } = await supabase
    .from('programa_analitico')
    .select('pda_ponderacion')
    .eq('educadora_id', u.auth_uid)
    .eq('activo', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  const problematicasPA = pa?.pda_ponderacion?.problematicas_institucionales
  // [1 oct 2026] Si el PA no trae problemáticas explícitas (muchos PA no tienen
  // ese apartado), se usa su contexto comunitario y su resumen como respaldo.
  const pp = pa?.pda_ponderacion || {}
  const paTexto = Array.isArray(problematicasPA) && problematicasPA.length > 0
    ? aTexto(problematicasPA)
    : aTexto([pp.contexto_comunitario ?? '', pp.resumen_pa ?? ''])

  // Evaluación individual: SOLO resumen y PDA prioritarios del grupo.
  const ind = u.evaluacion_individual && !Array.isArray(u.evaluacion_individual) ? u.evaluacion_individual : null
  const pdasGrupo: string[] = Array.isArray(ind?.pdas_prioritarios_grupo)
    ? ind.pdas_prioritarios_grupo.map((p: any) => (typeof p === 'string' ? p : p?.pda)).filter(Boolean)
    : []

  const dir = u.observaciones_directivo && typeof u.observaciones_directivo === 'object' && !Array.isArray(u.observaciones_directivo)
    ? u.observaciones_directivo
    : null

  const jardinRaw = u.pdas_jardin
  const jardinLista = !Array.isArray(jardinRaw) && Array.isArray(jardinRaw?.pdas)
    ? jardinRaw.pdas
    : (Array.isArray(jardinRaw) ? jardinRaw : [])
  const pdasJardin: string[] = jardinLista.map((p: any) => (typeof p === 'string' ? p : p?.pda)).filter(Boolean)

  return {
    PMC: aTexto(u.diagnostico_escolar),
    PA: paTexto,
    Grupo: aTexto([
      u.diagnostico_texto || '',
      ind?.resumen_general ?? '',
      pdasGrupo.length ? `PDA prioritarios del grupo: ${pdasGrupo.join('; ')}` : '',
    ]),
    'Semáforo': await resumenSemaforoGrupo(supabase, u.id, CICLO_ESCOLAR_ACTIVO),
    'Dirección': aTexto([dir?.areas_mejora ?? '', dir?.instruccion_para_agente ?? '']),
    'Jardín': pdasJardin.length ? aTexto(`PDA acordados por el colectivo: ${pdasJardin.join('; ')}`) : '',
  }
}

// ------------------------------------------------------------------
// Acciones
// ------------------------------------------------------------------

async function detectar(usuario: any, forzar: boolean) {
  const fuentes = await reunirFuentes(usuario)
  const hayFuentes = ORIGENES.some(o => fuentes[o])
  if (!hayFuentes) return { items: [], sin_fuentes: true }

  // Huella: si Mi Grupo no cambió, se devuelve lo guardado sin costo.
  const huella = createHash('sha256').update(JSON.stringify(fuentes)).digest('hex').slice(0, 16)
  const cache = usuario.problematicas_detectadas
  if (!forzar && cache?.huella === huella && Array.isArray(cache.items) && cache.items.length > 0) {
    return { items: cache.items, desde_cache: true }
  }

  const bloques = ORIGENES.filter(o => fuentes[o]).map(o => `[${o}]\n${fuentes[o]}`).join('\n\n')
  const resultado = await preguntarAMia(
    `${REGLAS_BASE}

TAREA: A partir de la información de Mi Grupo, detecta de 3 a 4 problemáticas reales que podrían dar origen a un proyecto didáctico.
- Cada problemática debe salir de la información de UNA fuente y llevar su etiqueta exacta de origen: PMC, PA, Grupo, Semáforo, Dirección o Jardín.
- Prioriza en este orden: necesidades del grupo (Grupo y Semáforo), contexto del jardín y la comunidad (PMC y PA), observaciones de Dirección. Usa Jardín solo como apoyo.
- Semáforo trae, por área, qué parte del grupo está en suficiente, en desarrollo o requiere apoyo. Úsalo para detectar el área donde más niñas y niños necesitan acompañamiento. Habla del grupo en general, sin citar porcentajes ni referirte a niños en particular.
- Si dos fuentes dicen lo mismo, júntalas en una sola y usa la etiqueta de la fuente más cercana al grupo.
- Cada problemática: una o dos frases, máximo 220 caracteres, describiendo lo que se observa en las niñas y los niños o en su entorno. No propongas soluciones ni actividades.
- Cada problemática debe tener UN SOLO foco (por ejemplo, solo regulación emocional). No juntes varios temas en una misma problemática.

FORMATO: {"problematicas":[{"texto":"...","origen":"Grupo"}]}`,
    `GRADO DEL GRUPO: ${usuario.grado || 'sin dato'}\n\nINFORMACIÓN DE MI GRUPO:\n\n${bloques}`,
    1000,
  )

  const items: ProblematicaDetectada[] = (Array.isArray(resultado?.problematicas) ? resultado.problematicas : [])
    .filter((p: any) => typeof p?.texto === 'string' && p.texto.trim() && ORIGENES.includes(p.origen))
    .slice(0, 4)
    .map((p: any, i: number) => ({ id: `p${i + 1}`, texto: p.texto.trim(), origen: p.origen }))

  if (items.length === 0) throw new Error('MÍA no pudo detectar problemáticas. Intenta de nuevo.')

  await supabase
    .from('users')
    .update({ problematicas_detectadas: { huella, generado_en: new Date().toISOString(), items } })
    .eq('id', usuario.id)

  return { items }
}

async function redactarProblematica(usuario: any, body: any) {
  const seleccionadas: string[] = (Array.isArray(body.seleccionadas) ? body.seleccionadas : [])
    .map((s: any) => limpiar(s, 600)).filter(Boolean).slice(0, 2)
  const observacion = limpiar(body.observacion, 800)
  if (seleccionadas.length === 0 && !observacion) {
    throw new Error('Elige una problemática o escribe lo que observaste.')
  }
  const resultado = await preguntarAMia(
    `${REGLAS_BASE}

TAREA: Redacta 2 versiones distintas de la SITUACIÓN PROBLEMA de un proyecto de preescolar, integrando las problemáticas elegidas por la educadora y su observación, si la hay (respeta sus ideas; no las sustituyas).
- Cada versión: de 2 a 3 frases, entre 250 y 400 caracteres (nunca más de 420).
- Describe la situación observada en el grupo o su entorno y por qué es importante atenderla.
- Versión 1: más descriptiva del contexto. Versión 2: más centrada en las niñas y los niños.
- No propongas actividades.

FORMATO: {"opciones":["...","..."]}`,
    `GRADO DEL GRUPO: ${usuario.grado || 'sin dato'}
PROBLEMÁTICAS ELEGIDAS: ${seleccionadas.length ? seleccionadas.join(' | ') : 'ninguna'}
OBSERVACIÓN DE LA EDUCADORA: ${observacion || 'ninguna'}`,
    700,
  )
  return { opciones: opcionesValidas(resultado, 2) }
}

async function redactarProposito(usuario: any, body: any) {
  const problematica = limpiar(body.problematica, 900)
  const ideas = limpiar(body.ideas, 600)
  if (!problematica) throw new Error('Primero confirma la situación problema.')
  const resultado = await preguntarAMia(
    `${REGLAS_BASE}

TAREA: Propón 2 PROPÓSITOS distintos para un proyecto de preescolar que atiende la situación problema recibida.
- Cada propósito inicia con "Que las niñas y los niños" y tiene 1 o 2 frases, entre 150 y 260 caracteres (nunca más de 280).
- Expresa lo que aprenderán, desarrollarán y vivirán al atender esa situación; debe ser observable y alcanzable en preescolar.
- Si la educadora escribió ideas, tómalas como base.

FORMATO: {"opciones":["...","..."]}`,
    `GRADO DEL GRUPO: ${usuario.grado || 'sin dato'}
SITUACIÓN PROBLEMA CONFIRMADA: ${problematica}
IDEAS DE LA EDUCADORA: ${ideas || 'ninguna'}`,
    500,
  )
  return { opciones: opcionesValidas(resultado, 2) }
}

async function redactarTitulo(usuario: any, body: any) {
  const problematica = limpiar(body.problematica, 900)
  const proposito = limpiar(body.proposito, 600)
  const ideas = limpiar(body.ideas, 400)
  if (!problematica || !proposito) throw new Error('Primero confirma la situación problema y el propósito.')
  const resultado = await preguntarAMia(
    `${REGLAS_BASE}

TAREA: Propón 3 TÍTULOS para un proyecto de preescolar.
- Máximo 8 palabras cada uno, sin comillas.
- Atractivos para niñas y niños de preescolar y claramente relacionados con la situación problema y el propósito.
- Variados: uno como invitación o pregunta, uno descriptivo y uno lúdico.
- Si la educadora escribió ideas, tómalas como base.

FORMATO: {"opciones":["...","...","..."]}`,
    `GRADO DEL GRUPO: ${usuario.grado || 'sin dato'}
SITUACIÓN PROBLEMA: ${problematica}
PROPÓSITO: ${proposito}
IDEAS DE LA EDUCADORA: ${ideas || 'ninguna'}`,
    300,
  )
  return { opciones: opcionesValidas(resultado, 3) }
}

// ------------------------------------------------------------------
// Ruta
// ------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    const auth = await verificarUsuario(request)
    if (!auth.autorizado) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const usuario = await cargarUsuario(request)
    if (!usuario) {
      return NextResponse.json({ error: 'No se pudo identificar tu cuenta.' }, { status: 401 })
    }

    const body = await request.json()
    switch (body?.accion) {
      case 'detectar':
        return NextResponse.json(await detectar(usuario, body.forzar === true))
      case 'problematica':
        return NextResponse.json(await redactarProblematica(usuario, body))
      case 'proposito':
        return NextResponse.json(await redactarProposito(usuario, body))
      case 'titulo':
        return NextResponse.json(await redactarTitulo(usuario, body))
      default:
        return NextResponse.json({ error: 'Acción no válida.' }, { status: 400 })
    }
  } catch (error: unknown) {
    console.error('Error en sugerir-fase1:', error)
    const msg = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
