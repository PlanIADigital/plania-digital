// ============================================================
//  PlanIA Digital — lib/diarioWord.ts
//  [2 oct 2026] Word de Mi diario, mismo sistema visual que las
//  planeaciones (lib/wordTemplateTokens): logo arriba, bloque
//  institucional, contenido. Carta vertical.
//   - construirDiarioWord: notas del periodo/filtro, por día, con
//     ambas horas, marca de editada y anuladas tachadas con motivo.
//   - construirIncidenteWord: una página por incidente con ambas
//     horas, texto vigente, historial de versiones y firmas.
//  Solo códigos AL-XX; el nombre del alumno se escribe a mano.
//  Funciones puras (sin base de datos) para probarlas aisladas.
// ============================================================
import {
  AlignmentType, BorderStyle, Document, Footer, Header, PageNumber, PageOrientation, Packer,
  Paragraph, ShadingType, Table, TableCell, TableRow, TextRun, VerticalAlign, WidthType,
} from 'docx'
import { PAGINA, COLOR, FUENTE, TAMANO, BORDE, RELLENO_CELDA } from '@/lib/wordTemplateTokens'

export type Institucional = {
  jardin: string; cct: string; zona: string | null; sector: string | null; region: string | null
  ciclo: string; educadora: string; grupoLargo: string
}
export type VersionWord = { numero: number; texto: string; origen: string; creadoEn: string } // creadoEn ya formateado
export type NotaWord = {
  destinatario: string; tipo: 'observacion' | 'incidente'
  dia: string          // "Viernes 2 de octubre de 2026"
  sucedio: string      // "9:39 a.m."
  registrada: string   // "2 oct 2026, 9:40 a.m."
  texto: string
  editada: string | null // fecha formateada de la última edición
  version: number
  anulada: { fecha: string; motivo: string } | null
  versiones?: VersionWord[]
}

const ANCHO_UTIL = PAGINA.alto - PAGINA.margenes.left - PAGINA.margenes.right // carta vertical
const AMBAR = '8A6D1D'
const FRANJA = 'E0B44C'
const linea = { style: BorderStyle.SINGLE, size: BORDE.estandarGrosor, color: BORDE.estandarColor }
const bordes = { top: linea, bottom: linea, left: linea, right: linea }
const nada = { style: BorderStyle.NONE, size: 0, color: COLOR.blanco }

type Opc = { bold?: boolean; size?: number; color?: string; italics?: boolean; font?: string; strike?: boolean }
const texto = (t: string, o: Opc = {}) =>
  new TextRun({ text: t, font: o.font || FUENTE.cuerpo, bold: o.bold, italics: o.italics, strike: o.strike, size: o.size ?? TAMANO.base, color: o.color })
function parrafo(t: string, o: Opc & { align?: (typeof AlignmentType)[keyof typeof AlignmentType]; before?: number; after?: number; keepNext?: boolean } = {}) {
  return new Paragraph({ alignment: o.align, keepNext: o.keepNext, spacing: { before: o.before ?? 0, after: o.after ?? 0 }, children: [texto(t, o)] })
}
const quien = (d: string) => (d === 'grupo' ? 'Todo el grupo' : d)
const tipoNombre = (t: string) => (t === 'incidente' ? 'Incidente' : 'Observación')

function encabezadoPagina() {
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
function piePagina() {
  return new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({ text: 'Generado con PlanIA Digital · Pág. ', color: COLOR.grisSuave, font: FUENTE.cuerpo, size: TAMANO.xs }),
          new TextRun({ children: [PageNumber.CURRENT], color: COLOR.grisSuave, font: FUENTE.cuerpo, size: TAMANO.xs }),
        ],
      }),
      parrafo('PlanIA Digital no es una entidad afiliada, patrocinada ni respaldada por la SEP.', { align: AlignmentType.CENTER, color: COLOR.grisSuave, size: TAMANO.xs }),
    ],
  })
}
function bloqueInstitucional(i: Institucional): Paragraph[] {
  return [
    parrafo(i.jardin, { align: AlignmentType.CENTER, bold: true, color: COLOR.indigo, font: FUENTE.titulo, size: TAMANO.lg, after: 20 }),
    parrafo(`CCT ${i.cct || '—'}  Zona ${i.zona || '—'}  Sector ${i.sector || '—'}  Región ${i.region || '—'}`, { align: AlignmentType.CENTER, color: COLOR.grisSuave, font: FUENTE.titulo, size: TAMANO.md, after: 20 }),
    parrafo(`Ciclo Escolar ${i.ciclo || '—'}`, { align: AlignmentType.CENTER, color: COLOR.grisSuave, font: FUENTE.titulo, size: TAMANO.base, after: 200 }),
    parrafo(`Educadora ${i.educadora || '—'} del Grupo ${i.grupoLargo || '—'}`, { align: AlignmentType.CENTER, bold: true, color: COLOR.indigo, font: FUENTE.titulo, size: TAMANO.mdl, after: 200 }),
  ]
}
function documento(titulo: string, children: Array<Paragraph | Table>) {
  return new Document({
    creator: 'PlanIA Digital',
    title: titulo,
    styles: { default: { document: { run: { font: FUENTE.cuerpo, size: TAMANO.base } } } },
    sections: [{
      properties: { page: { size: { width: PAGINA.alto, height: PAGINA.ancho, orientation: PageOrientation.PORTRAIT }, margin: PAGINA.margenes } },
      headers: { default: encabezadoPagina() },
      footers: { default: piePagina() },
      children,
    }],
  })
}

