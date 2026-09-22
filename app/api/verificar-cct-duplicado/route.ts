import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization') || ''
    const token = authHeader.replace('Bearer ', '')
    if (!token) {
      return NextResponse.json({ error: 'No autorizado.' }, { status: 401 })
    }
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado.' }, { status: 401 })
    }

    const { cct } = await req.json()
    if (!cct || cct.length !== 10) {
      return NextResponse.json({ error: 'CCT inválido.' }, { status: 400 })
    }

    // Solo cuenta perfiles ya completados (evita falsos positivos de
    // onboardings abandonados) y excluye a la propia cuenta que consulta.
    // Nunca revela quién es esa otra cuenta ni cuántas hay -- eso es
    // privado; solo el Directivo lo ve, en su propio dashboard.
    const { count, error } = await supabaseAdmin
      .from('users')
      .select('id', { count: 'exact', head: true })
      .eq('cct_primary', cct.toUpperCase())
      .eq('profile_completed', true)
      .neq('auth_uid', user.id)

    if (error) {
      return NextResponse.json({ error: 'Error al verificar.' }, { status: 500 })
    }

    return NextResponse.json({ existe: (count || 0) > 0 })
  } catch (error) {
    console.error('Error verificar-cct-duplicado:', error)
    return NextResponse.json({ error: 'Error interno del servidor.' }, { status: 500 })
  }
}