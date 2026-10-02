// ============================================================
//  PlanIA Digital — lib/semaforoServidor.ts
//  [2 oct 2026] Áreas del semáforo de un jardín para un momento
//  (lado servidor, con la llave de servicio). Regla única para
//  educadora y directivo:
//    1) Áreas guardadas para ese momento, o
//    2) las del momento ANTERIOR más cercano del mismo ciclo, o
//    3) las 4 predeterminadas.
// ============================================================
import type { SupabaseClient } from '@supabase/supabase-js'
import { AREAS_PREDETERMINADAS, MOMENTOS, type Momento } from '@/lib/semaforo'

export async function areasDelMomento(
  supabaseAdmin: SupabaseClient,
  cct: string | null | undefined,
  ciclo: string,
  momento: Momento
): Promise<string[]> {
  if (!cct) return AREAS_PREDETERMINADAS
  const { data } = await supabaseAdmin
    .from('semaforo_areas_jardin')
    .select('momento, areas')
    .eq('cct', cct)
    .eq('ciclo_escolar', ciclo)
  const indice = (m: string) => MOMENTOS.findIndex(x => x.clave === m)
  const limite = indice(momento)
  const candidatas = (data || [])
    .filter((r: any) => indice(r.momento) <= limite && Array.isArray(r.areas) && r.areas.length > 0)
    .sort((a: any, b: any) => indice(b.momento) - indice(a.momento))
  return candidatas.length > 0 ? candidatas[0].areas : AREAS_PREDETERMINADAS
}
