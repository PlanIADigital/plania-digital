// ============================================================
//  PlanIA Digital — Exportar planeación a Word (.docx)
//  app/api/exportar-word/route.ts
//
//  Recibe el contenido completo de una planeación (ya cargado en
//  el navegador — no vuelve a consultar Supabase) más el estilo
//  de plantilla elegido, y regresa el archivo .docx listo para
//  descargar. Ver lib/wordTemplates.ts para las decisiones de
//  diseño de cada plantilla.
// ============================================================
import { NextRequest, NextResponse } from 'next/server'
import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, PageNumber, AlignmentType, BorderStyle, WidthType,
  VerticalAlign, HeadingLevel,
} from 'docx'
import { PLANTILLAS, MEDIDAS, type EstiloPlantilla } from '@/lib/wordTemplates'

const BORDE_TABLA = {
  top: { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC' },
  bottom: { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC' },
  left: { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC' },
  right: { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC' },
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const estilo: EstiloPlantilla = body.estilo === 'clasica' ? 'clasica' : 'institucional'
    const cfg = PLANTILLAS[estilo]
    const proyecto = body.proyecto || {}
    const dias: any[] = Array.isArray(body.dias) ? body.dias : []
    const ajustes: any[] = Array.isArray(body.ajustes_por_dia) ? body.ajustes_por_dia : []
    const instrumentos: any[] = Array.isArray(body.instrumentos_evaluacion) ? body.instrumentos_evaluacion : []

    // ---- Helpers de estilo, para no repetir configuración en cada Paragraph ----
    const tituloProyecto = (texto: string) => new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 100 },
      children: [new TextRun({ text: texto, bold: true, size: MEDIDAS.tituloProyecto, color: cfg.colorPrincipal, font: cfg.fuente })],
    })

    const tituloSeccion = (texto: string) => new Paragraph({
      spacing: { before: 300, after: 150 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: cfg.colorAcento } },
      children: [new TextRun({ text: texto, bold: true, size: MEDIDAS.tituloSeccion, color: cfg.colorPrincipal, font: cfg.fuente })],
    })

    const subtitulo = (texto: string) => new Paragraph({
      spacing: { before: 200, after: 80 },
      children: [new TextRun({ text: texto, bold: true, size: MEDIDAS.subtitulo, color: cfg.colorAcento, font: cfg.fuente })],
    })

    const parrafo = (etiqueta: string, texto: string) => new Paragraph({
      spacing: { after: 120 },
      children: [
        new TextRun({ text: etiqueta + ': ', bold: true, size: MEDIDAS.cuerpo, color: cfg.colorTexto, font: cfg.fuente }),
        new TextRun({ text: texto || '—', size: MEDIDAS.cuerpo, color: cfg.colorTexto, font: cfg.fuente }),
      ],
    })

    const celda = (texto: string, opts: { negrita?: boolean; fondo?: string; ancho?: number } = {}) => new TableCell({
      width: opts.ancho ? { size: opts.ancho, type: WidthType.PERCENTAGE } : undefined,
      shading: opts.fondo ? { fill: opts.fondo } : undefined,
      verticalAlign: VerticalAlign.CENTER,
      margins: { top: 80, bottom: 80, left: 100, right: 100 },
      borders: BORDE_TABLA,
      children: [new Paragraph({
        children: [new TextRun({ text: texto || '—', bold: !!opts.negrita, size: MEDIDAS.cuerpo, color: cfg.colorTexto, font: cfg.fuente })],
      })],
    })

    // ---- Portada / datos generales del proyecto ----
    const bloqueEncabezado = [
      tituloProyecto(proyecto.project_name || 'Planeación didáctica'),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 300 },
        children: [new TextRun({
          text: `${proyecto.metodologia || ''} · ${proyecto.starts_on || ''} al ${proyecto.ends_on || ''}`,
          size: MEDIDAS.cuerpo, color: cfg.colorAcento, font: cfg.fuente, italics: true,
        })],
      }),
      tituloSeccion('Datos del proyecto'),
      parrafo('Situación problema', proyecto.situacion_problema),
      parrafo('Propósito', proyecto.finalidad),
      parrafo('Campo formativo principal', proyecto.campo_principal),
      parrafo('PDA principal', proyecto.pda_principal),
    ]

    // ---- Un bloque por cada día ----
    const bloqueDias: Paragraph[] = []
    dias.forEach((dia) => {
      bloqueDias.push(tituloSeccion(`Día ${dia.numero} — ${dia.fecha || ''}`))
      if (dia.momento_modalidad) bloqueDias.push(parrafo('Momento', dia.momento_modalidad))
      bloqueDias.push(subtitulo('Inicio'))
      bloqueDias.push(new Paragraph({ spacing: { after: 120 }, children: [new TextRun({ text: dia.inicio || '—', size: MEDIDAS.cuerpo, color: cfg.colorTexto, font: cfg.fuente })] }))
      bloqueDias.push(subtitulo('Desarrollo'))
      bloqueDias.push(new Paragraph({ spacing: { after: 120 }, children: [new TextRun({ text: dia.desarrollo || '—', size: MEDIDAS.cuerpo, color: cfg.colorTexto, font: cfg.fuente })] }))
      bloqueDias.push(subtitulo('Cierre'))
      bloqueDias.push(new Paragraph({ spacing: { after: 120 }, children: [new TextRun({ text: dia.cierre || '—', size: MEDIDAS.cuerpo, color: cfg.colorTexto, font: cfg.fuente })] }))
      if (dia.materiales) bloqueDias.push(parrafo('Materiales', dia.materiales))
      if (dia.actividad_complementaria) bloqueDias.push(parrafo('Actividad complementaria', dia.actividad_complementaria))
    })

    // ---- Tabla de ajustes razonables (si hay alumnos de inclusión) ----
    const bloqueAjustes: (Paragraph | Table)[] = []
    if (ajustes.length > 0) {
      bloqueAjustes.push(tituloSeccion('Ajustes razonables por día'))
      bloqueAjustes.push(new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({
            children: [
              celda('Día', { negrita: true, fondo: cfg.colorPrincipal, ancho: 10 }),
              celda('Código', { negrita: true, fondo: cfg.colorPrincipal, ancho: 15 }),
              celda('Ajuste', { negrita: true, fondo: cfg.colorPrincipal, ancho: 75 }),
            ],
          }),
          ...ajustes.map((a) => new TableRow({
            children: [
              celda(String(a.numero), { ancho: 10 }),
              celda(a.codigo, { ancho: 15 }),
              celda(a.ajuste, { ancho: 75 }),
            ],
          })),
        ],
      }))
    }

    // ---- Instrumentos de evaluación (rúbrica + registro por alumno) ----
    const bloqueEvaluacion: (Paragraph | Table)[] = []
    instrumentos.forEach((inst) => {
      bloqueEvaluacion.push(tituloSeccion('Instrumento de evaluación'))
      bloqueEvaluacion.push(parrafo('PDA evaluado', inst.pda_evaluado || inst.pda))
      bloqueEvaluacion.push(parrafo('Campo formativo', inst.campo))
      const niveles: any[] = Array.isArray(inst.niveles) ? inst.niveles : []
      if (niveles.length > 0) {
        bloqueEvaluacion.push(subtitulo('Niveles de logro'))
        bloqueEvaluacion.push(new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({
              children: [
                celda('Nivel', { negrita: true, fondo: cfg.colorPrincipal, ancho: 20 }),
                celda('Descriptor', { negrita: true, fondo: cfg.colorPrincipal, ancho: 80 }),
              ],
            }),
            ...niveles.map((n) => new TableRow({
              children: [celda(n.etiqueta, { negrita: true, ancho: 20 }), celda(n.descriptor, { ancho: 80 })],
            })),
          ],
        }))
      }
      const roster: any[] = Array.isArray(inst.registro_alumnos) ? inst.registro_alumnos : []
      if (roster.length > 0) {
        bloqueEvaluacion.push(subtitulo('Registro de alumnos (a llenar a mano)'))
        bloqueEvaluacion.push(new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({
              children: [
                celda('Alumno', { negrita: true, fondo: cfg.colorPrincipal, ancho: 30 }),
                celda('Logrado', { negrita: true, fondo: cfg.colorPrincipal, ancho: 23 }),
                celda('En proceso', { negrita: true, fondo: cfg.colorPrincipal, ancho: 23 }),
                celda('Requiere apoyo', { negrita: true, fondo: cfg.colorPrincipal, ancho: 24 }),
              ],
            }),
            ...roster.map((r) => new TableRow({
              children: [celda(r.codigo, { negrita: true, ancho: 30 }), celda('', { ancho: 23 }), celda('', { ancho: 23 }), celda('', { ancho: 24 })],
            })),
          ],
        }))
      }
    })

    // ---- Ensamblar el documento completo ----
    const doc = new Document({
      sections: [{
        properties: {
          page: {
            size: { width: 12240, height: 15840 }, // Carta, en twips
            margin: { top: MEDIDAS.margenPaginaTwips, bottom: MEDIDAS.margenPaginaTwips, left: MEDIDAS.margenPaginaTwips, right: MEDIDAS.margenPaginaTwips },
          },
        },
        headers: {
          default: new Header({ children: [] }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({ text: 'Generado con PlanIA Digital · plania.digital', size: MEDIDAS.piePagina, color: '9CA3AF', font: cfg.fuente }),
                  new TextRun({ text: '   ·   Página ', size: MEDIDAS.piePagina, color: '9CA3AF', font: cfg.fuente }),
                  new TextRun({ children: [PageNumber.CURRENT], size: MEDIDAS.piePagina, color: '9CA3AF', font: cfg.fuente }),
                ],
              }),
            ],
          }),
        },
        children: [
          ...bloqueEncabezado,
          ...bloqueDias,
          ...bloqueAjustes,
          ...bloqueEvaluacion,
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