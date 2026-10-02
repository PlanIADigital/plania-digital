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

// [2 oct 2026] Resumen del semáforo del GRUPO para MÍA (fuente "Semáforo"
// en El alma de tu planeación). Solo porcentajes por área: NUNCA códigos.
// Toma el último momento enviado a dirección; si no hay, el último capturado.
export async function resumenSemaforoGrupo(
  supabaseAdmin: SupabaseClient,
  userId: string,
  ciclo: string
): Promise<string> {
  const { data: alumnos } = await supabaseAdmin
    .from('alumnos_codigo').select('codigo')
    .eq('user_id', userId).eq('ciclo_escolar', ciclo).eq('activo', true)
  const codigos = new Set<string>((alumnos || []).map((a: any) => String(a.codigo)))
  if (codigos.size === 0) return ''

  const { data: regs } = await supabaseAdmin
    .from('semaforo_registros').select('momento, area, alumno_codigo, nivel')
    .eq('user_id', userId).eq('ciclo_escolar', ciclo)
  const validos = (regs || []).filter((r: any) => codigos.has(String(r.alumno_codigo)))
  if (validos.length === 0) return ''

  const { data: envios } = await supabaseAdmin
    .from('semaforo_envios').select('momento')
    .eq('user_id', userId).eq('ciclo_escolar', ciclo)
  const indice = (m: string) => MOMENTOS.findIndex(x => x.clave === m)
  const masReciente = (lista: string[]) => [...lista].sort((a, b) => indice(b) - indice(a))[0]
  const enviados = (envios || []).map((e: any) => String(e.momento)).filter((m: string) => indice(m) >= 0)
  const capturados = Array.from(new Set<string>(validos.map((r: any) => String(r.momento)))).filter(m => indice(m) >= 0)
  const momento = enviados.length ? masReciente(enviados) : masReciente(capturados)
  if (!momento) return ''

  const delMomento = validos.filter((r: any) => r.momento === momento)
  const areas: string[] = []
  for (const r of delMomento) if (!areas.includes(String(r.area))) areas.push(String(r.area))
  const total = codigos.size
  // Sin porcentajes: MÍA recibe proporciones en palabras para que las
  // problemáticas suenen a observación de la maestra, no a estadística.
  const cuanto = (n: number) => {
    const p = n / total
    if (p > 0.8) return 'casi todo el grupo'
    if (p > 0.6) return 'la mayoría'
    if (p >= 0.4) return 'cerca de la mitad'
    if (p > 0.2) return 'una parte del grupo'
    return 'pocos'
  }
  const partes = areas.map(area => {
    const deArea = delMomento.filter((r: any) => r.area === area)
    const s = deArea.filter((r: any) => r.nivel === 'suficiente').length
    const ed = deArea.filter((r: any) => r.nivel === 'en_desarrollo').length
    const ra = deArea.filter((r: any) => r.nivel === 'requiere_apoyo').length
    const sinEvaluar = total - s - ed - ra
    const frases = [
      s > 0 ? `${cuanto(s)} con nivel suficiente` : '',
      ed > 0 ? `${cuanto(ed)} en desarrollo` : '',
      ra > 0 ? `${cuanto(ra)} requiere apoyo` : '',
      sinEvaluar > 0 ? `${cuanto(sinEvaluar)} aún sin evaluar` : '',
    ].filter(Boolean)
    return `${area}: ${frases.join('; ')}`
  })
  const nombre = MOMENTOS.find(m => m.clave === momento)?.nombre || momento
  const estado = enviados.includes(momento) ? 'enviado a dirección' : 'en captura'
  return `Semáforo de desempeño del grupo · ${nombre} (${estado}). ${partes.join('. ')}.`
}
