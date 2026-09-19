// ============================================================
//  PlanIA Digital — Exportar planeación a Word (.docx)
//  app/api/exportar-word/route.ts
//
//  Rediseño sep 2026: plantilla "Institucional Índigo" con
//  estructura de 3 bloques (ver lib/wordTemplateTokens.ts para
//  toda constante de diseño — este archivo NUNCA debe escribir
//  un color/tamaño/margen a mano).
//
//  Bloque 1 = Institucional + Pedagógico (encabezado, proyecto,
//             problemática, propósito, tabla curricular, ejes)
//  Bloque 2 = Cuerpo por Momento (agrupado dinámicamente por
//             dia.momento_modalidad — funciona para cualquier
//             modalidad sin cambios de código)
//  Bloque 3 = Cierre — DOS PARTES (sep 2026, revisión con
//             impresión real):
//             3a) Evaluación formativa + cajas en blanco
//                 (adecuaciones/evaluación proyecto/PMC/programas)
//                 + firmas — HORIZONTAL, misma sección que 1 y 2.
//             3b) Rúbricas por PDA — VERTICAL, sección NUEVA
//                 aparte (una tabla vertical de alumnos cabe en
//                 una sola página; en horizontal se partía en 2
//                 hojas por rúbrica). Va al final del documento.
//
//  NOTA: la plantilla "Clásica Serif" se retiró (sep 2026) para
//  simplificar el lanzamiento — solo existe Institucional Índigo.
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
const bordeSuave = {
  top: { style: BorderStyle.SINGLE, size: BORDE.finaGrosor, color: BORDE.finaColor },
  bottom: { style: BorderStyle.SINGLE, size: BORDE.finaGrosor, color: BORDE.finaColor },
  left: { style: BorderStyle.SINGLE, size: BORDE.finaGrosor, color: BORDE.finaColor },
  right: { style: BorderStyle.SINGLE, size: BORDE.finaGrosor, color: BORDE.finaColor },
  insideHorizontal: { style: BorderStyle.SINGLE, size: BORDE.finaGrosor, color: BORDE.finaColor },
  insideVertical: { style: BorderStyle.SINGLE, size: BORDE.finaGrosor, color: BORDE.finaColor },
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
function formatearFechaCorta(iso: string): string {
  if (!iso) return '—'
  const d = new Date(iso + 'T12:00:00')
  return `${d.getDate()} ${MESES_CORTO[d.getMonth()]}`
}
function formatearRangoFechas(inicio: string, fin: string): string {
  if (!inicio || !fin) return '—'
  return `${formatearFechaCorta(inicio)} al ${formatearFechaCorta(fin)}`
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
      // 9pt uniforme para todo el contenido de tablas que no especifica
      // su propio tamaño (etiquetas/encabezados de diseño sí lo
      // especifican explícito, así que no se ven afectados).
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

    const etiqueta = (t: string) => parrafo(t.toUpperCase(), {
      before: 160, after: 50, bold: true, color: COLOR.indigo, font: FUENTE.titulo, size: TAMANO.sm,
    })

    // ------------------------------------------------------------
    // Encabezado / pie — factory porque cada SECCIÓN de Word
    // necesita su PROPIA instancia de Header/Footer (no se
    // reutiliza el mismo objeto entre secciones).
    // ------------------------------------------------------------
    function crearHeader() {
      return new Header({
        children: [new Paragraph({
          alignment: AlignmentType.RIGHT,
          children: [
            new TextRun({ text: '✦ PlanIA ', bold: true, color: COLOR.indigo, font: FUENTE.titulo, size: TAMANO.sm }),
            new TextRun({ text: 'Digital', bold: true, color: COLOR.cian, font: FUENTE.titulo, size: TAMANO.sm }),
            new TextRun({ text: ' ✦', bold: true, color: COLOR.indigo, font: FUENTE.titulo, size: TAMANO.sm }),
          ],
        })],
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
        const bloqueInstitucional: Paragraph[] = [
      parrafo(inst.jardin || 'Jardín de Niños', { align: AlignmentType.CENTER, bold: true, color: COLOR.indigo, font: FUENTE.titulo, size: TAMANO.lg, after: 20 }),
      parrafo(`CCT ${inst.cct || '—'} Zona ${inst.zona || '—'} Sector ${inst.sector || '—'} Región ${inst.region || '—'}`, { align: AlignmentType.CENTER, color: COLOR.grisSuave, font: FUENTE.titulo, size: TAMANO.md, after: 20 }),
      parrafo(`Ciclo Escolar ${inst.ciclo_escolar || '—'}`, { align: AlignmentType.CENTER, color: COLOR.grisSuave, font: FUENTE.titulo, size: TAMANO.base, after: 200 }),
      parrafo(`Educadora ${inst.educadora || '—'} del Grupo ${inst.grado || '—'} ${inst.grupo_letra || ''}`.trim(), { align: AlignmentType.CENTER, bold: true, color: COLOR.indigo, font: FUENTE.titulo, size: TAMANO.mdl, after: 300 }),
    ]

    // Rejilla única de 20 columnas iguales (5% cada una) para toda la
    // tabla pedagógica — cualquier ajuste futuro se describe en "cuántas
    // columnas de 20 ocupa esta celda", sin fracciones raras. Incluye
    // Proyecto/Problemática/Propósito/Campos/Ejes, todo en UNA tabla
    // (Word no reconcilia bien columnas entre filas de distinto número
    // de celdas si son tablas separadas o sin columnSpan explícito).
    const GRID20 = Array(20).fill(5)
    const gw = (cuantas: number) => cuantas * 5

    const tablaProyecto = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      layout: TableLayoutType.FIXED,
      borders: bordeEstandar,
      rows: [
        new TableRow({
          children: [
            new TableCell({ width: { size: gw(3), type: WidthType.PERCENTAGE }, columnSpan: 3, verticalAlign: VerticalAlign.CENTER, shading: { type: ShadingType.CLEAR, fill: COLOR.indigo }, margins: RELLENO_CELDA.normal, children: [parrafo('PROYECTO', { after: 0, align: AlignmentType.CENTER, bold: true, color: COLOR.blanco, font: FUENTE.titulo, size: TAMANO.sm })] }),
            new TableCell({ width: { size: gw(8), type: WidthType.PERCENTAGE }, columnSpan: 8, verticalAlign: VerticalAlign.CENTER, margins: RELLENO_CELDA.normal, children: [parrafo(proyecto.project_name, { align: AlignmentType.CENTER })] }),
            new TableCell({ width: { size: gw(2), type: WidthType.PERCENTAGE }, columnSpan: 2, verticalAlign: VerticalAlign.CENTER, shading: { type: ShadingType.CLEAR, fill: COLOR.indigo }, margins: RELLENO_CELDA.normal, children: [parrafo('MODALIDAD', { after: 0, align: AlignmentType.CENTER, bold: true, color: COLOR.blanco, font: FUENTE.titulo, size: TAMANO.sm })] }),
            new TableCell({ width: { size: gw(2), type: WidthType.PERCENTAGE }, columnSpan: 2, verticalAlign: VerticalAlign.CENTER, margins: RELLENO_CELDA.normal, children: [parrafo(proyecto.metodologia, { align: AlignmentType.CENTER })] }),
            new TableCell({ width: { size: gw(2), type: WidthType.PERCENTAGE }, columnSpan: 2, verticalAlign: VerticalAlign.CENTER, shading: { type: ShadingType.CLEAR, fill: COLOR.indigo }, margins: RELLENO_CELDA.normal, children: [parrafo('APLICACIÓN', { after: 0, align: AlignmentType.CENTER, bold: true, color: COLOR.blanco, font: FUENTE.titulo, size: TAMANO.sm })] }),
            new TableCell({ width: { size: gw(3), type: WidthType.PERCENTAGE }, columnSpan: 3, verticalAlign: VerticalAlign.CENTER, margins: RELLENO_CELDA.normal, children: [parrafo(formatearRangoFechas(proyecto.starts_on, proyecto.ends_on), { align: AlignmentType.CENTER })] }),
          ],
        }),
        new TableRow({
          children: [
            new TableCell({ width: { size: gw(3), type: WidthType.PERCENTAGE }, columnSpan: 3, verticalAlign: VerticalAlign.CENTER, shading: { type: ShadingType.CLEAR, fill: COLOR.menta }, margins: RELLENO_CELDA.normal, children: [parrafo('PROBLEMÁTICA', { after: 0, align: AlignmentType.CENTER, bold: true, color: COLOR.indigo, font: FUENTE.titulo, size: TAMANO.sm })] }),
            new TableCell({ width: { size: gw(17), type: WidthType.PERCENTAGE }, columnSpan: 17, verticalAlign: VerticalAlign.CENTER, margins: RELLENO_CELDA.normal, children: [parrafo(proyecto.situacion_problema, { align: AlignmentType.JUSTIFIED })] }),
          ],
        }),
        new TableRow({
          children: [
            new TableCell({ width: { size: gw(3), type: WidthType.PERCENTAGE }, columnSpan: 3, verticalAlign: VerticalAlign.CENTER, shading: { type: ShadingType.CLEAR, fill: COLOR.menta }, margins: RELLENO_CELDA.normal, children: [parrafo('PROPÓSITO', { after: 0, align: AlignmentType.CENTER, bold: true, color: COLOR.indigo, font: FUENTE.titulo, size: TAMANO.sm })] }),
            new TableCell({ width: { size: gw(17), type: WidthType.PERCENTAGE }, columnSpan: 17, verticalAlign: VerticalAlign.CENTER, margins: RELLENO_CELDA.normal, children: [parrafo(proyecto.finalidad, { align: AlignmentType.JUSTIFIED })] }),
          ],
        }),
        new TableRow({
          tableHeader: true,
          children: [
            new TableCell({ width: { size: gw(3), type: WidthType.PERCENTAGE }, columnSpan: 3, verticalAlign: VerticalAlign.CENTER, shading: { type: ShadingType.CLEAR, fill: COLOR.indigo }, margins: RELLENO_CELDA.normal, children: [parrafo('C. FORMATIVO', { after: 0, align: AlignmentType.CENTER, bold: true, color: COLOR.blanco, font: FUENTE.titulo, size: TAMANO.sm })] }),
            new TableCell({ width: { size: gw(7), type: WidthType.PERCENTAGE }, columnSpan: 7, verticalAlign: VerticalAlign.CENTER, shading: { type: ShadingType.CLEAR, fill: COLOR.indigo }, margins: RELLENO_CELDA.normal, children: [parrafo('CONTENIDO', { after: 0, align: AlignmentType.CENTER, bold: true, color: COLOR.blanco, font: FUENTE.titulo, size: TAMANO.sm })] }),
            new TableCell({ width: { size: gw(10), type: WidthType.PERCENTAGE }, columnSpan: 10, verticalAlign: VerticalAlign.CENTER, shading: { type: ShadingType.CLEAR, fill: COLOR.indigo }, margins: RELLENO_CELDA.normal, children: [parrafo('PROCESO DE DESARROLLO DE APRENDIZAJE', { after: 0, align: AlignmentType.CENTER, bold: true, color: COLOR.blanco, font: FUENTE.titulo, size: TAMANO.sm })] }),
          ],
        }),
        ...camposFormativos.map((c) => new TableRow({
          children: [
            new TableCell({ width: { size: gw(3), type: WidthType.PERCENTAGE }, columnSpan: 3, verticalAlign: VerticalAlign.CENTER, margins: RELLENO_CELDA.normal, children: [parrafo(c.campo, { after: 0, align: AlignmentType.CENTER, bold: true, color: COLOR.indigo })] }),
            new TableCell({ width: { size: gw(7), type: WidthType.PERCENTAGE }, columnSpan: 7, verticalAlign: VerticalAlign.CENTER, margins: RELLENO_CELDA.normal, children: [parrafo(c.contenido, { align: AlignmentType.CENTER })] }),
            new TableCell({ width: { size: gw(10), type: WidthType.PERCENTAGE }, columnSpan: 10, verticalAlign: VerticalAlign.CENTER, margins: RELLENO_CELDA.normal, children: [parrafo(`${c.pdaCodigo ? c.pdaCodigo + ' — ' : ''}${c.pdaTexto || ''}`, { align: AlignmentType.JUSTIFIED })] }),
          ],
        })),
        ...(ejes.filter((e) => !!e.nombre).length > 0 ? [
          new TableRow({
            tableHeader: true,
            children: [
              new TableCell({ width: { size: gw(3), type: WidthType.PERCENTAGE }, columnSpan: 3, verticalAlign: VerticalAlign.CENTER, shading: { type: ShadingType.CLEAR, fill: COLOR.indigo }, margins: RELLENO_CELDA.normal, children: [parrafo('EJE ARTICULADOR', { after: 0, align: AlignmentType.CENTER, bold: true, color: COLOR.blanco, font: FUENTE.titulo, size: TAMANO.sm })] }),
              new TableCell({ width: { size: gw(17), type: WidthType.PERCENTAGE }, columnSpan: 17, verticalAlign: VerticalAlign.CENTER, shading: { type: ShadingType.CLEAR, fill: COLOR.indigo }, margins: RELLENO_CELDA.normal, children: [parrafo('¿CÓMO SE FAVORECE?', { after: 0, align: AlignmentType.CENTER, bold: true, color: COLOR.blanco, font: FUENTE.titulo, size: TAMANO.sm })] }),
            ],
          }),
          ...ejes.filter((e) => !!e.nombre).map((e) => new TableRow({
            children: [
              new TableCell({ width: { size: gw(3), type: WidthType.PERCENTAGE }, columnSpan: 3, verticalAlign: VerticalAlign.CENTER, margins: RELLENO_CELDA.normal, children: [parrafo(e.nombre, { after: 0, align: AlignmentType.CENTER, bold: true, color: COLOR.indigo })] }),
              new TableCell({ width: { size: gw(17), type: WidthType.PERCENTAGE }, columnSpan: 17, verticalAlign: VerticalAlign.CENTER, margins: RELLENO_CELDA.normal, children: [parrafo(e.descripcion || '—', { align: e.descripcion ? AlignmentType.JUSTIFIED : AlignmentType.CENTER, italics: !e.descripcion, color: e.descripcion ? undefined : COLOR.grisSuave })] }),
            ],
          })),
        ] : []),
      ],
    })

    const bloque1: (Paragraph | Table)[] = [
      ...bloqueInstitucional,
      tablaProyecto,
    ]
    // ------------------------------------------------------------
    // BLOQUE 2 — Cuerpo por Momento (agrupado dinámicamente)
    // ------------------------------------------------------------
    const anchoColumnas = [8, 40, 24, 14, 14] // Fecha | Actividades | Ajustes | Act.Compl. | Recursos

    function bandaMomento(nombre: string) {
      return new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: sinBorde,
        rows: [new TableRow({
          cantSplit: true,
          children: [new TableCell({
            columnSpan: 5, shading: { type: ShadingType.CLEAR, fill: COLOR.indigo },
            margins: RELLENO_CELDA.amplio,
            children: [parrafo(`MOMENTO · ${nombre.toUpperCase()}`, { align: AlignmentType.CENTER, bold: true, color: COLOR.blanco, font: FUENTE.titulo, size: TAMANO.lg })],
          })],
        })],
      })
    }

    function encabezadoColumnas() {
      return new TableRow({
        tableHeader: true, cantSplit: true,
        children: ['FECHA', 'ACTIVIDADES', 'AJUSTES RAZONABLES', 'ACT. COMPLEMENTARIA', 'RECURSOS'].map((t, i) => new TableCell({
          width: { size: anchoColumnas[i], type: WidthType.PERCENTAGE },
          shading: { type: ShadingType.CLEAR, fill: COLOR.indigoClaro },
          margins: RELLENO_CELDA.normal,
          children: [parrafo(t, { align: AlignmentType.CENTER, bold: true, color: COLOR.indigo, font: FUENTE.titulo, size: TAMANO.sm })],
        })),
      })
    }
    const DIAS_SEMANA = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
    const MESES_NOMBRE = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

    function parrafosFechaTresLineas(dia: any) {
      if (!dia.fecha_iso) return [parrafo(dia.fecha, { align: AlignmentType.CENTER, bold: true, size: TAMANO.base })]
      const d = new Date(dia.fecha_iso + 'T12:00:00')
      return [
        parrafo(DIAS_SEMANA[d.getDay()], { align: AlignmentType.CENTER, bold: true, size: TAMANO.base }),
        parrafo(String(d.getDate()), { align: AlignmentType.CENTER, bold: true, size: TAMANO.base }),
        parrafo(MESES_NOMBRE[d.getMonth()], { align: AlignmentType.CENTER, bold: true, size: TAMANO.base }),
      ]
    }
    function filaDia(dia: any) {
      const ajustesDelDia = ajustesPorDia.filter((a) => a.numero === dia.numero)
      const actividades = ['Inicio', 'Desarrollo', 'Cierre'].map((et, i) => new Paragraph({
        spacing: { after: i < 2 ? 120 : 0 },
        children: [
          texto(`${et}: `, { bold: true }),
          texto(dia[et.toLowerCase()], {}),
        ],
      }))
      const ajustesParrafos = ajustesDelDia.length > 0
        // OJO: a.ajuste ya trae el código incluido al inicio del texto
        // (ej. "R.G.-1.- Antes de pedir..."), generado así por el
        // agente. NO anteponer a.codigo aquí o se duplica.
        ? ajustesDelDia.map((a: any, i: number) => new Paragraph({
          spacing: { after: i < ajustesDelDia.length - 1 ? 100 : 0 },
          children: [texto(a.ajuste, { size: TAMANO.sm })],
        }))
        : [parrafo('—', { color: COLOR.grisSuave, size: TAMANO.sm })]

      return new TableRow({
        cantSplit: true, // TRUE = no se parte entre páginas (ver wordTemplateTokens.REGLAS)
        children: [
          new TableCell({ width: { size: anchoColumnas[0], type: WidthType.PERCENTAGE }, verticalAlign: VerticalAlign.CENTER, margins: RELLENO_CELDA.normal, children: parrafosFechaTresLineas(dia) }),
          new TableCell({ width: { size: anchoColumnas[1], type: WidthType.PERCENTAGE }, margins: RELLENO_CELDA.normal, children: actividades }),
          new TableCell({ width: { size: anchoColumnas[2], type: WidthType.PERCENTAGE }, margins: RELLENO_CELDA.normal, borders: { left: { style: BorderStyle.SINGLE, size: BORDE.acentoGrosor, color: BORDE.acentoColor } }, children: ajustesParrafos,}),
          new TableCell({ width: { size: anchoColumnas[3], type: WidthType.PERCENTAGE }, margins: RELLENO_CELDA.normal, children: [parrafo(dia.actividad_complementaria || '—', { size: TAMANO.sm })] }),
          new TableCell({ width: { size: anchoColumnas[4], type: WidthType.PERCENTAGE }, margins: RELLENO_CELDA.normal, children: [parrafo(dia.materiales || '—', { size: TAMANO.sm })] }),
        ],
      })
    }

    function notaDiaEspecial(item: any) {
      const et = item.tipo === 'CTE' ? 'Consejo Técnico Escolar' : (item.motivo || 'Día inhábil')
      return parrafo(`${item.fecha} — ${et}. No se generan actividades pedagógicas este día.`, { italics: true, color: COLOR.grisSuave, size: TAMANO.sm, before: 100, after: 100 })
    }

    // Mezclar días hábiles + especiales, ordenados por fecha, y agrupar
    // por Momento (una sola Table por Momento, con TODAS sus filas de
    // día juntas para que el encabezado se comparta de verdad).
    const secuencia = [
      ...dias.map((d) => ({ ...d, _tipo: 'habil' as const })),
      ...diasEspeciales.map((d) => ({ ...d, _tipo: 'especial' as const })),
    ].sort((a, b) => (a.fecha_iso || a.fecha || '').localeCompare(b.fecha_iso || b.fecha || ''))

    const bloque2: (Paragraph | Table)[] = []
    let momentoActual: string | null = null
    let filasMomentoActual: TableRow[] = []

    function cerrarMomentoActual() {
      if (momentoActual && filasMomentoActual.length > 0) {
        bloque2.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, borders: bordeEstandar, rows: [encabezadoColumnas(), ...filasMomentoActual] }))
      }
      filasMomentoActual = []
    }

    secuencia.forEach((item: any) => {
      if (item._tipo === 'especial') {
        cerrarMomentoActual()
        momentoActual = null
        bloque2.push(notaDiaEspecial(item))
        return
      }
      if (item.momento_modalidad !== momentoActual) {
        cerrarMomentoActual()
        bloque2.push(bandaMomento(item.momento_modalidad))
        momentoActual = item.momento_modalidad
      }
      filasMomentoActual.push(filaDia(item))
    })
    cerrarMomentoActual()

    // ------------------------------------------------------------
    // BLOQUE 3a — Cierre (HORIZONTAL): evaluación formativa, cajas
    // en blanco, firmas. Va antes de las rúbricas.
    // ------------------------------------------------------------
    function cajaVacia(titulo: string) {
      // Adecuaciones/Evaluación del proyecto/PMC/Programas: la
      // educadora los llena a mano después — no se generan (confirmado
      // sep 2026). Evaluación Formativa: descripción generada
      // pendiente (generarDescripcionEvaluacionFormativa()) — por
      // ahora también en blanco.
      return [etiqueta(titulo), parrafo('', { after: 300, permitirVacio: true })]
    }

    function dosColumnas(t1: string, t2: string) {
      return new Table({
        width: { size: 100, type: WidthType.PERCENTAGE }, borders: bordeSuave,
        rows: [new TableRow({
          children: [
            new TableCell({ width: { size: 50, type: WidthType.PERCENTAGE }, margins: RELLENO_CELDA.amplio, children: [parrafo(t1.toUpperCase(), { bold: true, color: COLOR.indigo, font: FUENTE.titulo, size: TAMANO.sm })] }),
            new TableCell({ width: { size: 50, type: WidthType.PERCENTAGE }, margins: RELLENO_CELDA.amplio, children: [parrafo(t2.toUpperCase(), { bold: true, color: COLOR.indigo, font: FUENTE.titulo, size: TAMANO.sm })] }),
          ],
        })],
      })
    }

    // Firma: la Directora no se busca por consulta (un CCT puede tener
    // 0 o varios directivos vinculados) — la línea queda en blanco
    // para firma física, igual que las cajas de arriba.
    function bloqueFirmas(nombreEducadora: string) {
      return new Table({
        width: { size: 100, type: WidthType.PERCENTAGE }, borders: sinBorde,
        rows: [
          new TableRow({
            children: [
              new TableCell({ width: { size: 50, type: WidthType.PERCENTAGE }, margins: { top: 200 }, borders: { top: { style: BorderStyle.SINGLE, size: 4, color: COLOR.negroAzulado } }, children: [parrafo(nombreEducadora || '—', { align: AlignmentType.CENTER, bold: true })] }),
              new TableCell({ width: { size: 50, type: WidthType.PERCENTAGE }, margins: { top: 200 }, borders: { top: { style: BorderStyle.SINGLE, size: 4, color: COLOR.negroAzulado } }, children: [parrafo(' ', { align: AlignmentType.CENTER })] }),
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

    const bloque3a: (Paragraph | Table)[] = [
      etiqueta('Evaluación formativa'),
      parrafo(evaluacionFormativa, { after: 300 }),
      dosColumnas('Adecuaciones curriculares', 'Evaluación del proyecto'),
      parrafo('', { before: 160, permitirVacio: true }),
      dosColumnas('Actividades PMC y P.A.', 'Programas externos'),
      parrafo('', { before: 300, permitirVacio: true }),
      bloqueFirmas(inst.educadora),
    ]

    // ------------------------------------------------------------
    // BLOQUE 3b — Rúbricas (VERTICAL): sección aparte al final,
    // una por PDA. cada rúbrica inicia en página propia — pero la
    // PRIMERA no necesita salto manual porque el cambio de sección
    // ya fuerza página nueva (evita una hoja en blanco extra).
    // ------------------------------------------------------------
    function rubricaCompleta(r: any, esPrimera: boolean) {
      const encNiveles = new TableRow({
        tableHeader: true,
        children: ['NIVEL', 'DESCRIPTOR'].map((t, i) => new TableCell({
          width: { size: i === 0 ? 22 : 78, type: WidthType.PERCENTAGE }, shading: { type: ShadingType.CLEAR, fill: COLOR.indigo },
          margins: RELLENO_CELDA.normal, children: [parrafo(t, { align: AlignmentType.CENTER, bold: true, color: COLOR.blanco, font: FUENTE.titulo, size: TAMANO.sm })],
        })),
      })
      const niveles: any[] = Array.isArray(r.niveles) ? r.niveles : []
      const filasNiveles = niveles.map((n) => {
        const s = SEMAFORO[n.etiqueta] || { fondo: COLOR.indigoClaro, texto: COLOR.indigo }
        return new TableRow({
          children: [
            new TableCell({ width: { size: 22, type: WidthType.PERCENTAGE }, verticalAlign: VerticalAlign.CENTER, shading: { type: ShadingType.CLEAR, fill: s.fondo }, margins: RELLENO_CELDA.normal, children: [parrafo(n.etiqueta, { align: AlignmentType.CENTER, bold: true, color: s.texto })] }),
            new TableCell({ width: { size: 78, type: WidthType.PERCENTAGE }, margins: RELLENO_CELDA.normal, children: [parrafo(n.descriptor, { align: AlignmentType.JUSTIFIED, size: TAMANO.contenido })] }),
          ],
        })
      })
      const alumnos: string[] = Array.isArray(r.registro_alumnos) ? r.registro_alumnos.map((a: any) => a.codigo) : []
      const anchoColNumero = 6
      const anchoColAlumno = 28
      const anchoColNivel = Math.floor((100 - anchoColNumero - anchoColAlumno) / niveles.length)
      const encAlumnos = new TableRow({
        tableHeader: true,
        children: ['Nº', 'ALUMNO', ...niveles.map((n) => n.etiqueta)].map((t, i) => new TableCell({
          width: { size: i === 0 ? anchoColNumero : i === 1 ? anchoColAlumno : anchoColNivel, type: WidthType.PERCENTAGE },
          shading: { type: ShadingType.CLEAR, fill: COLOR.indigoClaro },
          margins: RELLENO_CELDA.compacto,
          children: [parrafo(t, { align: AlignmentType.CENTER, bold: true, color: COLOR.indigo, size: TAMANO.sm })],
        })),
      })
      const filasAlumnos = alumnos.map((codigo, idx) => new TableRow({
        children: [
          new TableCell({ width: { size: anchoColNumero, type: WidthType.PERCENTAGE }, margins: RELLENO_CELDA.compacto, children: [parrafo(String(idx + 1), { align: AlignmentType.CENTER, bold: true })] }),
          new TableCell({ width: { size: anchoColAlumno, type: WidthType.PERCENTAGE }, margins: RELLENO_CELDA.compacto, children: [parrafo(codigo, { bold: true })] }),
          ...niveles.map(() => new TableCell({ width: { size: anchoColNivel, type: WidthType.PERCENTAGE }, margins: RELLENO_CELDA.compacto, children: [parrafo('', { permitirVacio: true })] })),
        ],
      }))

      const bloques: (Paragraph | Table)[] = []
      if (!esPrimera) bloques.push(new Paragraph({ children: [new PageBreak()] })) // solo entre rúbricas, no antes de la 1a
      bloques.push(
        parrafo(`${r.campo} — ${r.pda}`, { after: 100, italics: true }),
        new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, borders: bordeEstandar, rows: [encNiveles, ...filasNiveles] }),
        parrafo('Escala estimativa de logro', { before: 160, after: 60, bold: true, color: COLOR.indigo, font: FUENTE.titulo, size: TAMANO.sm }),
        new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, borders: bordeEstandar, rows: [encAlumnos, ...filasAlumnos] }),
      )
      return bloques
    }

    const bloque3b: (Paragraph | Table)[] = [
      etiqueta('Rúbricas de evaluación'),
      ...rubricas.flatMap((r, i) => rubricaCompleta(r, i === 0)),
    ]

    // ------------------------------------------------------------
    // Ensamblar documento — 2 secciones: horizontal (Bloques 1, 2,
    // 3a) y vertical (Bloque 3b, rúbricas). Cada sección lleva su
    // propia instancia de Header/Footer.
    // ------------------------------------------------------------
    const doc = new Document({
      sections: [
        {
          properties: { page: { size: { width: PAGINA.ancho, height: PAGINA.alto }, margin: PAGINA.margenes } },
          headers: { default: crearHeader() },
          footers: { default: crearFooter() },
          children: [
            ...bloque1,
            new Paragraph({ children: [new PageBreak()] }), // salto fijo Bloque1 → Bloque2
            ...bloque2,
            new Paragraph({ children: [new PageBreak()] }), // salto fijo Bloque2 → Bloque3a
            ...bloque3a,
          ],
        },
        {
          properties: { page: { size: { width: PAGINA.alto, height: PAGINA.ancho }, margin: PAGINA.margenes } }, // dimensiones invertidas = vertical
          headers: { default: crearHeader() },
          footers: { default: crearFooter() },
          children: [
            ...bloque3b,
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