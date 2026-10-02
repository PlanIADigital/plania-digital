// ============================================================
//  PlanIA Digital — lib/semaforoWord.ts
//  [2 oct 2026] Word imprimible del Semáforo de desempeño de UN
//  grupo y UN momento (educadora). Mismo sistema visual que las
//  planeaciones ("Institucional Índigo", lib/wordTemplateTokens):
//  logo ✦ PlanIA Digital ✦ arriba, bloque institucional, tabla.
//  Solo códigos AL-XX: la columna "Nombre del alumno" va vacía
//  para escribirse a mano; PlanIA nunca guarda nombres de niños.
//  Función pura (sin base de datos) para poder probarla aislada.
// ============================================================
import {
  AlignmentType, BorderStyle, Document, Footer, Header, PageNumber, PageOrientation, Packer,
  Paragraph, ShadingType, Table, TableCell, TableRow, TextRun, VerticalAlign, WidthType,
} from 'docx'
import { PAGINA, COLOR, FUENTE, TAMANO, BORDE, RELLENO_CELDA } from '@/lib/wordTemplateTokens'

type NivelInfo = { clave: string; nombre: string; corto: string; fondo: string; texto: string }

export type DatosSemaforoWord = {
  jardin: string
  cct: string
  zona: string | null
  sector: string | null
  region: string | null
  ciclo: string
  educadora: string
  gradoTexto: string       // "3er Grado" (como en la planeación)
  grupoLetra: string       // "B"
  grupoCorto: string       // "3° B"
  momentoNombre: string    // "Diagnóstico"
  momentoCuando: string    // "Inicio de ciclo"
  enviadoEn: string | null // texto ya formateado, p. ej. "2 de octubre de 2026"
  alumnos: string[]        // AL-01, AL-02…
  areas: string[]
  marcas: Record<string, Record<string, string>> // área → código → nivel
  niveles: NivelInfo[]
}

const hex = (c: string) => c.replace('#', '').toUpperCase()

const lineaEstandar = { style: BorderStyle.SINGLE, size: BORDE.estandarGrosor, color: BORDE.estandarColor }
const bordes = { top: lineaEstandar, bottom: lineaEstandar, left: lineaEstandar, right: lineaEstandar }
const sinLinea = { style: BorderStyle.NONE, size: 0, color: COLOR.blanco }
const sinBordes = { top: sinLinea, bottom: sinLinea, left: sinLinea, right: sinLinea }

type OpcTexto = { bold?: boolean; size?: number; color?: string; italics?: boolean; font?: string }
function texto(t: string, o: OpcTexto = {}) {
  return new TextRun({ text: t, font: o.font || FUENTE.cuerpo, bold: o.bold, italics: o.italics, size: o.size ?? TAMANO.base, color: o.color })
}
function parrafo(t: string, o: OpcTexto & { align?: (typeof AlignmentType)[keyof typeof AlignmentType]; before?: number; after?: number } = {}) {
  return new Paragraph({ alignment: o.align, spacing: { before: o.before ?? 0, after: o.after ?? 0 }, children: [texto(t, o)] })
}

function celda(t: string, ancho: number, o: { fondo?: string; color?: string; bold?: boolean; centro?: boolean; titulo?: boolean } = {}) {
  return new TableCell({
    width: { size: ancho, type: WidthType.DXA },
    borders: bordes,
    verticalAlign: VerticalAlign.CENTER,
    shading: o.fondo ? { fill: hex(o.fondo), type: ShadingType.CLEAR, color: 'auto' } : undefined,
    margins: RELLENO_CELDA.compacto,
    children: [parrafo(t, {
      align: o.centro ? AlignmentType.CENTER : AlignmentType.LEFT,
      bold: o.bold,
      font: o.titulo ? FUENTE.titulo : FUENTE.cuerpo,
      size: o.titulo ? TAMANO.sm : TAMANO.contenido,
      color: o.color ? hex(o.color) : undefined,
    })],
  })
}

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

