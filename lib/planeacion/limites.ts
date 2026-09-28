// ============================================================
//  PlanIA Digital — lib/planeacion/limites.ts
//  [Saneado 27 sep 2026 — Fase 2] Separado de app/api/generar-planeacion/route.ts
//  SIN cambios de contenido: solo se movió y se agregó 'export'.
//  Límites de caracteres, recorte y validación de la respuesta del modelo.
// ============================================================
import type { AjusteDia, DiaGenerado } from './tipos'

// Límites de caracteres por campo -- deben coincidir con las cifras que le
// pedimos al modelo en R6 (SYSTEM_PROMPT_DIAS) y en SYSTEM_PROMPT_CIERRE.
// Esto es la RED DE SEGURIDAD: el modelo casi siempre respeta el rango
// pedido en el prompt, pero los LLM no son 100% precisos con conteos
// exactos -- si se excede, se recorta aquí antes de guardar la planeación.
const LIMITES_CARACTERES: Partial<Record<keyof DiaGenerado, number>> = {
  inicio: 600,
  desarrollo: 1100,
  cierre: 500,
  actividad_complementaria: 300,
  materiales: 300,
}
const LIMITE_AJUSTE = 400

// Recorta al punto/exclamación/pregunta más cercano ANTES del límite, nunca
// a media palabra. Si no hay un cierre de oración razonable cerca (más de
// la mitad del límite), recorta a la última palabra completa en su lugar.
export function recortarAlLimite(texto: string, limite: number): string {
  if (!texto || texto.length <= limite) return texto
  const cortado = texto.slice(0, limite)
  const ultimoCierre = Math.max(
    cortado.lastIndexOf('.'),
    cortado.lastIndexOf('!'),
    cortado.lastIndexOf('?')
  )
  if (ultimoCierre > limite * 0.5) {
    return cortado.slice(0, ultimoCierre + 1)
  }
  const ultimoEspacio = cortado.lastIndexOf(' ')
  const base = ultimoEspacio > 0 ? cortado.slice(0, ultimoEspacio) : cortado
  return base.trim() + '...'
}

export function validarDiaCompleto(dia: DiaGenerado): DiaGenerado {
  const camposObligatorios: (keyof DiaGenerado)[] = ['momento_modalidad', 'inicio', 'desarrollo', 'cierre', 'materiales']
  for (const campo of camposObligatorios) {
    const valor = dia[campo]
    if (!valor || String(valor).trim() === '') {
      console.error(`⚠️ CAMPO OBLIGATORIO FALTANTE — día ${dia.numero}, campo "${campo}" vino vacío u omitido por el modelo.`)
      if (campo === 'materiales') {
        dia.materiales = '[No se generó este campo correctamente — revisa y completa los materiales de este día antes de usarlo.]'
      } else {
        (dia as any)[campo] = `[Este campo no se generó correctamente — por favor regenera esta planeación o edítalo manualmente antes de usarla.]`
      }
    }
  }
  if (dia.actividad_complementaria === undefined || dia.actividad_complementaria === null) {
    dia.actividad_complementaria = ''
  }

  // Red de seguridad: recorta cualquier campo que se haya excedido del límite
  for (const campo of Object.keys(LIMITES_CARACTERES) as (keyof DiaGenerado)[]) {
    const limite = LIMITES_CARACTERES[campo]
    const valor = dia[campo]
    if (limite && valor && String(valor).length > limite) {
      console.error(`✂️ RECORTE AUTOMÁTICO — día ${dia.numero}, campo "${campo}" vino con ${String(valor).length} caracteres (límite ${limite}), se recortó.`)
      ;(dia as any)[campo] = recortarAlLimite(String(valor), limite)
    }
  }

  return dia
}

export function validarAjustesCompletos(
  ajustes: AjusteDia[],
  totalDias: number,
  alumnosInclusion: { codigo: string }[]
): AjusteDia[] {
  // Red de seguridad: recorta cualquier ajuste que se haya excedido del límite
  for (const a of ajustes) {
    if (a.ajuste && a.ajuste.length > LIMITE_AJUSTE) {
      console.error(`✂️ RECORTE AUTOMÁTICO — ajuste día ${a.numero}, código "${a.codigo}" vino con ${a.ajuste.length} caracteres (límite ${LIMITE_AJUSTE}), se recortó.`)
      a.ajuste = recortarAlLimite(a.ajuste, LIMITE_AJUSTE)
    }
  }
  if (!alumnosInclusion || alumnosInclusion.length === 0) return ajustes
  const resultado = [...ajustes]
  for (let numero = 1; numero <= totalDias; numero++) {
    for (const alumno of alumnosInclusion) {
      const yaExiste = resultado.some(a => a.numero === numero && a.codigo === alumno.codigo)
      if (!yaExiste) {
        console.error(`⚠️ AJUSTE FALTANTE — día ${numero}, alumno "${alumno.codigo}" no vino en la respuesta del modelo.`)
        resultado.push({
          numero,
          codigo: alumno.codigo,
          ajuste: `${alumno.codigo}.- [No se generó el ajuste de este día para este alumno — revísalo y complétalo manualmente antes de usar la planeación.]`,
        })
      }
    }
  }
  return resultado
}

export const LIMITE_DESCRIPCION_CIERRE = 300
