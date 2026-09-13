// app/api/cct-confirmar/route.ts
// POST /api/cct-confirmar
// body: { cv_cct: string, campo: 'zona'|'sector'|'region'|'turno', valor: string }
// header: Authorization: Bearer <access_token>
//
// El usuario se identifica con el mismo guardia que ya usa el resto de
// la app (lib/verificarUsuario.ts) -- nunca se confia en un user_id
// que venga en el body.
import { verificarUsuario } from '@/lib/verificarUsuario'
import { NextRequest, NextResponse } from 'next/server'

const ABREVIATURAS_TURNO: Record<string, string> = {
  TM: 'MATUTINO',
  TV: 'VESPERTINO',
}

function normalizarValor(campo: string, valorCrudo: string): string {
  const limpio = valorCrudo.trim()
  if (campo === 'turno') {
    const abreviatura = ABREVIATURAS_TURNO[limpio.toUpperCase()]
    return abreviatura ?? limpio.toUpperCase()
    // Nota: Continuo/Discontinuo (u otro valor no reconocido) pasa tal cual,
    // sin reinterpretarlo -- se le pregunta a la educadora si es correcto,
    // no se le fuerza a Matutino/Vespertino.
  }
  return limpio
}

export async function POST(req: NextRequest) {
  const auth = await verificarUsuario(req)
  if (!auth.autorizado) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }
  const { supabaseAdmin, usuario } = auth
  const user_id = usuario.id

  const { cv_cct, campo, valor } = await req.json()

  if (!cv_cct || !campo || !valor) {
    return NextResponse.json({ error: 'Faltan datos' }, { status: 400 })
  }
  if (!['zona', 'sector', 'region', 'turno'].includes(campo)) {
    return NextResponse.json({ error: 'Campo invalido' }, { status: 400 })
  }

  const valorNormalizado = normalizarValor(campo, valor)

  // Suma confirmacion si el valor ya existe como candidato para este CCT+campo,
  // o crea un candidato nuevo con contador 1.
  const { data: existente } = await supabaseAdmin
    .from('cct_valores_comunitarios')
    .select('id, veces_confirmado')
    .eq('cv_cct', cv_cct)
    .eq('campo', campo)
    .eq('valor', valorNormalizado)
    .maybeSingle()

  if (existente) {
    await supabaseAdmin
      .from('cct_valores_comunitarios')
      .update({
        veces_confirmado: existente.veces_confirmado + 1,
        ultima_confirmacion: new Date().toISOString(),
      })
      .eq('id', existente.id)
  } else {
    await supabaseAdmin.from('cct_valores_comunitarios').insert({
      cv_cct,
      campo,
      valor: valorNormalizado,
      veces_confirmado: 1,
    })
  }

  // Actualiza el valor "vivo" en el perfil de la educadora autenticada
  // (nunca el de otra persona -- user_id viene del token, no del body).
  if (campo === 'turno') {
    await supabaseAdmin
      .from('users')
      .update({ shift_primary: valorNormalizado })
      .eq('id', user_id)
  } else {
    const columnaValor = campo // 'zona' | 'sector' | 'region'
    const columnaConfirmada = `${campo}_confirmada`
    await supabaseAdmin
      .from('users')
      .update({ [columnaValor]: valorNormalizado, [columnaConfirmada]: true })
      .eq('id', user_id)
  }

  return NextResponse.json({ ok: true, valor_guardado: valorNormalizado })
}