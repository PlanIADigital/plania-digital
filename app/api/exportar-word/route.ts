// ============================================================
//  PlanIA Digital — Exportar planeación a Word (.docx)
//  app/api/exportar-word/route.ts
//
//  Rediseño sep 2026 (v2): plantilla "Institucional Índigo",
//  UNA sola sección vertical (portrait) de punta a punta — se
//  abandona el diseño horizontal de 6 columnas y la sección
//  aparte para rúbricas. Motivo: el diseño horizontal forzaba
//  `cantSplit` + altura fija por fila, lo que producía headers
//  huérfanos y páginas en blanco desperdiciadas. La tabla de
//  cada día ahora es de 2 columnas (etiqueta | contenido, una
//  fila por Inicio/Desarrollo/Cierre/Ajustes/Complementaria/
//  Recursos) sin `cantSplit` — Word corta la fila sola entre
//  páginas sin repetir el encabezado (confirmado con pruebas
//  reales, sep 2026).
//
//  Bloque 1 = Institucional + Pedagógico (encabezado, proyecto,
//             problemática, propósito, tabla curricular con
//             Indicador, ejes, aspectos curriculares relevantes,
//             evaluación formativa — esta última se movió aquí
//             desde el cierre, sep 2026).
//  Bloque 2 = Cuerpo por Momento (agrupado dinámicamente por
//             dia.momento_modalidad). Todo corre sin saltos de
//             página forzados entre días ni entre Momentos.
//  Bloque 3 = Rúbricas por PDA (Criterio + 3 niveles + lista de
//             alumnos) — cada rúbrica en su propia página, y
//             luego Adecuaciones/PMC/Firmas corren sin salto.
//
//  Puntos de salto de página forzado (únicos en todo el doc):
//    Bloque 1 → Bloque 2 · Bloque 2 → Bloque 3 (1a rúbrica) ·
//    antes de cada rúbrica siguiente a la 1a · después de la
//    última rúbrica, antes de Adecuaciones.
//
//  Ver lib/wordTemplateTokens.ts para toda constante de diseño
//  — este archivo NUNCA debe escribir un color/tamaño/margen a
//  mano.
// ============================================================
import { NextRequest, NextResponse } from 'next/server'
import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, PageNumber, AlignmentType, BorderStyle, WidthType,
  ShadingType, VerticalAlign, PageBreak, TableLayoutType,
} from 'docx'
import { PAGINA, COLOR, FUENTE, TAMANO, RELLENO_CELDA, BORDE } from '@/lib/wordTemplateTokens'

// ------------------------------------------------------------
// Bordes reutilizables (derivados de wordTemplateTokens, no
// números sueltos)
// ------------------------------------------------------------
const bordeEstandar = {
  top: { style: BorderStyle.SINGLE, size: BORDE.estandarGrosor, color: BORDE.estandarColor },
  bottom: { style: BorderStyle.SINGLE, size: BORDE.estandarGrosor, color: BORDE.estandarColor },
  left: { style: BorderStyle.SINGLE, size: BORDE.estandarGrosor, color: BORDE.estandarColor },
  right: { style: BorderStyle.SINGLE, size: BORDE.estandarGrosor, color: BORDE.estandarColor },
  insideHorizontal: { style: BorderStyle.SINGLE, size: BORDE.estandarGrosor, color: BORDE.estandarColor },
  insideVertical: { style: BorderStyle.SINGLE, size: BORDE.estandarGrosor, color: BORDE.estandarColor },
}
const sinBorde = {
  top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE },
  left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE },
  insideHorizontal: { style: BorderStyle.NONE }, insideVertical: { style: BorderStyle.NONE },
}
// Colores del semáforo por etiqueta de nivel (para no repetir el if/else)
const SEMAFORO: Record<string, { fondo: string; texto: string }> = {
  'Logrado': { fondo: COLOR.logradoFondo, texto: COLOR.logradoTexto },
  'En proceso': { fondo: COLOR.procesoFondo, texto: COLOR.procesoTexto },
  'Requiere apoyo': { fondo: COLOR.apoyoFondo, texto: COLOR.apoyoTexto },
}
const MESES_CORTO = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const DIAS_SEMANA = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
const MESES_NOMBRE = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

