// ============================================================
//  PlanIA Digital — lib/planeacion/contexto.ts
//  [Saneado 27 sep 2026 — Fase 2] Separado de app/api/generar-planeacion/route.ts
//  SIN cambios de contenido: solo se movió y se agregó 'export'.
//  Lo que el generador lee del perfil y del grupo de la educadora.
// ============================================================
import { CICLO_ESCOLAR_ACTIVO } from '@/lib/calendarioEscolar'

export async function obtenerTrayectoriaPDA(supabaseAdmin: any, userId: string): Promise<string> {
  if (!userId) return ''
  try {
        const { data, error } = await supabaseAdmin
      .from('pda_coverage_avanzada')
      .select('campo, contenido, pda_literal, is_primary, covered_on, times_used')
      .eq('user_id', userId)
      .eq('ciclo_escolar', CICLO_ESCOLAR_ACTIVO)
      .order('times_used', { ascending: false })
      .order('covered_on', { ascending: false })
      .limit(12)

    if (error || !data || data.length === 0) return ''

    return data.map((r: any) => {
      const tipo = r.is_primary ? 'principal' : 'transversal'
      const repeticion = r.times_used > 1 ? ` — ya trabajado ${r.times_used} veces con este grupo` : ''
      return `- [${r.campo}] (${tipo}${repeticion}): ${r.pda_literal}`
    }).join('\n')
  } catch (e) {
    console.error('No se pudo obtener la trayectoria de PDA (no crítico):', e)
    return ''
  }
}

// [Saneado 27 sep 2026 — Fase 1, NEE] Grupo del ciclo activo desde
// alumnos_codigo (un solo código AL-XX por niño; se retiran las
// iniciales de users.alumnos_inclusion).
//   roster    → lista para rúbricas, en orden de código, con las marcas
//               "(baja)" y "(alta 15 oct)" (criterio del fundador).
//   conApoyos → alumnos ACTIVOS con apoyos CONFIRMADOS por la educadora
//               (misma forma { codigo, acciones } que espera el prompt).
export type GrupoAlumnos = { roster: string[]; conApoyos: { codigo: string; acciones: string }[] }

function numeroCodigoAlumno(codigo: string): number {
  const m = String(codigo || '').match(/^AL-(\d+)$/)
  return m ? parseInt(m[1], 10) : 0
}

export async function obtenerGrupoAlumnos(supabaseAdmin: any, userId: string): Promise<GrupoAlumnos> {
  const vacio: GrupoAlumnos = { roster: [], conApoyos: [] }
  if (!userId) return vacio
  try {
    const { data, error } = await supabaseAdmin
      .from('alumnos_codigo')
      .select('codigo, activo, fecha_alta, requiere_apoyos, apoyos')
      .eq('user_id', userId)
      .eq('ciclo_escolar', CICLO_ESCOLAR_ACTIVO)

    if (error || !data) return vacio
    const todos = [...data].sort((a: any, b: any) => numeroCodigoAlumno(a.codigo) - numeroCodigoAlumno(b.codigo))
    const inicioGrupo: string | null = todos.reduce(
      (min: string | null, a: any) => (!min || a.fecha_alta < min ? a.fecha_alta : min),
      null
    )
    const roster = todos.map((a: any) => {
      if (!a.activo) return `${a.codigo} (baja)`
      if (inicioGrupo && a.fecha_alta > inicioGrupo) {
        const fecha = new Date(a.fecha_alta + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })
        return `${a.codigo} (alta ${fecha})`
      }
      return a.codigo
    })
    const conApoyos = todos
      .filter((a: any) => a.activo && a.requiere_apoyos && typeof a.apoyos === 'string' && a.apoyos.trim())
      .map((a: any) => ({ codigo: a.codigo, acciones: a.apoyos.trim() }))
    return { roster, conApoyos }
  } catch (e) {
    console.error('No se pudo obtener el grupo de alumnos (no crítico):', e)
    return vacio
  }
}

function limpiarAlertaTono(texto: string): string {
  return texto.replace(/^(CR[IÍ]TICO|URGENTE|ALERTA)\s*[:\-]?\s*/i, '').trim()
}