// Una nota como tabla de una celda con franja izquierda (ámbar si es incidente).
function bloqueNota(n: NotaWord): Table {
  const anulada = !!n.anulada
  const contenido: Paragraph[] = [
    new Paragraph({
      keepNext: true,
      children: [
        texto(`${quien(n.destinatario)} · ${tipoNombre(n.tipo)}`, { bold: true, font: FUENTE.titulo, size: TAMANO.sm, color: n.tipo === 'incidente' ? AMBAR : COLOR.indigo }),
        texto(`   Sucedió ${n.sucedio} · Registrada ${n.registrada}`, { size: TAMANO.xs, color: COLOR.grisSuave }),
      ],
    }),
    parrafo(n.texto, { before: 60, size: TAMANO.contenido, strike: anulada, color: anulada ? COLOR.grisSuave : COLOR.negroAzulado }),
  ]
  if (n.editada) contenido.push(parrafo(`Editada · ${n.editada} (versión ${n.version})`, { before: 40, italics: true, size: TAMANO.xs, color: COLOR.grisSuave }))
  if (n.anulada) contenido.push(parrafo(`ANULADA el ${n.anulada.fecha} · Motivo: ${n.anulada.motivo}`, { before: 40, bold: true, size: TAMANO.xs, color: AMBAR }))
  return new Table({
    width: { size: ANCHO_UTIL, type: WidthType.DXA },
    columnWidths: [ANCHO_UTIL],
    rows: [new TableRow({
      cantSplit: true,
      children: [new TableCell({
        width: { size: ANCHO_UTIL, type: WidthType.DXA },
        borders: { top: nada, bottom: { style: BorderStyle.SINGLE, size: 2, color: COLOR.indigoClaro }, right: nada, left: { style: BorderStyle.SINGLE, size: 24, color: n.tipo === 'incidente' ? FRANJA : COLOR.indigoClaro } },
        margins: { top: 90, bottom: 90, left: 160, right: 80 },
        children: contenido,
      })],
    })],
  })
}

export async function construirDiarioWord(d: {
  inst: Institucional; descripcion: string; notas: NotaWord[]
}): Promise<Buffer> {
  const cuerpo: Array<Paragraph | Table> = [
    ...bloqueInstitucional(d.inst),
    parrafo('MI DIARIO', { align: AlignmentType.CENTER, bold: true, color: COLOR.negroAzulado, font: FUENTE.titulo, size: TAMANO.md, after: 20 }),
    parrafo(`${d.descripcion} · ${d.notas.length} ${d.notas.length === 1 ? 'nota' : 'notas'}`, { align: AlignmentType.CENTER, italics: true, color: COLOR.grisSuave, size: TAMANO.sm, after: 200 }),
  ]
  if (d.notas.length === 0) {
    cuerpo.push(parrafo('No hay notas con estos filtros.', { align: AlignmentType.CENTER, color: COLOR.grisSuave }))
  }
  let diaActual = ''
  for (const n of d.notas) {
    if (n.dia !== diaActual) {
      diaActual = n.dia
      cuerpo.push(parrafo(n.dia, { before: 240, after: 80, bold: true, font: FUENTE.titulo, size: TAMANO.base, color: COLOR.cian, keepNext: true }))
    }
    cuerpo.push(bloqueNota(n))
  }
  cuerpo.push(parrafo('Las notas identifican a los niños solo por código; PlanIA Digital no guarda nombres de alumnos.', { before: 240, italics: true, size: TAMANO.xs, color: COLOR.grisSuave }))
  return Packer.toBuffer(documento('Mi diario', cuerpo))
}

