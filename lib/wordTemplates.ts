// ============================================================
//  PlanIA Digital — Configuración de plantillas de exportación a Word
//  lib/wordTemplates.ts
//
//  Dos plantillas, mismo contenido y estructura, distinta vestimenta
//  visual. Decisiones de diseño confirmadas con Alfredo (ago 2026):
//  - Tablas SIEMPRE con cuadrícula completa (Bety/ATP: claridad
//    de conceptos importa más que minimalismo visual)
//  - Fuentes clásicas de Word (máxima compatibilidad, sin necesidad
//    de incrustar fuentes)
//  - Página tamaño Carta (estándar escolar/oficial en México)
//  - Pie de página discreto con marca PlanIA + número de página
//    (validado con feedback de una directora real: mostrar la marca
//    no resta seriedad, refuerza que el documento viene de una
//    herramienta profesional)
// ============================================================

export type EstiloPlantilla = 'institucional' | 'clasica'

export interface ConfigPlantilla {
  id: EstiloPlantilla
  nombre: string
  descripcion: string
  fuente: string
  colorPrincipal: string // hex SIN el '#' — así lo pide la librería docx
  colorAcento: string
  colorTexto: string
}

export const PLANTILLAS: Record<EstiloPlantilla, ConfigPlantilla> = {
  institucional: {
    id: 'institucional',
    nombre: 'Institucional Índigo',
    descripcion: 'Calibri, con los colores de marca PlanIA Digital',
    fuente: 'Calibri',
    colorPrincipal: '3D3A8C',
    colorAcento: '00A896',
    colorTexto: '1A1A2E',
  },
  clasica: {
    id: 'clasica',
    nombre: 'Clásica Serif',
    descripcion: 'Georgia, tono más sobrio y editorial',
    fuente: 'Georgia',
    colorPrincipal: '1A1A2E',
    colorAcento: '3D3A8C',
    colorTexto: '1A1A2E',
  },
}

// Espaciados y tamaños compartidos por ambas plantillas — solo cambia
// color/fuente, no la estructura ni las medidas.
export const MEDIDAS = {
  tituloProyecto: 32, // pt * 2, la librería docx usa "half-points"
  tituloSeccion: 26,
  subtitulo: 22,
  cuerpo: 22,
  piePagina: 16,
  margenPaginaTwips: 1440, // 1 pulgada, formato "twips" que usa docx
}