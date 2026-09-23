import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// Deja solo dígitos -- así "811 213 3238", "811-213-3238" y "8112133238"
// se comparan como el mismo número, sin importar cómo lo haya escrito
// cada educadora.
function normalizarWhatsapp(v: string): string {
  return (v || '').replace(/\D/g, '')
}

export async function POST(req: NextRequest) {
  try {
    const { whatsapp, excluir_auth_uid } = await req.json()
    const normalizado = normalizarWhatsapp(whatsapp)
    if (!normalizado || normalizado.length < 10) {
      return NextResponse.json({ error: 'WhatsApp inválido.' }, { status: 400 })
    }

    // Tabla pequeña por ahora -- se compara en memoria tras normalizar,
    // sin necesitar una columna normalizada aparte. Si la base de
    // usuarios crece mucho, esto debería moverse a una columna indexada.
    const { data, error } = await supabaseAdmin
      .from('users')
      .select('auth_uid, whatsapp')
      .not('whatsapp', 'is', null)

    if (error) {
      return NextResponse.json({ error: 'Error al verificar.' }, { status: 500 })
    }

    const duplicado = (data || []).some(
      (u: any) => normalizarWhatsapp(u.whatsapp) === normalizado && u.auth_uid !== excluir_auth_uid
    )

    // Nunca revela de quién es el número -- mismo principio de
    // privacidad que verificar-cct-duplicado.
    return NextResponse.json({ duplicado })
  } catch (error) {
    console.error('Error verificar-whatsapp-duplicado:', error)
    return NextResponse.json({ error: 'Error interno del servidor.' }, { status: 500 })
  }
}