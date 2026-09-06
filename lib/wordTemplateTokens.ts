// ============================================================
//  PlanIA Digital — lib/wordTemplateTokens.ts
//  Fuente ÚNICA de verdad para el diseño del Word exportado.
//
//  REGLA DE ORO: ninguna función que construya el documento
//  debe escribir un color, tamaño, margen o borde "a mano".
//  Todo se importa de aquí. Si algo se ve mal, se corrige UNA
//  vez en este archivo y se arregla en TODAS las planeaciones
//  futuras — nunca se parcha caso por caso.
//
//  Sistema: "Institucional Índigo"
//  Confirmado con Alfredo, sep 2026.
// ============================================================

// ------------------------------------------------------------
// 1. PÁGINA
// ------------------------------------------------------------
// Todas las medidas de página/margen están en DXA (twips).
// 1 pulgada = 1440 DXA. 1 cm ≈ 567 DXA.

export const PAGINA = {
  // Carta horizontal (landscape). V1 del lanzamiento.
  // La variante vertical (fase 2 post-lanzamiento) tendrá su
  // PROPIO objeto PAGINA_VERTICAL — no reutilizar este.
  ancho: 15840,   // 11"
  alto: 12240,    // 8.5"

  // OJO: nombres en inglés (top/bottom/left/right) porque este
  // objeto se pasa TAL CUAL a la propiedad `margin` de docx —
  // no traducir, o vuelve a tronar el tipo IPageMarginAttributes.
  margenes: {
    top: 1000,     // 0.694"
    bottom: 1000,
    left: 1000,
    right: 1000,
  },
} as const;

// ------------------------------------------------------------
// 2. PALETA DE COLOR (hex sin #, formato que pide docx)
// ------------------------------------------------------------

export const COLOR = {
  // Paleta oficial de marca (ya usada en toda la app)
  indigo: '3D3A8C',
  indigoClaro: 'EEEDF8',
  cian: '00A896',
  menta: 'E8F5F2',
  negroAzulado: '1A1A2E',
  grisSuave: '8A8AA3',
  blanco: 'FFFFFF',

  // Semáforo de rúbricas — Opción A, validada visualmente sep 2026.
  // SOLO se usa dentro de las tablas de Rúbrica/Escala Estimativa.
  // Nunca reutilizar estos 3 colores en ninguna otra parte del
  // documento ni de la app (quedan reservados a ese contexto).
  logradoFondo: 'D4EDDA',
  logradoTexto: '2D6A4F',
  procesoFondo: 'FFF3CD',
  procesoTexto: '8A6D1D',
  apoyoFondo: 'F8D7DA',
  apoyoTexto: '8B3A3E',
} as const;

// ------------------------------------------------------------
// 3. TIPOGRAFÍA
// ------------------------------------------------------------

export const FUENTE = {
  titulo: 'Trebuchet MS',   // encabezados, etiquetas, bandas
  cuerpo: 'Calibri',        // texto corrido, contenido
} as const;

// Escala de tamaños ÚNICA. Todo tamaño de letra del documento
// debe ser uno de estos 6 valores — no se inventan tamaños
// intermedios ("19.5"). Valores en medios-puntos (así los pide
// docx: size:20 = 10pt).
export const TAMANO = {
  xs: 15,    // 7.5pt — pie de página, número de página, fino
  sm: 17,    // 8.5pt — encabezados de tabla angostos, etiquetas pequeñas
  base: 20,  // 10pt  — texto de cuerpo, contenido de celdas
  md: 22,    // 11pt  — subtítulos (nombre del proyecto), texto destacado
  lg: 26,    // 13pt  — banda de Momento/Día
  xl: 40,    // 20pt  — título del documento (H1, una sola vez)
} as const;

// ------------------------------------------------------------
// 4. BORDES
// ------------------------------------------------------------
// "size" de borde en docx está en octavos de punto (2 = 0.25pt).

export const BORDE = {
  // Borde estándar de cualquier tabla de datos (rúbricas, ejes, etc.)
  estandarGrosor: 2,
  estandarColor: COLOR.grisSuave,

  // Línea fina decorativa (separador de header/footer)
  finaGrosor: 4,
  finaColor: COLOR.indigoClaro,

  // Borde izquierdo grueso de la caja de Ajustes Razonables
  acentoGrosor: 32,   // 4pt
  acentoColor: COLOR.indigo,
} as const;

// ------------------------------------------------------------
// 5. ESPACIADO INTERNO DE CELDA (márgenes de TableCell, en DXA)
// ------------------------------------------------------------
// Igual que con tamaños de fuente: solo 3 variantes, nunca
// números sueltos por celda.

export const RELLENO_CELDA = {
  compacto: { top: 70, bottom: 70, left: 100, right: 100 },   // tablas densas (escala estimativa)
  normal:   { top: 100, bottom: 100, left: 120, right: 120 }, // tablas estándar (rúbrica, ejes)
  amplio:   { top: 160, bottom: 160, left: 240, right: 240 }, // bandas, cajas destacadas (Momento, Ajustes)
} as const;

// ------------------------------------------------------------
// 6. REGLAS DE COMPORTAMIENTO (no son estilos, son reglas fijas
//    de estructura — documentadas aquí para que quien programe
//    el endpoint real no las reinvente ni las omita)
// ------------------------------------------------------------

export const REGLAS = {
  // Cada fila de "día" dentro de una tabla de Momento NUNCA se
  // parte entre páginas. OJO: en la librería `docx`, esto se logra
  // con `cantSplit: true` en la TableRow — la semántica es la
  // inversa de lo intuitivo (true = NO se puede partir).
  filaDiaCantSplit: true,

  // El encabezado de columnas (Fecha|Actividades|Ajustes|...)
  // se define UNA vez por Momento con `tableHeader: true` —
  // Word/docx lo repite automáticamente en saltos de página,
  // nunca se duplica manualmente por día.
  encabezadoMomentoTableHeader: true,

  // Presupuesto de caracteres por día (calibrado empíricamente,
  // ver bitácora sep 2026). Total recomendado: ~3000.
  presupuestoCaracteresPorDia: {
    inicio: [450, 500],
    desarrollo: [550, 600],
    cierre: [350, 400],
    ajustePorItem: [300, 400],   // x2-3 ajustes típicos por día
    actividadComplementaria: [250, 300],
    recursos: [250, 300],
  },

  // Saltos de página fijos (los únicos 2 forzados en todo el doc):
  //   1) entre Bloque 1 (institucional/pedagógico) y Bloque 2 (Momento 1)
  //   2) entre el final del Bloque 2 y el inicio del Bloque 3 (cierre)
  // Entre días consecutivos dentro de una misma fase: NUNCA forzar,
  // dejar fluir continuo.
  saltosPagina: ['bloque1_a_bloque2', 'bloque2_a_bloque3'],

  // Cada rúbrica por PDA inicia en salto de página propio y
  // nunca comparte hoja con la rúbrica anterior.
  rubricaSaltoPaginaPropio: true,
} as const;