export function obtenerPrioridadesPedagogicas(profile: any): string {
  const evalInd = profile?.evaluacion_individual
  const pdasGrupo: string[] = Array.isArray(evalInd?.pdas_prioritarios_grupo)
    ? evalInd.pdas_prioritarios_grupo.map((p: any) => (typeof p === 'string' ? p : p?.pda)).filter(Boolean)
    : []
  const alertasCrudas: string[] = Array.isArray(evalInd?.alertas) ? evalInd.alertas : []
  const alertasSuaves = alertasCrudas.map(limpiarAlertaTono).filter(Boolean)

  const pdasDiagnosticoGrupal: string[] = Array.isArray(profile?.pdas_prioritarios)
    ? profile.pdas_prioritarios.map((p: any) => {
        const texto = typeof p === 'string' ? p : p?.pda
        const justificacion = typeof p === 'object' ? p?.justificacion : ''
        return texto ? (justificacion ? `${texto} (${justificacion})` : texto) : ''
      }).filter(Boolean)
    : []

  const contextoSocial: string = profile?.diagnostico_escolar?.contexto_social || ''

  const pdasJardinRaw = profile?.pdas_jardin
  const pdasJardinLista = !Array.isArray(pdasJardinRaw) && Array.isArray(pdasJardinRaw?.pdas)
    ? pdasJardinRaw.pdas
    : (Array.isArray(pdasJardinRaw) ? pdasJardinRaw : [])
  const pdasJardinTexto: string[] = pdasJardinLista.map((p: any) => (typeof p === 'string' ? p : p?.pda)).filter(Boolean)

  if (pdasGrupo.length === 0 && alertasSuaves.length === 0 && pdasDiagnosticoGrupal.length === 0 && !contextoSocial && pdasJardinTexto.length === 0) return ''

  let bloque = ''
  if (pdasGrupo.length > 0 || alertasSuaves.length > 0 || pdasDiagnosticoGrupal.length > 0 || contextoSocial) {
    bloque += `1er orden — Necesidad del alumno + contexto comunitario (máxima prioridad; la NEM 2022 exige combinar ambos para una planeación precisa):\n`
    if (pdasGrupo.length > 0) bloque += pdasGrupo.map(p => `- Necesidad de aprendizaje detectada (evaluación individual): ${p}`).join('\n') + '\n'
    if (alertasSuaves.length > 0) bloque += alertasSuaves.map(a => `- Necesidad de apoyo: ${a}`).join('\n') + '\n'
    if (pdasDiagnosticoGrupal.length > 0) bloque += pdasDiagnosticoGrupal.map(p => `- Prioridad del diagnóstico grupal: ${p}`).join('\n') + '\n'
    if (contextoSocial) bloque += `- Contexto comunitario del grupo: ${contextoSocial}\n`
  }
  if (pdasJardinTexto.length > 0) {
    bloque += `\n2do orden — PDAs acordados por el colectivo del jardín (complementario, nunca sustituye al 1er orden):\n`
    bloque += pdasJardinTexto.slice(0, 8).map((p: string) => `- ${p}`).join('\n')
  }
  return bloque.trim()
}

export function obtenerRetroalimentacionDireccion(profile: any): string {
  const obs = profile?.observaciones_directivo
  if (!obs) return ''
  const instruccion: string = obs.instruccion_para_agente || ''
  const aspectosFuertes: string[] = Array.isArray(obs.aspectos_fuertes) ? obs.aspectos_fuertes : []
  if (!instruccion && aspectosFuertes.length === 0) return ''
  let texto = instruccion ? instruccion.trim() : ''
  if (aspectosFuertes.length > 0) {
    texto += (texto ? '\n' : '') + `Aspectos que ya funcionan bien y conviene mantener: ${aspectosFuertes.join(', ')}.`
  }
  return texto
}

export function obtenerEstiloNarrativo(profile: any): string {
  const estilo = profile?.estilo_narrativo
  if (!estilo) return ''
  const instruccion: string = estilo.instruccion_para_agente || ''
  if (instruccion) return instruccion.trim()
  const partes: string[] = []
  if (estilo.tono) partes.push(`Tono: ${estilo.tono}`)
  if (estilo.vocabulario) partes.push(`Vocabulario: ${estilo.vocabulario}`)
  if (Array.isArray(estilo.caracteristicas) && estilo.caracteristicas.length > 0) {
    partes.push(`Características: ${estilo.caracteristicas.join(', ')}`)
  }
  return partes.join(' | ')
}
