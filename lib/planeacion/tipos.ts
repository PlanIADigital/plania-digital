// ============================================================
//  PlanIA Digital — lib/planeacion/tipos.ts
//  [Saneado 27 sep 2026 — Fase 2] Separado de app/api/generar-planeacion/route.ts
//  SIN cambios de contenido: solo se movió y se agregó 'export'.
//  Tipos compartidos entre el generador y sus módulos.
// ============================================================
import type { DiaHabil } from '@/lib/calendarioEscolar'

export type DiaConMomento = DiaHabil & { momento: string; numeroGlobal: number }
export type DiaGenerado = {
  numero: number
  momento_modalidad: string
  inicio: string
  desarrollo: string
  cierre: string
  materiales: string
  actividad_complementaria: string
}
export type AjusteDia = { numero: number; codigo: string; ajuste: string }
