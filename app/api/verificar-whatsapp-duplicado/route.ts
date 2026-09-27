import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verificarUsuario } from '@/lib/verificarUsuario'

// Deja solo dígitos -- así "811 213 3238", "811-213-3238" y "8112133238"
// se comparan como el mismo número, sin importar cómo lo haya escrito
// cada educadora.
function normalizarWhatsapp(v: string): string {
  return (v || '').replace(/\D/g, '')
}

export async function POST(req: NextRequest) {
  try {
    // [sep 2026, saneamiento Fase 0] El usuario a excluir ya NO viene del
    // body (el navegador podía mandar cualquier auth_uid). Con token Bearer
    // válido (Configuración) se excluye al usuario verificado; sin token
    // (registro, aún no hay cuenta) no se excluye a nadie.
    let excluirAuthUid: string | null = null
    if (req.headers.get('authorization')?.startsWith('Bearer ')) {
      const auth = await verificarUsuario(req)
      if (!auth.autorizado) {
        return NextResponse.json({ error: auth.error }, { status: auth.status })
      }
      excluirAuthUid = auth.usuario.auth_uid
    }

    const { whatsapp } = await req.json()
    const normalizado = normalizarWhatsapp(whatsapp)
    if (!normalizado || normalizado.length < 10) {
      return NextResponse.json({ error: 'WhatsApp inválido.' }, { status: 400 })
    }

    // El número se guarda tal como lo escribió la persona ("811 213 3238",
    // "811-213-3238"...), así que no sirve una igualdad exacta en la base.
    // Se consulta solo por candidatos: un patrón con "%" entre cada dígito
    // acepta cualquier separador. Luego se confirma con la MISMA comparación
    // de dígitos de siempre sobre esas pocas filas.
    const patron = `%${normalizado.split('').join('%')}%`
    const { data, error } = await supabaseAdmin
      .from('users')
      .select('auth_uid, whatsapp')
      .like('whatsapp', patron)

    if (error) {
      return NextResponse.json({ error: 'Error al verificar.' }, { status: 500 })
    }

    const duplicado = (data || []).some(
      (u: any) => normalizarWhatsapp(u.whatsapp) === normalizado && u.auth_uid !== excluirAuthUid
    )

    // Nunca revela de quién es el número -- mismo principio de
    // privacidad que verificar-cct-duplicado.
    return NextResponse.json({ duplicado })
  } catch (error) {
    console.error('Error verificar-whatsapp-duplicado:', error)
    return NextResponse.json({ error: 'Error interno del servidor.' }, { status: 500 })
  }
}