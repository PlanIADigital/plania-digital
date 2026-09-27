// ============================================================
//  PlanIA Digital — Guardia de seguridad para rutas /api/directivo
//  lib/verificarDirectivo.ts
//
//  [Saneado 26 sep 2026 — Fase 1, infraestructura del directivo]
//  Mismo patrón que lib/verificarSuperAdmin.ts (token Bearer validado
//  con la llave de servicio). Motivo: la tabla users solo permite leer
//  el propio registro (RLS), así que el directivo NO puede leer a sus
//  docentes desde el navegador. En lugar de abrir users con una regla
//  RLS (expondría la fila completa: correo, teléfono, diagnóstico, y
//  provoca recursión), el acceso pasa por el servidor, que devuelve
//  solo los campos necesarios.
//
//  Dos niveles de acceso (criterio del fundador, 26 sep 2026):
//    'panel'    → estadísticas en vivo y generar informes nuevos.
//                 Requiere membresía activa, de prueba o fundador.
//    'informes' → consultar/descargar informes YA generados.
//                 Basta con ser directivo, sin importar su membresía
//                 (mismo espíritu que la educadora: lectura permanente
//                 de lo que ya produjo, aunque se dé de baja).
//  La membresía de la EDUCADORA nunca limita que su directivo la vea
//  (incluye fundadoras).
//
//  Uso:
//    const auth = await verificarDirectivo(request, 'panel')
//    if (!auth.autorizado) {
//      return NextResponse.json({ error: auth.error }, { status: auth.status })
//    }
//    // auth.supabaseAdmin, auth.directivo
// ============================================================

import { createClient, SupabaseClient } from '@supabase/supabase-js'

export type NivelAccesoDirectivo = 'panel' | 'informes'

// Membresías del DIRECTIVO que dan acceso al nivel 'panel'.
export const MEMBRESIAS_DIRECTIVO_CON_PANEL = ['active', 'trial', 'founder']

export type DirectivoVerificado = {
  id: string
  membership_status: string | null
  cct_primary: string | null
  cct_secondary: string | null
}

type ResultadoAuth =
  | { autorizado: true; supabaseAdmin: SupabaseClient; directivo: DirectivoVerificado }
  | { autorizado: false; status: number; error: string }

export async function verificarDirectivo(
  request: Request,
  nivel: NivelAccesoDirectivo
): Promise<ResultadoAuth> {
  const authHeader = request.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return { autorizado: false, status: 401, error: 'Sin token de autorización' }
  }
  const token = authHeader.replace('Bearer ', '')

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  )

  const { data: { user }, error: errorToken } = await supabaseAdmin.auth.getUser(token)
  if (errorToken || !user) {
    return { autorizado: false, status: 401, error: 'Token inválido o expirado' }
  }

  const { data: perfil, error: errorPerfil } = await supabaseAdmin
    .from('users')
    .select('id, role, membership_status, cct_primary, cct_secondary')
    .eq('auth_uid', user.id)
    .single()

  if (errorPerfil || !perfil || perfil.role !== 'directivo') {
    return { autorizado: false, status: 403, error: 'Solo disponible para directivos' }
  }
  if (nivel === 'panel' && !MEMBRESIAS_DIRECTIVO_CON_PANEL.includes(String(perfil.membership_status))) {
    return { autorizado: false, status: 403, error: 'Tu membresía de directivo no está activa. Puedes consultar y descargar tus informes anteriores.' }
  }

  return {
    autorizado: true,
    supabaseAdmin,
    directivo: {
      id: perfil.id,
      membership_status: perfil.membership_status ?? null,
      cct_primary: perfil.cct_primary,
      cct_secondary: perfil.cct_secondary,
    },
  }
}

// ¿La docente pertenece a alguno de los CCT del directivo?
// (principal o secundario, en ambos sentidos — misma regla que la
// política RLS "plannings: directivo ve las de su CCT").
export function compartenCct(
  directivo: { cct_primary: string | null; cct_secondary: string | null },
  docente: { cct_primary?: string | null; cct_secondary?: string | null }
): boolean {
  const cctsDirectivo = [directivo.cct_primary, directivo.cct_secondary].filter((c): c is string => !!c)
  const cctsDocente = [docente.cct_primary, docente.cct_secondary].filter((c): c is string => !!c)
  return cctsDocente.some(c => cctsDirectivo.includes(c))
}