function formatearFechaCorta(iso: string): string {
  if (!iso) return '—'
  const d = new Date(iso + 'T12:00:00')
  return `${d.getDate()} ${MESES_CORTO[d.getMonth()]}`
}
function formatearRangoFechas(inicio: string, fin: string): string {
  if (!inicio || !fin) return '—'
  return `${formatearFechaCorta(inicio)} al ${formatearFechaCorta(fin)}`
}
function formatearFechaLarga(iso: string, fallback: string): string {
  if (!iso) return fallback || '—'
  const d = new Date(iso + 'T12:00:00')
  return `${DIAS_SEMANA[d.getDay()]} ${d.getDate()} de ${MESES_NOMBRE[d.getMonth()]}`
}
// Escapa caracteres especiales de regex en un código de alumno (ej. "R.G.-1")
function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const inst = body.institucional || {}          // jardín, cct, educadora, grado, turno
    const proyecto = body.proyecto || {}
    const camposFormativos: any[] = Array.isArray(body.campos_formativos) ? body.campos_formativos : []
    const ejes: any[] = Array.isArray(body.ejes) ? body.ejes : []
    const dias: any[] = Array.isArray(body.dias) ? body.dias : []
    const diasEspeciales: any[] = Array.isArray(body.dias_especiales) ? body.dias_especiales : []
    const ajustesPorDia: any[] = Array.isArray(body.ajustes_por_dia) ? body.ajustes_por_dia : []
    const rubricas: any[] = Array.isArray(body.instrumentos_evaluacion) ? body.instrumentos_evaluacion : []
    const evaluacionFormativa: string = body.evaluacion_formativa || ''

    // ------------------------------------------------------------
    // Helpers de texto
    // ------------------------------------------------------------
    const texto = (t: string, opts: {
      bold?: boolean; italics?: boolean; color?: string; font?: string; size?: number
      permitirVacio?: boolean  // true = respetar cadena vacía (espaciadores); false/omitido = mostrar '—' si no hay dato
    } = {}) => new TextRun({
      text: t ? t : (opts.permitirVacio ? '' : '—'),
      bold: opts.bold,
      italics: opts.italics,
      color: opts.color || COLOR.negroAzulado,
      font: opts.font || FUENTE.cuerpo,
      size: opts.size || TAMANO.contenido,
    })

    const parrafo = (t: string, opts: {
      before?: number; after?: number; align?: (typeof AlignmentType)[keyof typeof AlignmentType]
      bold?: boolean; italics?: boolean; color?: string; font?: string; size?: number
      permitirVacio?: boolean
    } = {}) => new Paragraph({
      spacing: { before: opts.before ?? 0, after: opts.after ?? 100 },
      alignment: opts.align,
      children: [texto(t, opts)],
    })

    // Título de sección — negrita índigo con línea inferior cian,
    // igual para Bloque 1, la banda "NOMBRE DEL PROYECTO" y cada
    // encabezado de rúbrica en Bloque 3 (una sola fuente de verdad).
    const tituloSeccion = (t: string, opts: { before?: number } = {}) => new Paragraph({
      spacing: { before: opts.before ?? 200, after: 100 },
      border: { bottom: { style: BorderStyle.SINGLE, size: BORDE.finaGrosor, color: COLOR.cian, space: 4 } },
      children: [texto(t.toUpperCase(), { bold: true, color: COLOR.indigo, font: FUENTE.titulo, size: TAMANO.md })],
    })

    // "CÓDIGO — texto" → código en negrita índigo, resto normal
    // (para el PDA arriba de cada rúbrica). Justificado.
    function parrafoConCodigo(str: string, opts: { italics?: boolean } = {}) {
      const m = (str || '').match(/^([A-ZÁÉÍÓÚ]{2,6}-?\d*)\s*—\s*([\s\S]*)$/)
      const children = m
        ? [
            texto(`${m[1]} — `, { bold: true, color: COLOR.indigo, italics: opts.italics }),
            texto(m[2], { italics: opts.italics }),
          ]
        : [texto(str, { italics: opts.italics })]
      return new Paragraph({ alignment: AlignmentType.JUSTIFIED, spacing: { after: 100 }, children })
    }

    // Caja con borde, ancho completo — usada para Aspectos
    // Curriculares Relevantes (vacía, la llena la educadora) y
    // Evaluación Formativa (con el texto ya generado).
    function cajaConBorde(children: Paragraph[]) {
      return new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        layout: TableLayoutType.FIXED,
        borders: bordeEstandar,
        rows: [new TableRow({ children: [new TableCell({ margins: RELLENO_CELDA.amplio, children })] })],
      })
    }

    // ------------------------------------------------------------
    // Encabezado / pie
    // ------------------------------------------------------------
    function crearHeader() {
      return new Header({
        children: [
          new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [
              new TextRun({ text: '✦ PlanIA ', bold: true, color: COLOR.indigo, font: FUENTE.titulo, size: TAMANO.sm }),
              new TextRun({ text: 'Digital', bold: true, color: COLOR.cian, font: FUENTE.titulo, size: TAMANO.sm }),
              new TextRun({ text: ' ✦', bold: true, color: COLOR.indigo, font: FUENTE.titulo, size: TAMANO.sm }),
            ],
          }),
          new Paragraph({ text: '' }),
        ],
      })
    }
    function crearFooter() {
      return new Footer({
        children: [new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({ text: 'Generado con PlanIA Digital · Pág. ', color: COLOR.grisSuave, font: FUENTE.cuerpo, size: TAMANO.xs }),
            new TextRun({ children: [PageNumber.CURRENT], color: COLOR.grisSuave, font: FUENTE.cuerpo, size: TAMANO.xs }),
          ],
        })],
      })
    }

    // ------------------------------------------------------------
    // BLOQUE 1 — Institucional + Pedagógico
    // ------------------------------------------------------------
    function tablaDosColumnas(headerIzq: string, headerDer: string, valIzq: string, valDer: string, alinear: (typeof AlignmentType)[keyof typeof AlignmentType] = AlignmentType.JUSTIFIED) {
      return new Table({
        width: { size: 100, type: WidthType.PERCENTAGE }, layout: TableLayoutType.FIXED, borders: bordeEstandar,
        rows: [
          new TableRow({ children: [headerIzq, headerDer].map((t) => new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE }, shading: { type: ShadingType.CLEAR, fill: COLOR.indigoClaro },
            margins: RELLENO_CELDA.normal, children: [parrafo(t.toUpperCase(), { after: 0, align: AlignmentType.CENTER, bold: true, color: COLOR.indigo, font: FUENTE.titulo, size: TAMANO.sm })],
          })) }),
          new TableRow({ children: [valIzq, valDer].map((v) => new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE }, margins: RELLENO_CELDA.normal,
            children: [parrafo(v, { align: alinear })],
          })) }),
        ],
      })
    }

    const anchoCampos = [18, 22, 35, 25] // Campo formativo | Contenido | PDA | Indicador (%)
    const tablaCampos = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE }, layout: TableLayoutType.FIXED, borders: bordeEstandar,
      rows: [
        new TableRow({
          tableHeader: true,
          children: ['Campo formativo', 'Contenido', 'PDA', 'Indicador'].map((t, i) => new TableCell({
            width: { size: anchoCampos[i], type: WidthType.PERCENTAGE }, shading: { type: ShadingType.CLEAR, fill: COLOR.indigoClaro },
            verticalAlign: VerticalAlign.CENTER, margins: RELLENO_CELDA.normal,
            children: [parrafo(t, { after: 0, align: AlignmentType.CENTER, bold: true, color: COLOR.indigo, font: FUENTE.titulo, size: TAMANO.sm })],
          })),
        }),
        ...camposFormativos.map((c) => new TableRow({
          children: [
            new TableCell({ width: { size: anchoCampos[0], type: WidthType.PERCENTAGE }, verticalAlign: VerticalAlign.CENTER, margins: RELLENO_CELDA.normal, children: [parrafo(c.campo, { align: AlignmentType.CENTER })] }),
            new TableCell({ width: { size: anchoCampos[1], type: WidthType.PERCENTAGE }, verticalAlign: VerticalAlign.CENTER, margins: RELLENO_CELDA.normal, children: [parrafo(c.contenido, { align: AlignmentType.CENTER })] }),
            new TableCell({ width: { size: anchoCampos[2], type: WidthType.PERCENTAGE }, verticalAlign: VerticalAlign.CENTER, margins: RELLENO_CELDA.normal, children: [parrafo(`${c.pdaCodigo ? c.pdaCodigo + ' — ' : ''}${c.pdaTexto || ''}`, { align: AlignmentType.JUSTIFIED })] }),
            // c.indicador: todavía no lo genera el backend (pendiente en generar-planeacion/route.ts) —
            // en cuanto exista ahí, se muestra aquí automáticamente sin tocar este archivo.
            new TableCell({ width: { size: anchoCampos[3], type: WidthType.PERCENTAGE }, verticalAlign: VerticalAlign.CENTER, margins: RELLENO_CELDA.normal, children: [parrafo(c.indicador || '', { align: AlignmentType.JUSTIFIED, italics: !c.indicador, color: c.indicador ? undefined : COLOR.grisSuave })] }),
          ],
        })),
      ],
    })

    const ejesConNombre = ejes.filter((e) => !!e.nombre)
    const tablaEjes = ejesConNombre.length > 0 ? new Table({
      width: { size: 100, type: WidthType.PERCENTAGE }, layout: TableLayoutType.FIXED, borders: bordeEstandar,
      rows: [
        new TableRow({
          tableHeader: true,
          children: ['Eje Articulador', '¿Cómo se favorece?'].map((t, i) => new TableCell({
            width: { size: i === 0 ? 25 : 75, type: WidthType.PERCENTAGE }, shading: { type: ShadingType.CLEAR, fill: COLOR.indigoClaro },
            verticalAlign: VerticalAlign.CENTER, margins: RELLENO_CELDA.normal,
            children: [parrafo(t, { after: 0, align: AlignmentType.CENTER, bold: true, color: COLOR.indigo, font: FUENTE.titulo, size: TAMANO.sm })],
          })),
        }),
        ...ejesConNombre.map((e) => new TableRow({
          children: [
            new TableCell({ width: { size: 25, type: WidthType.PERCENTAGE }, verticalAlign: VerticalAlign.CENTER, margins: RELLENO_CELDA.normal, children: [parrafo(e.nombre, { align: AlignmentType.CENTER })] }),
            new TableCell({ width: { size: 75, type: WidthType.PERCENTAGE }, verticalAlign: VerticalAlign.CENTER, margins: RELLENO_CELDA.normal, children: [parrafo(e.descripcion || '—', { align: e.descripcion ? AlignmentType.JUSTIFIED : AlignmentType.CENTER, italics: !e.descripcion, color: e.descripcion ? undefined : COLOR.grisSuave })] }),
          ],
        })),
      ],
    }) : null

    const bloque1: (Paragraph | Table)[] = [
      parrafo(inst.jardin || 'Jardín de Niños', { align: AlignmentType.CENTER, bold: true, color: COLOR.indigo, font: FUENTE.titulo, size: TAMANO.lg, after: 20 }),
      parrafo(`CCT ${inst.cct || '—'}  Zona ${inst.zona || '—'}  Sector ${inst.sector || '—'}  Región ${inst.region || '—'}`, { align: AlignmentType.CENTER, color: COLOR.grisSuave, font: FUENTE.titulo, size: TAMANO.md, after: 20 }),
      parrafo(`Ciclo Escolar ${inst.ciclo_escolar || '—'}`, { align: AlignmentType.CENTER, color: COLOR.grisSuave, font: FUENTE.titulo, size: TAMANO.base, after: 200 }),
      parrafo(`Educadora ${inst.educadora || '—'} del Grupo ${inst.grado || '—'} ${inst.grupo_letra || ''}`.trim(), { align: AlignmentType.CENTER, bold: true, color: COLOR.indigo, font: FUENTE.titulo, size: TAMANO.mdl, after: 200 }),
      new Paragraph({
        border: { bottom: { style: BorderStyle.SINGLE, size: BORDE.finaGrosor, color: COLOR.cian, space: 4 } },
        spacing: { after: 200 },
        children: [
          new TextRun({ text: 'NOMBRE DEL PROYECTO: ', bold: true, color: COLOR.indigo, font: FUENTE.titulo, size: TAMANO.md }),
          new TextRun({ text: (proyecto.project_name || '—').toUpperCase(), bold: true, color: COLOR.indigo, font: FUENTE.titulo, size: TAMANO.md }),
        ],
      }),

      tablaDosColumnas('Modalidad', 'Periodo de Aplicación', proyecto.metodologia, formatearRangoFechas(proyecto.starts_on, proyecto.ends_on), AlignmentType.CENTER),

      tituloSeccion('Problemática y Propósito'),
      tablaDosColumnas('Problemática', 'Propósito', proyecto.situacion_problema, proyecto.finalidad),

      tituloSeccion('Campos formativos, contenidos, PDA e Indicadores'),
      tablaCampos,

      ...(tablaEjes ? [tituloSeccion('Ejes articuladores'), tablaEjes] : []),

      tituloSeccion('Aspectos Curriculares Relevantes'),
      parrafo('(Puedes integrar notas y directrices solicitadas por dirección o zona escolar.)', { italics: true, color: COLOR.grisSuave, size: TAMANO.sm, after: 100 }),
      cajaConBorde([parrafo('', { permitirVacio: true }), parrafo('', { permitirVacio: true }), parrafo('', { permitirVacio: true })]),

      tituloSeccion('Evaluación Formativa'),
      cajaConBorde([parrafo(evaluacionFormativa, { align: AlignmentType.JUSTIFIED, italics: true, after: 0 })]),
    ]

    // ------------------------------------------------------------
    // BLOQUE 2 — Cuerpo por Momento (agrupado dinámicamente)
    // ------------------------------------------------------------
    const ANCHO_ETIQUETA = 18
    const ANCHO_VALOR = 100 - ANCHO_ETIQUETA

    function bandaMomento(nombre: string, esPrimera: boolean) {
      return new Table({
        width: { size: 100, type: WidthType.PERCENTAGE }, layout: TableLayoutType.FIXED, borders: sinBorde,
        rows: [new TableRow({ children: [new TableCell({
          shading: { type: ShadingType.CLEAR, fill: COLOR.indigo },
          margins: RELLENO_CELDA.amplio,
          children: [parrafo(`MOMENTO · ${nombre.toUpperCase()}`, { after: 0, align: AlignmentType.CENTER, bold: true, color: COLOR.blanco, font: FUENTE.titulo, size: TAMANO.lg })],
        })] })],
      })
    }

    // Fila etiqueta | contenido — SIN cantSplit, para que Word corte
    // la fila sola entre páginas si el texto no cabe, sin dejar el
    // encabezado (Inicio/Desarrollo/...) huérfano.
    function filaEtiqueta(etq: string, children: Paragraph[], shading = false) {
      return new TableRow({
        children: [
          new TableCell({
            width: { size: ANCHO_ETIQUETA, type: WidthType.PERCENTAGE },
            shading: shading ? { type: ShadingType.CLEAR, fill: COLOR.indigoClaro } : undefined,
            verticalAlign: VerticalAlign.CENTER, margins: RELLENO_CELDA.normal,
            children: [parrafo(etq, { after: 0, align: AlignmentType.CENTER, bold: true, color: COLOR.indigo, font: FUENTE.titulo, size: TAMANO.sm })],
          }),
          new TableCell({
            width: { size: ANCHO_VALOR, type: WidthType.PERCENTAGE },
            verticalAlign: VerticalAlign.CENTER, margins: RELLENO_CELDA.normal,
            children,
          }),
        ],
      })
    }

    function parrafosAjustesDelDia(numeroDia: number): Paragraph[] {
      const ajustesDelDia = ajustesPorDia.filter((a) => a.numero === numeroDia)
      if (ajustesDelDia.length === 0) return [parrafo('—', { color: COLOR.grisSuave, size: TAMANO.sm })]
      // a.ajuste ya trae el código pegado al inicio del texto (ej. "R.G.-1.- Antes de...");
      // lo separamos para pintar el código en negrita índigo y el resto normal, cada
      // alumno en su propio párrafo (antes venían todos corridos en un solo bloque).
      return ajustesDelDia.map((a: any, i: number) => {
        const prefijo = new RegExp(`^${escapeRegex(a.codigo)}\\.-\\s*`)
        const resto = (a.ajuste || '').replace(prefijo, '')
        return new Paragraph({
          alignment: AlignmentType.JUSTIFIED,
          spacing: { after: i < ajustesDelDia.length - 1 ? 100 : 0 },
          children: [
            texto(`${a.codigo}.- `, { bold: true, color: COLOR.indigo, size: TAMANO.sm }),
            texto(resto, { size: TAMANO.sm }),
          ],
        })
      })
    }

    function tablaDia(dia: any) {
      const filas = [
        filaEtiqueta('Inicio', [parrafo(dia.inicio, { align: AlignmentType.JUSTIFIED })], true),
        filaEtiqueta('Desarrollo', [parrafo(dia.desarrollo, { align: AlignmentType.JUSTIFIED })]),
        filaEtiqueta('Cierre', [parrafo(dia.cierre, { align: AlignmentType.JUSTIFIED })]),
        filaEtiqueta('Ajustes Razonables', parrafosAjustesDelDia(dia.numero)),
        filaEtiqueta('Actividad Complementaria', [parrafo(dia.actividad_complementaria || '—', { align: AlignmentType.JUSTIFIED })]),
        filaEtiqueta('Recursos', [parrafo((dia.materiales || '—').replace(/\s*\|\s*/g, '. '), { align: AlignmentType.JUSTIFIED })]),
      ]
      return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, layout: TableLayoutType.FIXED, borders: bordeEstandar, rows: filas })
    }

    function notaDiaEspecial(item: any) {
      const et = item.tipo === 'CTE' ? 'Consejo Técnico Escolar' : (item.motivo || 'Día inhábil')
      return parrafo(`${item.fecha} — ${et}. No se generan actividades pedagógicas este día.`, { italics: true, color: COLOR.grisSuave, size: TAMANO.sm, before: 100, after: 100 })
    }

    const secuencia = [
      ...dias.map((d) => ({ ...d, _tipo: 'habil' as const })),
      ...diasEspeciales.map((d) => ({ ...d, _tipo: 'especial' as const })),
    ].sort((a, b) => (a.fecha_iso || a.fecha || '').localeCompare(b.fecha_iso || b.fecha || ''))

    const bloque2: (Paragraph | Table)[] = []
    let momentoActual: string | null = null
    let esPrimerMomento = true

    secuencia.forEach((item: any) => {
      if (item._tipo === 'especial') {
        momentoActual = null
        bloque2.push(notaDiaEspecial(item))
        return
      }
      if (item.momento_modalidad !== momentoActual) {
        // Sin salto de página forzado entre Momentos — todo corre seguido;
        // el único salto fijo de esta zona es el que ya viene antes del
        // Bloque 2 completo (Bloque1 → Bloque2), no uno por cada Momento.
        // El párrafo vacío ANTES de la banda es obligatorio: sin él, dos
        // <w:tbl> de Word pegadas (la tabla del día anterior + esta banda)
        // a veces heredan mal el ancho de columna entre sí y la banda sale
        // angosta (confirmado en Word real, sep 2026).
        bloque2.push(new Paragraph({ text: '', spacing: { before: 100 } }))
        bloque2.push(bandaMomento(item.momento_modalidad, esPrimerMomento))
        esPrimerMomento = false
        momentoActual = item.momento_modalidad
      }
      bloque2.push(parrafo(formatearFechaLarga(item.fecha_iso, item.fecha), { before: 200, after: 100, bold: true, color: COLOR.cian, font: FUENTE.titulo, size: TAMANO.base }))
      bloque2.push(tablaDia(item))
    })

    // ------------------------------------------------------------
    // BLOQUE 3 — Rúbricas por PDA (Criterio + 3 niveles + alumnos),
    // luego Adecuaciones/PMC/Firmas sin salto entre ellas.
    // ------------------------------------------------------------
    function dosColumnasVacio(t1: string, t2: string) {
      return new Table({
        width: { size: 100, type: WidthType.PERCENTAGE }, layout: TableLayoutType.FIXED, borders: bordeEstandar,
        rows: [
          new TableRow({ children: [t1, t2].map((t) => new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE }, shading: { type: ShadingType.CLEAR, fill: COLOR.indigoClaro },
            margins: RELLENO_CELDA.normal, children: [parrafo(t.toUpperCase(), { after: 0, align: AlignmentType.CENTER, bold: true, color: COLOR.indigo, font: FUENTE.titulo, size: TAMANO.sm })],
          })) }),
          new TableRow({ children: [0, 1].map(() => new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE }, margins: RELLENO_CELDA.normal, children: [parrafo('', { permitirVacio: true })],
          })) }),
        ],
      })
    }
    function bloqueFirmas(nombreEducadora: string) {
      return new Table({
        width: { size: 100, type: WidthType.PERCENTAGE }, layout: TableLayoutType.FIXED, borders: sinBorde,
        rows: [
          new TableRow({
            children: [
              new TableCell({ width: { size: 50, type: WidthType.PERCENTAGE }, margins: { top: 400 }, borders: { top: { style: BorderStyle.SINGLE, size: 4, color: COLOR.negroAzulado } }, children: [parrafo(nombreEducadora || '—', { align: AlignmentType.CENTER, bold: true })] }),
              new TableCell({ width: { size: 50, type: WidthType.PERCENTAGE }, margins: { top: 400 }, borders: { top: { style: BorderStyle.SINGLE, size: 4, color: COLOR.negroAzulado } }, children: [parrafo(' ', { align: AlignmentType.CENTER })] }),
            ],
          }),
          new TableRow({
            children: [
              new TableCell({ width: { size: 50, type: WidthType.PERCENTAGE }, children: [parrafo('Educadora', { align: AlignmentType.CENTER, italics: true, color: COLOR.grisSuave, size: TAMANO.sm })] }),
              new TableCell({ width: { size: 50, type: WidthType.PERCENTAGE }, children: [parrafo('Directora', { align: AlignmentType.CENTER, italics: true, color: COLOR.grisSuave, size: TAMANO.sm })] }),
            ],
          }),
        ],
      })
    }

    const ANCHO_CRITERIO = 25
    const ANCHO_NIVEL = Math.round((100 - ANCHO_CRITERIO) / 3)

    // Empareja cada rúbrica con su código de PDA real, por texto exacto
    // (no por nombre de campo — puede haber dos "Lenguajes" con PDA
    // distintos, como en esta misma planeación). `pda_evaluado` lo pone
    // nuestro propio backend, no el modelo, así que es la clave confiable;
    // `r.pda` es la versión que la IA reescribió y puede no traer el código.
    const codigoPorPda: Record<string, string> = {}
    camposFormativos.forEach((c) => { if (c.pdaTexto) codigoPorPda[c.pdaTexto] = c.pdaCodigo })

    function bloqueRubrica(r: any, esPrimera: boolean): (Paragraph | Table)[] {
      const textoPdaBase = r.pda_evaluado || r.pda || ''
      const codigo = codigoPorPda[textoPdaBase]
      const pdaConCodigo = codigo ? `${codigo} — ${textoPdaBase}` : textoPdaBase
      const niveles: any[] = Array.isArray(r.niveles) ? r.niveles : []
      const porEtiqueta = (etq: string) => niveles.find((n) => n.etiqueta === etq)?.descriptor || '—'
      const anchosNiveles = [ANCHO_CRITERIO, ANCHO_NIVEL, ANCHO_NIVEL, 100 - ANCHO_CRITERIO - ANCHO_NIVEL * 2]
      const etiquetasNiveles = ['Criterio', 'Logrado', 'En proceso', 'Requiere apoyo']

      const tablaCriterio = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE }, layout: TableLayoutType.FIXED, borders: bordeEstandar,
        rows: [
          new TableRow({ tableHeader: true, children: etiquetasNiveles.map((t, i) => new TableCell({
            width: { size: anchosNiveles[i], type: WidthType.PERCENTAGE }, shading: { type: ShadingType.CLEAR, fill: COLOR.indigoClaro },
            verticalAlign: VerticalAlign.CENTER, margins: RELLENO_CELDA.normal,
            children: [parrafo(t, { after: 0, align: AlignmentType.CENTER, bold: true, color: COLOR.indigo, font: FUENTE.titulo, size: TAMANO.sm })],
          })) }),
          new TableRow({ children: [
            new TableCell({ width: { size: anchosNiveles[0], type: WidthType.PERCENTAGE }, verticalAlign: VerticalAlign.CENTER, margins: RELLENO_CELDA.normal, children: [parrafo(r.criterio || '—', { align: AlignmentType.CENTER })] }),
            ...['Logrado', 'En proceso', 'Requiere apoyo'].map((etq, i) => {
              const s = SEMAFORO[etq] || { fondo: COLOR.indigoClaro, texto: COLOR.indigo }
              return new TableCell({ width: { size: anchosNiveles[i + 1], type: WidthType.PERCENTAGE }, shading: { type: ShadingType.CLEAR, fill: s.fondo }, verticalAlign: VerticalAlign.CENTER, margins: RELLENO_CELDA.normal, children: [parrafo(porEtiqueta(etq), { align: AlignmentType.CENTER, size: TAMANO.contenido })] })
            }),
          ] }),
        ],
      })

      const alumnos: string[] = Array.isArray(r.registro_alumnos) ? r.registro_alumnos.map((a: any) => a.codigo) : []
      const tablaAlumnos = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE }, layout: TableLayoutType.FIXED, borders: bordeEstandar,
        rows: [
          new TableRow({ tableHeader: true, children: etiquetasNiveles.map((_, i) => i === 0 ? 'Nombre de Alumno' : etiquetasNiveles[i]).map((t, i) => new TableCell({
            width: { size: anchosNiveles[i], type: WidthType.PERCENTAGE }, shading: { type: ShadingType.CLEAR, fill: COLOR.indigoClaro },
            margins: RELLENO_CELDA.compacto, children: [parrafo(t, { after: 0, align: AlignmentType.CENTER, bold: true, color: COLOR.indigo, size: TAMANO.sm })],
          })) }),
          ...alumnos.map((codigo) => new TableRow({ children: [
            new TableCell({ width: { size: anchosNiveles[0], type: WidthType.PERCENTAGE }, margins: RELLENO_CELDA.compacto, children: [parrafo(codigo, { align: AlignmentType.LEFT })] }),
            ...[1, 2, 3].map((i) => new TableCell({ width: { size: anchosNiveles[i], type: WidthType.PERCENTAGE }, margins: RELLENO_CELDA.compacto, children: [parrafo('', { permitirVacio: true })] })),
          ] })),
        ],
      })

      const bloques: (Paragraph | Table)[] = []
      if (!esPrimera) bloques.push(new Paragraph({ children: [new PageBreak()] }))
      bloques.push(
        tituloSeccion(`Rúbrica — ${r.campo || ''}`),
        parrafoConCodigo(pdaConCodigo, { italics: true }),
        tablaCriterio,
        tablaAlumnos,
      )
      return bloques
    }

    const bloque3: (Paragraph | Table)[] = [
      ...rubricas.flatMap((r, i) => bloqueRubrica(r, i === 0)),
      new Paragraph({ children: [new PageBreak()] }),
      tituloSeccion('Adecuaciones y Evaluación del Proyecto'),
      dosColumnasVacio('Adecuaciones', 'Evaluación del Proyecto'),
      tituloSeccion('PMC / PA y Programas Externos'),
      dosColumnasVacio('Aspectos Relevantes del PMC o PA', 'Aspectos Relevantes sobre Programas Externos'),
      tituloSeccion('Firmas'),
      bloqueFirmas(inst.educadora),
    ]

    // ------------------------------------------------------------
    // Ensamblar documento — UNA sola sección, portrait de punta a
    // punta (antes: 2 secciones, la primera horizontal).
    // ------------------------------------------------------------
    const doc = new Document({
      sections: [
        {
          properties: { page: { size: { width: PAGINA.alto, height: PAGINA.ancho }, margin: PAGINA.margenes } },
          headers: { default: crearHeader() },
          footers: { default: crearFooter() },
          children: [
            ...bloque1,
            new Paragraph({ children: [new PageBreak()] }), // salto fijo Bloque1 → Bloque2
            ...bloque2,
            new Paragraph({ children: [new PageBreak()] }), // salto fijo Bloque2 → 1a Rúbrica
            ...bloque3,
          ],
        },
      ],
    })

    const buffer = await Packer.toBuffer(doc)
    const nombreArchivo = `${(proyecto.project_name || 'planeacion').replace(/[^a-zA-Z0-9-_ ]/g, '').slice(0, 60)}.docx`

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${nombreArchivo}"`,
      },
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Error al generar el documento' }, { status: 500 })
  }
}