export async function construirIncidenteWord(d: { inst: Institucional; nota: NotaWord }): Promise<Buffer> {
  const n = d.nota
  const fila = (etq: string, valor: string) => new TableRow({
    children: [
      new TableCell({ width: { size: 2800, type: WidthType.DXA }, borders: bordes, margins: RELLENO_CELDA.compacto, verticalAlign: VerticalAlign.CENTER,
        shading: { fill: COLOR.indigoClaro, type: ShadingType.CLEAR, color: 'auto' },
        children: [parrafo(etq, { bold: true, font: FUENTE.titulo, size: TAMANO.sm, color: COLOR.indigo })] }),
      new TableCell({ width: { size: ANCHO_UTIL - 2800, type: WidthType.DXA }, borders: bordes, margins: RELLENO_CELDA.compacto, verticalAlign: VerticalAlign.CENTER,
        children: [parrafo(valor, { size: TAMANO.contenido })] }),
    ],
  })
  const datos = new Table({
    width: { size: ANCHO_UTIL, type: WidthType.DXA },
    columnWidths: [2800, ANCHO_UTIL - 2800],
    rows: [
      fila('Alumno', n.destinatario === 'grupo' ? 'Todo el grupo' : `${n.destinatario}   ·   Nombre (a mano): ______________________________`),
      fila('Sucedió', `${n.dia}, ${n.sucedio}`),
      fila('Registrada en PlanIA', n.registrada),
      fila('Estado', n.anulada ? `Anulada el ${n.anulada.fecha} · Motivo: ${n.anulada.motivo}` : n.editada ? `Vigente · editada el ${n.editada} (versión ${n.version})` : 'Vigente · sin ediciones'),
    ],
  })
  const firmas = new Table({
    width: { size: ANCHO_UTIL, type: WidthType.DXA },
    columnWidths: [ANCHO_UTIL / 2, ANCHO_UTIL / 2],
    rows: [new TableRow({
      children: [
        { quien: 'Educadora', nombre: d.inst.educadora },
        { quien: 'Dirección', nombre: 'Nombre y firma' },
      ].map(f => new TableCell({
        width: { size: ANCHO_UTIL / 2, type: WidthType.DXA },
        borders: { top: nada, bottom: nada, left: nada, right: nada },
        margins: { top: 0, bottom: 0, left: 300, right: 300 },
        children: [
          parrafo('', { before: 900 }),
          new Paragraph({ border: { top: { style: BorderStyle.SINGLE, size: 6, color: COLOR.negroAzulado, space: 4 } }, alignment: AlignmentType.CENTER, children: [texto(f.nombre, { size: TAMANO.sm })] }),
          parrafo(f.quien, { align: AlignmentType.CENTER, bold: true, font: FUENTE.titulo, size: TAMANO.sm, color: COLOR.indigo }),
        ],
      })),
    })],
  })

  const cuerpo: Array<Paragraph | Table> = [
    ...bloqueInstitucional(d.inst),
    parrafo('REPORTE DE INCIDENTE', { align: AlignmentType.CENTER, bold: true, color: AMBAR, font: FUENTE.titulo, size: TAMANO.md, after: 200 }),
    datos,
    parrafo('Descripción de lo sucedido', { before: 240, after: 80, bold: true, font: FUENTE.titulo, size: TAMANO.base, color: COLOR.indigo }),
    parrafo(n.texto, { size: TAMANO.contenido, strike: !!n.anulada, color: n.anulada ? COLOR.grisSuave : COLOR.negroAzulado }),
  ]
  if (n.versiones && n.versiones.length > 1) {
    cuerpo.push(parrafo('Historial de versiones', { before: 240, after: 60, bold: true, font: FUENTE.titulo, size: TAMANO.sm, color: COLOR.grisSuave }))
    for (const v of n.versiones) {
      cuerpo.push(parrafo(`Versión ${v.numero} · ${v.origen === 'edicion' ? 'editada' : 'original'} · ${v.creadoEn}`, { before: 60, bold: true, size: TAMANO.xs, color: COLOR.grisSuave }))
      cuerpo.push(parrafo(v.texto, { size: TAMANO.xs, color: COLOR.grisSuave }))
    }
  }
  cuerpo.push(parrafo('Observaciones de la dirección:', { before: 240, after: 60, bold: true, font: FUENTE.titulo, size: TAMANO.sm, color: COLOR.indigo }))
  cuerpo.push(new Table({
    width: { size: ANCHO_UTIL, type: WidthType.DXA },
    columnWidths: [ANCHO_UTIL],
    rows: [0, 1, 2].map(() => new TableRow({
      height: { value: 420, rule: 'atLeast' as any },
      children: [new TableCell({
        width: { size: ANCHO_UTIL, type: WidthType.DXA },
        borders: { top: nada, left: nada, right: nada, bottom: { style: BorderStyle.SINGLE, size: 4, color: COLOR.grisSuave } },
        children: [parrafo('')],
      })],
    })),
  }))
  cuerpo.push(parrafo('')) // separador: dos tablas juntas se fusionan en Word
  cuerpo.push(firmas)
  cuerpo.push(parrafo('PlanIA Digital solo maneja códigos de alumno. La hora "Registrada" la asigna el sistema y no puede modificarse.', { before: 200, italics: true, size: TAMANO.xs, color: COLOR.grisSuave }))
  return Packer.toBuffer(documento('Reporte de incidente', cuerpo))
}
