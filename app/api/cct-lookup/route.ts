// app/api/cct-lookup/route.ts
// GET /api/cct-lookup?cv_cct=19DJN0347W
//
// Ajusta el import de abajo si tu cliente de Supabase vive en otra ruta.
import { supabaseAdmin as supabase } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'

type Campo = 'zona' | 'sector' | 'region'

interface CampoResuelto {
  valor: string | null
  origen: 'comunidad' | 'oficial' | 'sugerido_no_aplica' | 'vacio'
  veces_confirmado: number
  necesita_confirmacion: boolean
}

const UMBRAL_NO_APLICA = 95 // % historico de nulos a partir del cual se sugiere "No aplica"
const CONFIRMACIONES_MINIMAS = 3

interface ValorResueltoRow {
  campo: string
  valor_resuelto: string
  veces_confirmado: number
}

export async function GET(req: NextRequest) {
  const cv_cct = req.nextUrl.searchParams.get('cv_cct')?.trim().toUpperCase()

  if (!cv_cct || cv_cct.length !== 10) {
    return NextResponse.json({ error: 'CCT invalido' }, { status: 400 })
  }

  const { data: oficial, error: errOficial } = await supabase
    .from('cct_catalogo_oficial')
    .select('cv_cct, nombre_jardin, administracion, estado, clasificador, region_oficial, region_numero, sector_oficial, sector_numero, zona_oficial, zona_numero, turno')
    .eq('cv_cct', cv_cct)
    .maybeSingle()

  if (errOficial) {
    return NextResponse.json({ error: errOficial.message }, { status: 500 })
  }

  if (!oficial) {
    return NextResponse.json({ encontrado: false })
  }

  // Se copian a variables propias (no-nulas) para poder usarlas dentro de
  // resolverCampo mas abajo -- TypeScript no conserva el chequeo de null
  // de "oficial" dentro de funciones anidadas.
  const estadoCct = oficial.estado
  const clasificadorCct = oficial.clasificador

  // Valores ya confirmados por la comunidad (si los hay) para este CCT
  const { data: resueltos } = await supabase
    .from('v_cct_valores_resueltos')
    .select('campo, valor_resuelto, veces_confirmado')
    .eq('cv_cct', cv_cct)

  const resueltosPorCampo = new Map<string, ValorResueltoRow>(
    (resueltos ?? []).map((r: ValorResueltoRow) => [r.campo, r])
  )

  async function resolverCampo(
    campo: Campo,
    valorOficialNumero: number | null
  ): Promise<CampoResuelto> {
    const comunidad = resueltosPorCampo.get(campo)

    if (comunidad) {
      return {
        valor: comunidad.valor_resuelto,
        origen: 'comunidad',
        veces_confirmado: comunidad.veces_confirmado,
        necesita_confirmacion: comunidad.veces_confirmado < CONFIRMACIONES_MINIMAS,
      }
    }

    // Sin captura comunitaria todavia -> fallback al catalogo oficial
    if (valorOficialNumero !== null) {
      return {
        valor: String(valorOficialNumero),
        origen: 'oficial',
        veces_confirmado: 0,
        necesita_confirmacion: true,
      }
    }

    // Catalogo tampoco lo tiene -> aplicar regla del 95%
    const { data: nulidad } = await supabase
      .from('v_campo_nulidad')
      .select('pct_nulo')
      .eq('estado', estadoCct)
      .eq('clasificador', clasificadorCct)
      .eq('campo', campo)
      .maybeSingle()

    if (nulidad && nulidad.pct_nulo >= UMBRAL_NO_APLICA) {
      return {
        valor: 'No aplica',
        origen: 'sugerido_no_aplica',
        veces_confirmado: 0,
        necesita_confirmacion: true,
      }
    }

    return {
      valor: null,
      origen: 'vacio',
      veces_confirmado: 0,
      necesita_confirmacion: true,
    }
  }

  const [zona, sector, region] = await Promise.all([
    resolverCampo('zona', oficial.zona_numero),
    resolverCampo('sector', oficial.sector_numero),
    resolverCampo('region', oficial.region_numero),
  ])

  const turnoComunidad = resueltosPorCampo.get('turno' as any)

  return NextResponse.json({
    encontrado: true,
    cv_cct: oficial.cv_cct,
    nombre_jardin: oficial.nombre_jardin,
    estado: oficial.administracion,
    campos: { zona, sector, region },
    turno: turnoComunidad
      ? {
          valor: turnoComunidad.valor_resuelto,
          origen: 'comunidad',
          veces_confirmado: turnoComunidad.veces_confirmado,
          necesita_confirmacion: turnoComunidad.veces_confirmado < CONFIRMACIONES_MINIMAS,
        }
      : {
          valor: oficial.turno,
          origen: 'oficial',
          veces_confirmado: 0,
          necesita_confirmacion: true,
        },
  })
}