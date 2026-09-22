import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

const ENTIDADES: Record<string, string> = {
  '01': 'Aguascalientes', '02': 'Baja California', '03': 'Baja California Sur',
  '04': 'Campeche', '05': 'Coahuila', '06': 'Colima', '07': 'Chiapas',
  '08': 'Chihuahua', '09': 'Ciudad de México', '10': 'Durango',
  '11': 'Guanajuato', '12': 'Guerrero', '13': 'Hidalgo', '14': 'Jalisco',
  '15': 'Estado de México', '16': 'Michoacán', '17': 'Morelos', '18': 'Nayarit',
  '19': 'Nuevo León', '20': 'Oaxaca', '21': 'Puebla', '22': 'Querétaro',
  '23': 'Quintana Roo', '24': 'San Luis Potosí', '25': 'Sinaloa', '26': 'Sonora',
  '27': 'Tabasco', '28': 'Tamaulipas', '29': 'Tlaxcala', '30': 'Veracruz',
  '31': 'Yucatán', '32': 'Zacatecas'
}

const TIPOS_CENTRO: Record<string, string> = {
  'JN': 'Jardín de Niños',
  'CC': 'Jardín de Niños Indígena',
  'PR': 'Primaria',
  'PB': 'Primaria Indígena',
  'ES': 'Secundaria',
  'TV': 'Telesecundaria',
}

const TIPOS_PREESCOLAR = ['JN', 'CC']

function parsearCCT(cct: string) {
  const clean = cct.trim().toUpperCase()

  if (clean.length !== 10) {
    return { valido: false, error: 'La CCT debe tener exactamente 10 caracteres.' }
  }

  const codigoEntidad = clean.substring(0, 2)
  const sostenimiento = clean.substring(2, 3)
  const tipoCentro = clean.substring(3, 5)

  const estado = ENTIDADES[codigoEntidad]
  if (!estado) {
    return { valido: false, error: 'Código de entidad federativa no reconocido.' }
  }

  const sostenimientoNombre = sostenimiento === 'D' ? 'Federal' :
    sostenimiento === 'E' ? 'Estatal' :
    sostenimiento === 'K' ? 'CONAFE' :
    sostenimiento === 'P' ? 'Particular' : 'Otro'

  const tipoNombre = TIPOS_CENTRO[tipoCentro] || null
  const esPreescolar = TIPOS_PREESCOLAR.includes(tipoCentro)

  return {
    valido: true,
    cct: clean,
    estado,
    sostenimiento: sostenimientoNombre,
    tipo_centro: tipoNombre,
    es_preescolar: esPreescolar
  }
}

export async function POST(req: NextRequest) {
  try {
    const { cct } = await req.json()

    if (!cct) {
      return NextResponse.json({ error: 'CCT requerida.' }, { status: 400 })
    }

    const parsed = parsearCCT(cct)
    if (!parsed.valido) {
      return NextResponse.json({ error: parsed.error }, { status: 400 })
    }

    // sep 2026: antes consultaba schools_catalog (importación manual,
    // se quedó con 1 sola fila). Ahora consulta cct_catalogo_oficial,
    // el catálogo real (80,735 filas) — de paso trae zona/sector/región
    // numéricos, que no existían en ningún lado antes de este cambio.
    const { data: escuela, error: dbError } = await supabaseAdmin
      .from('cct_catalogo_oficial')
      .select('nombre_jardin, turno, zona_numero, sector_numero, region_numero')
      .eq('cv_cct', parsed.cct)
      .single()

    if (dbError || !escuela) {
      return NextResponse.json({
        ...parsed,
        nombre: null,
        zona: null,
        sector: null,
        region: null,
        encontrado_en_catalogo: false,
        mensaje: 'Centro de trabajo no encontrado en el catálogo. Por favor confirma el nombre de tu jardín.'
      })
    }

    return NextResponse.json({
      ...parsed,
      nombre: escuela.nombre_jardin,
      turno: escuela.turno || null,
      zona: escuela.zona_numero,
      sector: escuela.sector_numero,
      region: escuela.region_numero,
      encontrado_en_catalogo: true
    })

  } catch (error) {
    console.error('Error decodificar-cct:', error)
    return NextResponse.json({ error: 'Error interno del servidor.' }, { status: 500 })
  }
}