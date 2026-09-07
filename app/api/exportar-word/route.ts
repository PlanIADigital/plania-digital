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
//  Bloque 3 = Cierre (evaluación formativa, rúbricas por PDA,
//             adecuaciones/evaluación proyecto/PMC/programas en
//             blanco para llenar a mano, firmas)
//
//  NOTA: la plantilla "Clásica Serif" se retiró (sep 2026) para
//  simplificar el lanzamiento — solo existe Institucional Índigo.
// ============================================================
import { NextRequest, NextResponse } from 'next/server'
import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, PageNumber, AlignmentType, BorderStyle, WidthType,
  ShadingType, VerticalAlign, PageBreak,
} from 'docx'
import { PAGINA, COLOR, FUENTE, TAMANO, RELLENO_CELDA } from '@/lib/wordTemplateTokens'

// ------------------------------------------------------------
// Bordes reutilizables (derivados de wordTemplateTokens, no
// números sueltos)
// ------------------------------------------------------------
const bordeEstandar = {
  top: { style: BorderStyle.SINGLE, size: 2, color: COLOR.grisSuave },
  bottom: { style: BorderStyle.SINGLE, size: 2, color: COLOR.grisSuave },
  left: { style: BorderStyle.SINGLE, size: 2, color: COLOR.grisSuave },
  right: { style: BorderStyle.SINGLE, size: 2, color: COLOR.grisSuave },
  insideHorizontal: { style: BorderStyle.SINGLE, size: 2, color: COLOR.grisSuave },
  insideVertical: { style: BorderStyle.SINGLE, size: 2, color: COLOR.grisSuave },
}
const bordeSuave = {
  top: { style: BorderStyle.SINGLE, size: 2, color: COLOR.indigoClaro },
  bottom: { style: BorderStyle.SINGLE, size: 2, color: COLOR.indigoClaro },
  left: { style: BorderStyle.SINGLE, size: 2, color: COLOR.indigoClaro },
  right: { style: BorderStyle.SINGLE, size: 2, color: COLOR.indigoClaro },
  insideHorizontal: { style: BorderStyle.SINGLE, size: 2, color: COLOR.indigoClaro },
  insideVertical: { style: BorderStyle.SINGLE, size: 2, color: COLOR.indigoClaro },
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
      size: opts.size || TAMANO.base,
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
    // BLOQUE 1 — Institucional + Pedagógico
    // ------------------------------------------------------------
    const tarjetaDatosGenerales = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: { ...sinBorde, insideHorizontal: { style: BorderStyle.SINGLE, size: 2, color: COLOR.blanco } },
      rows: [
        ['Jardín de Niños', `${inst.jardin || '—'} (${inst.cct || '—'})`],
        ['Educadora', inst.educadora || '—'],
        ['Grupo', `${inst.grado || '—'}${inst.turno ? ' · Turno ' + inst.turno : ''}`],
        ['Periodo', `${proyecto.starts_on || '—'} al ${proyecto.ends_on || '—'}`],
      ].map(([label, valor]) => new TableRow({
        children: [
          new TableCell({
            width: { size: 30, type: WidthType.PERCENTAGE }, shading: { type: ShadingType.CLEAR, fill: COLOR.menta },
            margins: { ...RELLENO_CELDA.normal, left: 200 },
            children: [parrafo(label, { bold: true, color: COLOR.indigo, font: FUENTE.titulo, size: TAMANO.sm })],
          }),
          new TableCell({
            width: { size: 70, type: WidthType.PERCENTAGE }, shading: { type: ShadingType.CLEAR, fill: COLOR.menta },
            margins: { ...RELLENO_CELDA.normal, right: 200 },
            children: [parrafo(valor)],
          }),
        ],
      })),
    })

    const tablaCurricular = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: bordeEstandar,
      rows: [
        new TableRow({
          tableHeader: true,
          children: ['CAMPO FORMATIVO', 'CONTENIDO', 'PDA'].map((t, i) => new TableCell({
            width: { size: i === 0 ? 24 : 38, type: WidthType.PERCENTAGE },
            shading: { type: ShadingType.CLEAR, fill: COLOR.indigo },
            margins: RELLENO_CELDA.normal,
            children: [parrafo(t, { bold: true, color: COLOR.blanco, font: FUENTE.titulo, size: TAMANO.sm })],
          })),
        }),
        ...camposFormativos.map((c) => new TableRow({
          children: [
            new TableCell({ width: { size: 24, type: WidthType.PERCENTAGE }, margins: RELLENO_CELDA.normal, children: [parrafo(c.campo, { bold: true })] }),
            new TableCell({ width: { size: 38, type: WidthType.PERCENTAGE }, margins: RELLENO_CELDA.normal, children: [parrafo(c.contenido)] }),
            new TableCell({ width: { size: 38, type: WidthType.PERCENTAGE }, margins: RELLENO_CELDA.normal, children: [parrafo(`${c.pdaCodigo ? c.pdaCodigo + ' — ' : ''}${c.pdaTexto || ''}`)] }),
          ],
        })),
      ],
    })

    const ejesActivos = ejes.filter((e) => !!e.nombre)
    const tablaEjes = ejesActivos.length > 0 ? new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: bordeEstandar,
      rows: [
        new TableRow({
          tableHeader: true,
          children: ['EJE ARTICULADOR', '¿CÓMO SE FAVORECE?'].map((t, i) => new TableCell({
            width: { size: i === 0 ? 30 : 70, type: WidthType.PERCENTAGE },
            shading: { type: ShadingType.CLEAR, fill: COLOR.indigo },
            margins: RELLENO_CELDA.normal,
            children: [parrafo(t, { bold: true, color: COLOR.blanco, font: FUENTE.titulo, size: TAMANO.sm })],
          })),
        }),
        ...ejesActivos.map((e) => new TableRow({
          children: [
            new TableCell({ width: { size: 30, type: WidthType.PERCENTAGE }, margins: RELLENO_CELDA.normal, children: [parrafo(e.nombre, { bold: true, color: COLOR.indigo })] }),
            // e.descripcion aún no se genera (pendiente: generarDescripcionEje()) — se deja en blanco.
            new TableCell({ width: { size: 70, type: WidthType.PERCENTAGE }, margins: RELLENO_CELDA.normal, children: [parrafo(e.descripcion || '—', { italics: !e.descripcion, color: e.descripcion ? undefined : COLOR.grisSuave })] }),
          ],
        })),
      ],
    }) : null

    const bloque1: (Paragraph | Table)[] = [
      parrafo(proyecto.project_name || 'Planeación didáctica', { bold: true, color: COLOR.indigo, font: FUENTE.titulo, size: TAMANO.xl, after: 40 }),
      parrafo(`Modalidad: ${proyecto.metodologia || '—'}`, { color: COLOR.grisSuave, size: TAMANO.md, after: 200 }),
      tarjetaDatosGenerales,
      parrafo('', { before: 200, permitirVacio: true }),
      etiqueta('Problemática'), parrafo(proyecto.situacion_problema),
      etiqueta('Propósito'), parrafo(proyecto.finalidad),
      etiqueta('Tabla curricular'), tablaCurricular,
    ]
    if (tablaEjes) bloque1.push(parrafo('', { before: 160, permitirVacio: true }), etiqueta('Ejes articuladores'), tablaEjes)

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
          children: [parrafo(t, { bold: true, color: COLOR.indigo, font: FUENTE.titulo, size: TAMANO.sm })],
        })),
      })
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
          new TableCell({ width: { size: anchoColumnas[0], type: WidthType.PERCENTAGE }, verticalAlign: VerticalAlign.CENTER, margins: RELLENO_CELDA.normal, children: [parrafo(dia.fecha, { bold: true })] }),
          new TableCell({ width: { size: anchoColumnas[1], type: WidthType.PERCENTAGE }, margins: RELLENO_CELDA.normal, children: actividades }),
          new TableCell({ width: { size: anchoColumnas[2], type: WidthType.PERCENTAGE }, margins: RELLENO_CELDA.normal, children: ajustesParrafos }),
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
    // BLOQUE 3 — Cierre
    // ------------------------------------------------------------
    function cajaVacia(titulo: string) {
      // Adecuaciones/Evaluación del proyecto/PMC/Programas: la
      // educadora los llena a mano después — no se generan (confirmado
      // sep 2026). Evaluación Formativa: descripción generada
      // pendiente (generarDescripcionEvaluacionFormativa()) — por
      // ahora también en blanco.
      return [etiqueta(titulo), parrafo('', { after: 300, permitirVacio: true })]
    }

    function rubricaCompleta(r: any) {
      const encNiveles = new TableRow({
        tableHeader: true,
        children: ['NIVEL', 'DESCRIPTOR'].map((t, i) => new TableCell({
          width: { size: i === 0 ? 22 : 78, type: WidthType.PERCENTAGE }, shading: { type: ShadingType.CLEAR, fill: COLOR.indigo },
          margins: RELLENO_CELDA.normal, children: [parrafo(t, { bold: true, color: COLOR.blanco, font: FUENTE.titulo, size: TAMANO.sm })],
        })),
      })
      const niveles: any[] = Array.isArray(r.niveles) ? r.niveles : []
      const filasNiveles = niveles.map((n) => {
        const s = SEMAFORO[n.etiqueta] || { fondo: COLOR.indigoClaro, texto: COLOR.indigo }
        return new TableRow({
          children: [
            new TableCell({ width: { size: 22, type: WidthType.PERCENTAGE }, shading: { type: ShadingType.CLEAR, fill: s.fondo }, margins: RELLENO_CELDA.normal, children: [parrafo(n.etiqueta, { bold: true, color: s.texto })] }),
            new TableCell({ width: { size: 78, type: WidthType.PERCENTAGE }, margins: RELLENO_CELDA.normal, children: [parrafo(n.descriptor, { size: TAMANO.sm })] }),
          ],
        })
      })
      const alumnos: string[] = Array.isArray(r.registro_alumnos) ? r.registro_alumnos.map((a: any) => a.codigo) : []
      const encAlumnos = new TableRow({
        tableHeader: true,
        children: ['ALUMNO', ...niveles.map((n) => n.etiqueta)].map((t, i) => new TableCell({
          width: { size: i === 0 ? 34 : 22, type: WidthType.PERCENTAGE }, shading: { type: ShadingType.CLEAR, fill: COLOR.indigoClaro },
          margins: RELLENO_CELDA.compacto, children: [parrafo(t, { bold: true, color: COLOR.indigo, size: TAMANO.sm })],
        })),
      })
      const filasAlumnos = alumnos.map((codigo) => new TableRow({
        children: [
          new TableCell({ width: { size: 34, type: WidthType.PERCENTAGE }, margins: RELLENO_CELDA.compacto, children: [parrafo(codigo, { bold: true })] }),
          ...niveles.map(() => new TableCell({ width: { size: 22, type: WidthType.PERCENTAGE }, margins: RELLENO_CELDA.compacto, children: [parrafo('☐', { align: AlignmentType.CENTER, color: COLOR.grisSuave })] })),
        ],
      }))

      return [
        new Paragraph({ children: [new PageBreak()] }), // cada rúbrica inicia en página propia (REGLAS.rubricaSaltoPaginaPropio)
        parrafo(`${r.campo} — ${r.pda}`, { after: 100, italics: true }),
        new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, borders: bordeEstandar, rows: [encNiveles, ...filasNiveles] }),
        parrafo('Escala estimativa de logro', { before: 160, after: 60, bold: true, color: COLOR.indigo, font: FUENTE.titulo, size: TAMANO.sm }),
        new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, borders: bordeEstandar, rows: [encAlumnos, ...filasAlumnos] }),
      ]
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

    const bloque3: (Paragraph | Table)[] = [
      ...cajaVacia('Evaluación formativa'),
      etiqueta('Rúbricas de evaluación'),
      ...rubricas.flatMap(rubricaCompleta),
      dosColumnas('Adecuaciones curriculares', 'Evaluación del proyecto'),
      parrafo('', { before: 160, permitirVacio: true }),
      dosColumnas('Actividades PMC y P.A.', 'Programas externos'),
      parrafo('', { before: 300, permitirVacio: true }),
      bloqueFirmas(inst.educadora),
    ]

    // ------------------------------------------------------------
    // Ensamblar documento
    // ------------------------------------------------------------
    const doc = new Document({
      sections: [{
        properties: { page: { size: { width: PAGINA.ancho, height: PAGINA.alto }, margin: PAGINA.margenes } },
        headers: {
          default: new Header({
            children: [new Paragraph({
              alignment: AlignmentType.RIGHT,
              children: [
                new TextRun({ text: '✦ PlanIA ', bold: true, color: COLOR.indigo, font: FUENTE.titulo, size: TAMANO.sm }),
                new TextRun({ text: 'Digital', bold: true, color: COLOR.cian, font: FUENTE.titulo, size: TAMANO.sm }),
                new TextRun({ text: ' ✦', bold: true, color: COLOR.indigo, font: FUENTE.titulo, size: TAMANO.sm }),
              ],
            })],
          }),
        },
        footers: {
          default: new Footer({
            children: [new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({ text: 'Generado con PlanIA Digital · plania.digital   ·   Pág. ', color: COLOR.grisSuave, font: FUENTE.cuerpo, size: TAMANO.xs }),
                new TextRun({ children: [PageNumber.CURRENT], color: COLOR.grisSuave, font: FUENTE.cuerpo, size: TAMANO.xs }),
              ],
            })],
          }),
        },
        children: [
          ...bloque1,
          new Paragraph({ children: [new PageBreak()] }), // salto fijo Bloque1 → Bloque2
          ...bloque2,
          new Paragraph({ children: [new PageBreak()] }), // salto fijo Bloque2 → Bloque3
          ...bloque3,
        ],
      }],
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