import { obtenerSchoolYearId } from '@/lib/schoolYear'
import { NextRequest, NextResponse } from 'next/server'
import { obtenerCalendarioEstatal, calcularDiasHabiles, type DiaHabil, CICLO_ESCOLAR_ACTIVO } from '@/lib/calendarioEscolar'
import { verificarUsuario } from '@/lib/verificarUsuario'
import { fechaLocalISO, zonaHorariaPorCCT } from '@/lib/fechaMexico'
// [Saneado 27 sep 2026 — Fase 2] Prompts, límites, contexto y llamadas a MÍA
// viven en lib/planeacion/ (movidos sin cambios). Aquí queda solo el flujo.
import type { AcumuladorCosto } from '@/lib/planeacion/costos'
import type { DiaConMomento, DiaGenerado } from '@/lib/planeacion/tipos'
import {
  obtenerEstiloNarrativo,
  obtenerGrupoAlumnos,
  obtenerSemaforoGrupo,
  obtenerPrioridadesPedagogicas,
  obtenerRetroalimentacionDireccion,
  obtenerTrayectoriaPDA,
} from '@/lib/planeacion/contexto'
import {
  generarAjustesPorDia,
  generarDescripcionEje,
  generarDescripcionEvaluacionFormativa,
  generarLoteDeDias,
  generarUnaRubrica,
} from '@/lib/planeacion/generadores'

const MAX_DIAS_POR_LOTE = 2

const MOMENTOS_MODALIDAD: Record<string, { momentos: string[]; desarrollo: number }> = {
  'Proyectos': { momentos: ['Punto de partida', 'Planeación', '¡A trabajar!', 'Comunicamos nuestros logros', 'Reflexionar sobre el aprendizaje'], desarrollo: 2 },
  'ABJ': { momentos: ['Planteamiento del juego', 'Desarrollo de las actividades', 'Compartimos la experiencia', 'Comunidad de juego'], desarrollo: 1 },
  'Taller crítico': { momentos: ['Situación inicial', 'Puesta en marcha', 'Valoramos lo aprendido', 'Reflexión'], desarrollo: 1 },
  'Rincones': { momentos: ['Asamblea inicial y planeación', 'Exploración de los rincones', 'Compartimos lo aprendido', 'Reflexión sobre el aprendizaje'], desarrollo: 1 },
  'Centros de interés': { momentos: ['Contacto con la realidad', 'Identificación e integración', 'Expresión'], desarrollo: 1 },
  'Unidad didáctica': { momentos: ['Lectura de la realidad', 'Identificación de la trama y complejidad', 'Planificación y organización', 'Exploración y descubrimiento', 'Participación activa y horizontal', 'Valoración de la experiencia'], desarrollo: 2 },
}

async function actualizarProgreso(
  supabaseAdmin: any,
  jobId: string | undefined,
  cambios: Partial<{
    total_lotes: number
    lotes_completados: number
    fase_actual: string
    estado: string
    error_mensaje: string
    fases_lotes: string[]
    planning_id: string
  }>
) {
  if (!jobId) return
  try {
    await supabaseAdmin
      .from('generacion_progreso')
      .update({ ...cambios, actualizado_en: new Date().toISOString() })
      .eq('job_id', jobId)
  } catch (e) {
    console.error('No se pudo actualizar el progreso (no crítico):', e)
  }
}

