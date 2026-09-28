// ============================================================
//  PlanIA Digital — lib/estilosAprendizaje.ts
//  [Saneado 28 sep 2026 — Fase 2, Parte 10] Resumen de los estilos de
//  aprendizaje del GRUPO (tarjeta 3.3 de Mi Grupo) en texto, para MÍA
//  (generadores.ts) y para la pantalla "Creando tu planeación".
//  Solo se usa si es del ciclo activo. Nunca hay datos por niño.
// ============================================================
import { CICLO_ESCOLAR_ACTIVO } from '@/lib/calendarioEscolar'

type Estilos = { kinestesico?: number; visual?: number; auditivo?: number; ciclo_escolar?: string }

const NOMBRES: Record<'kinestesico' | 'visual' | 'auditivo', string> = {
  kinestesico: 'kinestésico',
  visual: 'visual',
  auditivo: 'auditivo',
}

export function estiloPredominante(estilos: unknown): { estilo: string; porcentaje: number } | null {
  const e = estilos as Estilos | null
  if (!e || (e.ciclo_escolar && e.ciclo_escolar !== CICLO_ESCOLAR_ACTIVO)) return null
  const lista = (['kinestesico', 'visual', 'auditivo'] as const).map(k => ({ k, n: Number(e[k]) || 0 }))
  const total = lista.reduce((s, x) => s + x.n, 0)
  if (total <= 0) return null
  const mayor = [...lista].sort((a, b) => b.n - a.n)[0]
  return { estilo: NOMBRES[mayor.k], porcentaje: Math.round((mayor.n / total) * 100) }
}

// Ej.: "mayormente kinestésico (83 %); visual 8 %, auditivo 8 %"
export function resumenEstilosGrupo(estilos: unknown): string {
  const e = estilos as Estilos | null
  const pred = estiloPredominante(e)
  if (!e || !pred) return ''
  const lista = (['kinestesico', 'visual', 'auditivo'] as const).map(k => ({ k, n: Number(e[k]) || 0 }))
  const total = lista.reduce((s, x) => s + x.n, 0)
  const resto = lista
    .filter(x => NOMBRES[x.k] !== pred.estilo)
    .map(x => `${NOMBRES[x.k]} ${Math.round((x.n / total) * 100)} %`)
    .join(', ')
  return `mayormente ${pred.estilo} (${pred.porcentaje} %); ${resto}`
}
