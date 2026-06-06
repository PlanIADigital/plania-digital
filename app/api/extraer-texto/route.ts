import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 30

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No se recibió ningún archivo.' }, { status: 400 })
    }

    const nombreArchivo = file.name.toLowerCase()
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // ── PDF ──────────────────────────────────────────────────────────────────
    if (nombreArchivo.endsWith('.pdf')) {
      const { getDocumentProxy, extractText } = await import('unpdf')
      const pdf = await getDocumentProxy(new Uint8Array(buffer))
      const { text } = await extractText(pdf, { mergePages: true })
      const texto = text?.trim()
      if (!texto) {
        return NextResponse.json({ error: 'El PDF no contiene texto legible.' }, { status: 422 })
      }
      return NextResponse.json({ texto })
    }

    // ── DOCX ─────────────────────────────────────────────────────────────────
    if (nombreArchivo.endsWith('.docx')) {
      const mammoth = (await import('mammoth')).default
      const resultado = await mammoth.extractRawText({ buffer })
      const texto = resultado.value?.trim()
      if (!texto) {
        return NextResponse.json({ error: 'El archivo Word no contiene texto legible.' }, { status: 422 })
      }
      return NextResponse.json({ texto })
    }

    // ── DOC (legacy) ──────────────────────────────────────────────────────────
    if (nombreArchivo.endsWith('.doc')) {
      return NextResponse.json({
        error: 'El formato .doc (Word antiguo) no es compatible. Por favor guarda el archivo como .docx e inténtalo de nuevo.'
      }, { status: 415 })
    }

    return NextResponse.json({ error: 'Formato de archivo no soportado.' }, { status: 415 })

  } catch (err: any) {
    console.error('extraer-texto error:', err)
    return NextResponse.json({ error: 'Error interno al procesar el archivo.' }, { status: 500 })
  }
}