export const maxDuration = 700;
export async function POST(request: NextRequest) {
  let supabaseAdmin: any = null
  let jobId: string | undefined = undefined
  const acumuladorCosto: AcumuladorCosto = { total: 0 }

  try {
        // [sep 2026, saneamiento Fase 0] Identidad verificada en el SERVIDOR.
    // Antes el navegador mandaba el `profile` completo y se le creía todo
    // (incluido profile.id, usado como user_id al guardar). Ahora el
    // navegador solo manda el formulario + su token de sesión; el perfil
    // se lee de la base de datos con el id VERIFICADO, y se revisa la
    // membresía ANTES de gastar un solo token de Anthropic.
    const auth = await verificarUsuario(request)
    if (!auth.autorizado) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }
    supabaseAdmin = auth.supabaseAdmin

    const { data: profile, error: errorPerfil } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', auth.usuario.id)
      .single()
    if (errorPerfil || !profile) {
      return NextResponse.json({ error: 'No se encontró tu perfil.' }, { status: 403 })
    }

    const MEMBRESIAS_CON_ACCESO = ['trial', 'active', 'founder']
    if (!MEMBRESIAS_CON_ACCESO.includes(profile.membership_status)) {
      return NextResponse.json(
        { error: 'Tu membresía no está activa. Puedes seguir consultando y descargando tus planeaciones anteriores; para generar nuevas, renueva tu membresía.' },
        { status: 403 }
      )
    }

    // [Saneado 27 sep 2026 — Fase 2] Grado y grupo obligatorios: sin ellos MÍA
    // calibraría la planeación para un grado supuesto (antes '2°').
    if (!profile.grado || !profile.grupo_letra) {
      return NextResponse.json(
        { error: 'Primero configura tu grupo (grado y grupo) en Mi Grupo.' },
        { status: 400 }
      )
    }

    const { form, job_id } = await request.json()
    jobId = job_id

    // [sep 2026, saneamiento Fase 0] Regla de negocio: solo se puede planear
    // desde el INICIO del ciclo de membresía actual (v_estado_cuenta.ciclo_inicio),
    // nunca antes. Se revisa ANTES de cualquier llamada a Anthropic. Si la
    // consulta falla, se bloquea (500); si ciclo_inicio viene vacío, la fecha
    // mínima es hoy — misma regla de respaldo que la pantalla. Las fechas se
    // comparan como YYYY-MM-DD en la zona horaria del CCT (lib/fechaMexico.ts).
    const zonaHoraria = zonaHorariaPorCCT(profile.cct_primary)
    const { data: estadoCuenta, error: errorEstadoCuenta } = await supabaseAdmin
      .from('v_estado_cuenta')
      .select('ciclo_inicio')
      .eq('auth_uid', profile.auth_uid)
      .single()
    if (errorEstadoCuenta || !estadoCuenta) {
      const msg = 'No se pudo verificar tu ciclo de membresía. Intenta de nuevo en un momento.'
      await actualizarProgreso(supabaseAdmin, jobId, {
        estado: 'error',
        error_mensaje: msg,
        fase_actual: 'No se pudo verificar tu ciclo de membresía.',
      })
      return NextResponse.json({ error: msg }, { status: 500 })
    }
    const fechaMinimaPlaneacion =
      fechaLocalISO(estadoCuenta.ciclo_inicio, zonaHoraria) || fechaLocalISO(new Date(), zonaHoraria)
    const fechaInicioPlaneacion = fechaLocalISO(form?.fecha_inicio, zonaHoraria)
    if (!fechaInicioPlaneacion || !fechaMinimaPlaneacion || fechaInicioPlaneacion < fechaMinimaPlaneacion) {
      const msg = 'Solo puedes planear desde el inicio de tu ciclo de membresía actual.'
      await actualizarProgreso(supabaseAdmin, jobId, {
        estado: 'error',
        error_mensaje: msg,
        fase_actual: msg,
      })
      return NextResponse.json({ error: msg }, { status: 400 })
    }

    if (jobId) {
      await actualizarProgreso(supabaseAdmin, jobId, {
        fase_actual: 'Leyendo el calendario y el contexto de tu grupo...',
        estado: 'en_progreso',
      })
    }

    const estadoCodigo = (profile.cct_primary || '').slice(0, 2)
    const calDatos = await obtenerCalendarioEstatal(supabaseAdmin, estadoCodigo, CICLO_ESCOLAR_ACTIVO)

    const trayectoriaPDA = await obtenerTrayectoriaPDA(supabaseAdmin, profile?.id, estadoCodigo)
    const prioridadesPedagogicas = obtenerPrioridadesPedagogicas(profile)
    // [2 oct 2026] Semáforo de desempeño (solo códigos) para calibrar actividades.
    const semaforoGrupo = await obtenerSemaforoGrupo(supabaseAdmin, profile.id)
    const retroalimentacionDireccion = obtenerRetroalimentacionDireccion(profile)
    const estiloNarrativo = obtenerEstiloNarrativo(profile)

    const todosDias = calcularDiasHabiles(calDatos, form.fecha_inicio, form.fecha_fin)
    const diasHabiles = todosDias.filter(d => !d.esCTE && !d.motivo)
    const diasCTE = todosDias.filter(d => d.esCTE)
    const diasInhabiles = todosDias.filter(d => d.motivo && !d.esCTE)

    const config = MOMENTOS_MODALIDAD[form.metodologia] || MOMENTOS_MODALIDAD['Proyectos']
    const momentos = config.momentos
    const idxDesarrollo = config.desarrollo

    if (diasHabiles.length < momentos.length) {
      const diasExcluidos = todosDias.length - diasHabiles.length
      let msg = `Tu periodo solo tiene ${diasHabiles.length} día(s) hábil(es) dentro del ciclo escolar activo, pero la modalidad "${form.metodologia}" necesita mínimo ${momentos.length} día(s) — uno por cada fase (${momentos.join(', ')}). Ajusta las fechas para que abarquen más días hábiles dentro del ciclo, o elige una modalidad con menos fases.`
      if (diasExcluidos > 0) {
        msg += ` (De los días que elegiste, ${diasExcluidos} cayeron fuera del ciclo escolar o son inhábiles/CTE.)`
      }
      if (jobId) {
        await actualizarProgreso(supabaseAdmin, jobId, {
          estado: 'error',
          error_mensaje: msg,
          fase_actual: 'No hay suficientes días hábiles para esta modalidad.',
        })
      }
      return NextResponse.json({ error: msg }, { status: 400 })
    }

    const diasFijos = momentos.length - 1
    const diasDesarrollo = Math.max(1, diasHabiles.length - diasFijos)

    let diaIdx = 0
    const distribucion: { momento: string; dias: DiaHabil[] }[] = []
    for (let i = 0; i < momentos.length; i++) {
      if (i === idxDesarrollo) {
        distribucion.push({ momento: momentos[i], dias: diasHabiles.slice(diaIdx, diaIdx + diasDesarrollo) })
        diaIdx += diasDesarrollo
      } else {
        distribucion.push({ momento: momentos[i], dias: diasHabiles.slice(diaIdx, diaIdx + 1) })
        diaIdx += 1
      }
    }

    let numeroGlobal = 1
    const diasConMomento: DiaConMomento[] = []
    for (const seg of distribucion) {
      for (const d of seg.dias) {
        diasConMomento.push({ ...d, momento: seg.momento, numeroGlobal: numeroGlobal++ })
      }
    }

    const lotes: DiaConMomento[][] = []
    {
      let i = 0
      while (i < diasConMomento.length) {
        const lote: DiaConMomento[] = []
        while (i < diasConMomento.length && lote.length < MAX_DIAS_POR_LOTE) {
          lote.push(diasConMomento[i])
          i++
        }
        lotes.push(lote)
      }
    }

    const lotesMomentos: string[] = lotes.map(lote => lote[0]?.momento || '')

    if (jobId) {
      await actualizarProgreso(supabaseAdmin, jobId, {
        total_lotes: lotes.length + 1,
        lotes_completados: 0,
        fase_actual: `Preparando ${diasHabiles.length} días de tu planeación...`,
        fases_lotes: lotesMomentos,
      })
    }

    const transversalesTexto = form.transversales?.length > 0
      ? form.transversales.map((t: any, i: number) => `Transversal ${i+1}: ${t.campo} > ${t.contenido}\nPDA: ${t.pda}`).join('\n\n')
      : 'No se definieron campos transversales.'

    const recursosTexto = form.recursos_materiales
      ? `RECURSOS INDICADOS POR LA DIRECTORA: ${form.recursos_materiales} — integrarlos en al menos una actividad.`
      : ''

    let todasLasDiasGeneradas: DiaGenerado[] = []
    let contextoPrevio = ''
    let materialesUsados: string[] = []
    let loteNum = 0

    for (const lote of lotes) {
      loteNum++
      const esUltimoLote = loteNum === lotes.length
      const primerDia = lote[0]?.numeroGlobal || 1
      const ultimoDia = lote[lote.length - 1]?.numeroGlobal || primerDia

      if (jobId) {
        await actualizarProgreso(supabaseAdmin, jobId, {
          fase_actual: lotes.length > 1
            ? `Escribiendo los días ${primerDia} al ${ultimoDia} de ${diasHabiles.length}...`
            : `Escribiendo tu planeación completa...`,
        })
      }

            const diasGeneradosLote = await generarLoteDeDias({
        lote,
        form,
        profile,
        transversalesTexto,
        recursosTexto,
        contextoPrevio,
        materialesUsados,
        trayectoriaPDA,
        prioridadesPedagogicas,
        semaforoGrupo,
        retroalimentacionDireccion,
        estiloNarrativo,
        esUltimoLote,
        acumuladorCosto,
      })

      todasLasDiasGeneradas.push(...diasGeneradosLote)

      const ultimoDiaGenerado = diasGeneradosLote[diasGeneradosLote.length - 1]
      if (ultimoDiaGenerado) {
        contextoPrevio = `En el día anterior (${ultimoDiaGenerado.momento_modalidad}), el cierre fue: "${ultimoDiaGenerado.cierre}"`
        const nuevosMateriales = (ultimoDiaGenerado.materiales || '')
          .split('|')
          .map(m => m.trim())
          .filter(Boolean)
        materialesUsados.push(...nuevosMateriales)
      }

      if (jobId) {
        await actualizarProgreso(supabaseAdmin, jobId, { lotes_completados: loteNum })
      }
    }

    todasLasDiasGeneradas = todasLasDiasGeneradas.map((dia, i) => ({ ...dia, numero: i + 1 }))

    if (jobId) {
      await actualizarProgreso(supabaseAdmin, jobId, {
        fase_actual: 'Construyendo tu rúbrica de evaluación...',
      })
    }

            // [sep 2026] Arma la lista de PDAs activos ANTES de lanzar las llamadas
    // en paralelo — la necesita el bloque de rúbricas de abajo.
    const pdasActivos: { pdaTexto: string; campoFormativo: string; contenido: string; esPrincipal: boolean }[] = [
      { pdaTexto: form.pda_principal, campoFormativo: form.campo_formativo, contenido: form.contenido, esPrincipal: true },
    ]
    if (form.pda_principal_2) {
      pdasActivos.push({
        pdaTexto: form.pda_principal_2,
        campoFormativo: form.campo_formativo,
        contenido: form.pda_principal_2_contenido || form.contenido,
        esPrincipal: true,
      })
    }
    if (form.transversales?.length > 0) {
      for (const t of form.transversales) {
        pdasActivos.push({ pdaTexto: t.pda, campoFormativo: t.campo, contenido: t.contenido, esPrincipal: false })
      }
    }
    const ejesTexto = [form.eje_principal, form.eje_secundario].filter(Boolean)

    if (jobId) {
      await actualizarProgreso(supabaseAdmin, jobId, {
        fase_actual: pdasActivos.length > 1
          ? 'Construyendo tus rúbricas y la evaluación formativa...'
          : 'Construyendo tu rúbrica y la evaluación formativa...',
      })
    }

    // [sep 2026, Opción A — paralelización] Ajustes por día, cada rúbrica,
    // cada descripción de eje, y la evaluación formativa NO dependen unas
    // de otras — todas solo necesitan la narrativa ya generada
    // (todasLasDiasGeneradas). Antes corrían una tras otra (for...await),
    // sumando varios minutos completos en planeaciones con varios PDA o
    // ejes. Lanzarlas juntas con Promise.all reduce el tiempo total al de
    // la llamada MÁS LENTA del grupo, no a la suma de todas ellas. Los
    // lotes de días (arriba, generarLoteDeDias) siguen siendo secuenciales
    // a propósito — necesitan el contexto del lote anterior para dar
    // continuidad narrativa; eso no se puede paralelizar sin sacrificar
    // calidad, así que esa parte del tiempo total sigue siendo irreducible.
    const grupoAlumnos = await obtenerGrupoAlumnos(supabaseAdmin, profile.id)
    const [ajustes_por_dia, rubricas, ejesFinal, evaluacionFormativa] = await Promise.all([
      generarAjustesPorDia({
        alumnosConApoyos: grupoAlumnos.conApoyos,
        todosLosDias: todasLasDiasGeneradas,
        acumuladorCosto,
      }),
      Promise.all(pdasActivos.map(async (p) => {
        const instrumento = await generarUnaRubrica({
          pdaTexto: p.pdaTexto,
          campoFormativo: p.campoFormativo,
          contenido: p.contenido,
          todosLosDias: todasLasDiasGeneradas,
          acumuladorCosto,
        })
        return { ...instrumento, pda_evaluado: p.pdaTexto, es_principal: p.esPrincipal }
      })),
      Promise.all(ejesTexto.map(async (ejeNombre) => {
        const descripcion = await generarDescripcionEje({
          ejeNombre,
          proyecto: form,
          todosLosDias: todasLasDiasGeneradas,
          acumuladorCosto,
        })
        return { nombre: ejeNombre, descripcion }
      })),
      generarDescripcionEvaluacionFormativa({
        proyecto: form,
        todosLosDias: todasLasDiasGeneradas,
        acumuladorCosto,
      }),
    ])
    const rosterCompleto = grupoAlumnos.roster

    const rubricasConRegistro = rubricas.map(r => ({
      ...r,
      registro_alumnos: rosterCompleto.map(codigo => ({ codigo, nivel_marcado: null })),
    }))

    if (jobId) {
      await actualizarProgreso(supabaseAdmin, jobId, {
        lotes_completados: lotes.length + 1,
        // [Saneado 27 sep 2026] 'completado' se marca solo DESPUÉS de guardar (más
        // abajo, con planning_id); antes la pantalla decía "lista" aunque el
        // guardado todavía pudiera fallar.
        fase_actual: 'Guardando tu planeación...',
      })
    }

    const diasFinal = todasLasDiasGeneradas.map((dia, i) => ({
      ...dia,
      numero: i + 1,
      fecha: diasHabiles[i]?.label || '',
      fecha_iso: diasHabiles[i]?.fecha || '',
    }))

    const planeacion: any = {
      dias: diasFinal,
      instrumentos_evaluacion: rubricasConRegistro,
      ajustes_por_dia,
      ejes: ejesFinal,
      evaluacion_formativa: evaluacionFormativa,
    }

        planeacion.dias_especiales = [
      ...diasCTE.map(d => ({ fecha: d.label, fecha_iso: d.fecha, tipo: 'CTE' })),
      ...diasInhabiles.map(d => ({ fecha: d.label, fecha_iso: d.fecha, tipo: d.motivo || 'Inhábil' }))
    ].sort((a, b) => a.fecha_iso.localeCompare(b.fecha_iso))

    console.error(`💰 Costo total real de esta generación: $${acumuladorCosto.total.toFixed(6)} USD`)

    // [sep 2026, Opción B] Guardado en el SERVIDOR, ya no depende de que
    // el navegador reciba esta respuesta — antes, si la conexión se
    // cortaba después de generar (educadora cambia de pestaña, WiFi
    // inestable, teléfono se bloquea), el trabajo ya pagado en tokens de
    // Anthropic se perdía por completo, sin quedar guardado en ningún
    // lado. Ahora el INSERT ocurre aquí, incondicionalmente, apenas
    // termina de generar — y se avisa por generacion_progreso.planning_id,
    // que el frontend ya está sondeando cada 1.5s para mostrar el avance.
    const transversalesActivos: any[] = Array.isArray(form.transversales) ? form.transversales : []
    const todasPdasSeleccionadas: any[] = Array.isArray(form.pdas_seleccionados) ? form.pdas_seleccionados : []

    const { data: savedData, error: saveError } = await supabaseAdmin.from('plannings').insert({
      user_id: profile.id,
      project_name: form.nombre_proyecto,
      situacion_problema: form.situacion_problema,
      finalidad: form.finalidad,
      metodologia: form.metodologia,
      pda_campo: form.campo_formativo,
      pda_contenido: form.contenido || '',
      pda_literal: form.pda_principal || '',
      pda_id: todasPdasSeleccionadas[0]?.id || null,
      pda_2_contenido: form.pda_principal_2_contenido || null,
      pda_2_pda: form.pda_principal_2 || null,
      pda_2_id: todasPdasSeleccionadas[1]?.id || null,
      pda_2_activo: !!form.pda_principal_2,
      recursos_materiales: form.recursos_materiales || null,
      transversal_1_campo: transversalesActivos[0]?.campo || null,
      transversal_1_contenido: transversalesActivos[0]?.contenido || null,
      transversal_1_pda: transversalesActivos[0]?.pda || null,
      transversal_1_id: transversalesActivos[0]?.id || null,
      transversal_1_activo: !!transversalesActivos[0],
      transversal_2_campo: transversalesActivos[1]?.campo || null,
      transversal_2_contenido: transversalesActivos[1]?.contenido || null,
      transversal_2_pda: transversalesActivos[1]?.pda || null,
      transversal_2_id: transversalesActivos[1]?.id || null,
      transversal_2_activo: !!transversalesActivos[1],
      transversal_3_campo: transversalesActivos[2]?.campo || null,
      transversal_3_contenido: transversalesActivos[2]?.contenido || null,
      transversal_3_pda: transversalesActivos[2]?.pda || null,
      transversal_3_id: transversalesActivos[2]?.id || null,
      transversal_3_activo: !!transversalesActivos[2],
      starts_on: form.fecha_inicio || null,
      ends_on: form.fecha_fin || null,
      duration_days: diasHabiles.length,
      grade: profile.grado,
      content_json: planeacion,
      eje_principal: form.eje_principal || null,
      eje_secundario: form.eje_secundario || null,
      school_year_id: await obtenerSchoolYearId(supabaseAdmin, CICLO_ESCOLAR_ACTIVO),
      ciclo_escolar: CICLO_ESCOLAR_ACTIVO,
      status: 'active',
      costo_generacion_usd: acumuladorCosto.total,
    }).select('id').single()

    if (saveError) {
      console.error('❌ Error al guardar la planeación en el servidor:', saveError)
      if (jobId) {
        await actualizarProgreso(supabaseAdmin, jobId, {
          estado: 'error',
          error_mensaje: 'La planeación se generó pero no se pudo guardar: ' + saveError.message,
          fase_actual: 'Error al guardar.',
        })
      }
      return NextResponse.json({ error: 'La planeación se generó pero no se pudo guardar: ' + saveError.message }, { status: 500 })
    }

    if (savedData?.id && rubricasConRegistro.length > 0) {
      const { error: rubricasError } = await supabaseAdmin.from('rubrics').insert(
        rubricasConRegistro.map((r: any) => ({
          planning_id: savedData.id,
          user_id: profile.id,
          pda_evaluated: r.pda_evaluado,
          content_json: r,
          original_json: r,
          descartada: false,
        }))
      )
      if (rubricasError) {
        console.error('No se pudieron guardar las rúbricas (no crítico, la planeación sí se guardó):', rubricasError)
      }
    }

    if (jobId && savedData?.id) {
      await actualizarProgreso(supabaseAdmin, jobId, {
        estado: 'completado',
        fase_actual: '¡Tu planeación está lista!',
        planning_id: savedData.id,
      })
    }

    return NextResponse.json({ planeacion, costo_generacion_usd: acumuladorCosto.total, planning_id: savedData?.id })

  } catch (error: unknown) {
    console.error('Error en Agente NEM:', error)
    const msg = error instanceof Error ? error.message : String(error)
    if (supabaseAdmin && jobId) {
      await actualizarProgreso(supabaseAdmin, jobId, {
        estado: 'error',
        error_mensaje: msg,
        fase_actual: 'Ocurrió un error al generar tu planeación.',
      })
    }
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}