export async function construirSemaforoWord(d: DatosSemaforoWord): Promise<Buffer> {
  const porClave = new Map(d.niveles.map(n => [n.clave, n]))
  const noEvaluado = porClave.get('no_evaluado')!

  // Carta horizontal con los márgenes de las planeaciones.
  const ANCHO_UTIL = PAGINA.ancho - PAGINA.margenes.left - PAGINA.margenes.right
  const anchoNo = 600
  const anchoCodigo = 1100
  const anchoAreas = Math.min(2000, Math.floor((ANCHO_UTIL - anchoNo - anchoCodigo - 3200) / Math.max(1, d.areas.length)))
  const anchoNombre = ANCHO_UTIL - anchoNo - anchoCodigo - anchoAreas * d.areas.length
  const columnas = [anchoNo, anchoCodigo, anchoNombre, ...d.areas.map(() => anchoAreas)]
  const encabezado = { fondo: COLOR.indigoClaro, bold: true, color: COLOR.indigo, titulo: true }

  const encabezadoTabla = new TableRow({
    tableHeader: true,
    children: [
      celda('No.', anchoNo, { ...encabezado, centro: true }),
      celda('Código', anchoCodigo, { ...encabezado, centro: true }),
      celda('Nombre del alumno (se escribe a mano)', anchoNombre, encabezado),
      ...d.areas.map(a => celda(a, anchoAreas, { ...encabezado, centro: true })),
    ],
  })

  const filas = d.alumnos.map((codigo, i) => new TableRow({
    cantSplit: true,
    children: [
      celda(String(i + 1), anchoNo, { centro: true }),
      celda(codigo, anchoCodigo, { centro: true, bold: true }),
      celda('', anchoNombre),
      ...d.areas.map(a => {
        const n = porClave.get(d.marcas[a]?.[codigo] || '') || null
        return n
          ? celda(n.nombre, anchoAreas, { fondo: n.fondo, color: n.texto, centro: true })
          : celda('Sin marcar', anchoAreas, { fondo: noEvaluado.fondo, color: noEvaluado.texto, centro: true })
      }),
    ],
  }))

  const tablaAlumnos = new Table({
    width: { size: ANCHO_UTIL, type: WidthType.DXA },
    columnWidths: columnas,
    rows: [encabezadoTabla, ...filas],
  })

  // ── Resumen por área: barra apilada (tabla de 1 fila) + cifras ──
  const total = d.alumnos.length
  const resumen: Array<Paragraph | Table> = []
  for (const a of d.areas) {
    const conteo = d.niveles.map(n => ({
      n,
      c: d.alumnos.filter(cod => (d.marcas[a]?.[cod] || 'no_evaluado') === n.clave).length,
    }))
    resumen.push(new Paragraph({
      spacing: { before: 220, after: 60 }, keepNext: true,
      children: [texto(a, { bold: true, font: FUENTE.titulo, size: TAMANO.base, color: COLOR.indigo })],
    }))
    const presentes = conteo.filter(x => x.c > 0)
    if (total > 0 && presentes.length > 0) {
      const ANCHO_BARRA = ANCHO_UTIL
      let restante = ANCHO_BARRA
      const anchos = presentes.map((x, i) => {
        if (i === presentes.length - 1) return restante
        const w = Math.max(200, Math.round(ANCHO_BARRA * x.c / total))
        restante -= w
        return w
      })
      resumen.push(new Table({
        width: { size: ANCHO_BARRA, type: WidthType.DXA },
        columnWidths: anchos,
        rows: [new TableRow({
          height: { value: 340, rule: 'exact' as any },
          children: presentes.map((x, i) => new TableCell({
            width: { size: anchos[i], type: WidthType.DXA },
            borders: sinBordes,
            shading: { fill: hex(x.n.fondo), type: ShadingType.CLEAR, color: 'auto' },
            verticalAlign: VerticalAlign.CENTER,
            children: [parrafo(anchos[i] >= 700 ? `${Math.round(100 * x.c / total)}%` : '', {
              align: AlignmentType.CENTER, bold: true, size: TAMANO.xs, color: hex(x.n.texto),
            })],
          })),
        })],
      }))
    }
    resumen.push(parrafo(
      conteo.map(x => `${x.n.nombre}: ${x.c} (${total ? Math.round(100 * x.c / total) : 0}%)`).join('   ·   '),
      { before: 40, size: TAMANO.sm, color: COLOR.grisSuave }
    ))
  }

  const estado = d.enviadoEn ? `Enviado a dirección el ${d.enviadoEn}` : 'En captura · aún no se envía a dirección'
  const grupoLargo = `${d.gradoTexto} ${d.grupoLetra}`.trim() || d.grupoCorto

  const doc = new Document({
    creator: 'PlanIA Digital',
    title: `Semáforo de desempeño · ${d.grupoCorto} · ${d.momentoNombre}`,
    styles: { default: { document: { run: { font: FUENTE.cuerpo, size: TAMANO.base } } } },
    sections: [{
      properties: {
        page: {
          size: { width: PAGINA.alto, height: PAGINA.ancho, orientation: PageOrientation.LANDSCAPE },
          margin: PAGINA.margenes,
        },
      },
      headers: { default: crearHeader() },
      footers: { default: crearFooter() },
      children: [
        // Bloque institucional (idéntico al de las planeaciones)
        parrafo(d.jardin, { align: AlignmentType.CENTER, bold: true, color: COLOR.indigo, font: FUENTE.titulo, size: TAMANO.lg, after: 20 }),
        parrafo(`CCT ${d.cct || '—'}  Zona ${d.zona || '—'}  Sector ${d.sector || '—'}  Región ${d.region || '—'}`, { align: AlignmentType.CENTER, color: COLOR.grisSuave, font: FUENTE.titulo, size: TAMANO.md, after: 20 }),
        parrafo(`Ciclo Escolar ${d.ciclo || '—'}`, { align: AlignmentType.CENTER, color: COLOR.grisSuave, font: FUENTE.titulo, size: TAMANO.base, after: 200 }),
        parrafo(`Educadora ${d.educadora || '—'} del Grupo ${grupoLargo}`, { align: AlignmentType.CENTER, bold: true, color: COLOR.indigo, font: FUENTE.titulo, size: TAMANO.mdl, after: 200 }),
        // Título del documento
        parrafo(`SEMÁFORO DE DESEMPEÑO · ${d.momentoNombre.toUpperCase()}`, { align: AlignmentType.CENTER, bold: true, color: COLOR.negroAzulado, font: FUENTE.titulo, size: TAMANO.md, after: 20 }),
        parrafo(`${d.momentoCuando} · ${estado}`, { align: AlignmentType.CENTER, italics: true, color: COLOR.grisSuave, size: TAMANO.sm, after: 160 }),
        tablaAlumnos,
        new Paragraph({
          spacing: { before: 120 },
          children: [
            texto('Niveles: ', { bold: true, size: TAMANO.sm }),
            ...d.niveles.map((n, i) => texto(`${n.nombre}${i < d.niveles.length - 1 ? '   ·   ' : ''}`, { size: TAMANO.sm, color: hex(n.texto) })),
          ],
        }),
        parrafo('Los nombres de los niños se escriben a mano en este impreso; PlanIA Digital solo maneja códigos.', { before: 60, italics: true, size: TAMANO.xs, color: COLOR.grisSuave }),
        // Hoja 2: resumen del grupo
        new Paragraph({
          pageBreakBefore: true,
          children: [texto(`RESUMEN DEL GRUPO · ${d.grupoCorto} · ${d.momentoNombre.toUpperCase()}`, { bold: true, font: FUENTE.titulo, size: TAMANO.lg, color: COLOR.indigo })],
        }),
        parrafo(`${total} niños en la lista del grupo.`, { after: 80, size: TAMANO.sm, color: COLOR.grisSuave }),
        ...resumen,
      ],
    }],
  })
  return Packer.toBuffer(doc)
}
