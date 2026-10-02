'use client'
// ============================================================
//  PlanIA Digital — lib/useDocentesDirectivo.ts
//  [2 oct 2026] Carga compartida del panel del directivo
//  (Dashboard y Mis docentes). Verifica sesión, perfil completo y rol
//  directivo; luego pide a /api/directivo/docentes la lista de docentes
//  de sus CCT con el resumen del ciclo activo (el servidor decide qué
//  datos salen: nunca correo, teléfono ni diagnóstico completo).
//  El directivo SOLO VE; este archivo no modifica nada.
// ============================================================
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'

const supabase = createClient()

export interface DocenteResumen {
  id: string
  full_name: string | null
  avatar_url?: string | null
  role: string
  grado: string | null
  grupo_letra: string | null
  total_alumnos: number | null
  cct_primary: string | null
  resumen: {
    pdaDistintos: number
    campos: string[]
    planeaciones: number
    planeacionesActivas: number
    ejesCubiertos: number
    prioritarios: { hayDiagnostico: boolean; total: number; atendidos: number }
    alumnosConApoyos: number
  }
}

// Orden fijo de los campos formativos y su nombre corto (el completo va en title).
export const CAMPOS_FORMATIVOS = [
  { nombre: 'Lenguajes',                        corto: 'Lenguajes' },
  { nombre: 'Saberes y Pensamiento Científico', corto: 'Saberes' },
  { nombre: 'Ética, Naturaleza y Sociedades',   corto: 'Ética' },
  { nombre: 'De lo Humano y lo Comunitario',    corto: 'Humano y Comunitario' },
]

export const ROL_DOCENTE: Record<string, string> = {
  educadora: 'Educadora',
  educador: 'Educador',
  maestra_musica: 'Maestra de música',
  maestro_musica: 'Maestro de música',
}

// "JARDIN DE NIÑOS LUZ MARIA JIMENEZ GREGG" → "JN Luz Maria Jimenez Gregg"
export function nombreJardin(nombre: string | null | undefined): string {
  if (!nombre) return ''
  const base = nombre
    .replace(/^Jard[ií]n de Ni[ñn]os Ind[ií]gena\s*/i, '')
    .replace(/^Jard[ií]n de Ni[ñn]os\s*/i, '')
    .replace(/^Centro de Educaci[oó]n Preescolar\s*/i, '')
    .trim()
    .toLowerCase()
    .replace(/(^|\s)\S/g, (c) => c.toUpperCase())
  return base ? `JN ${base}` : ''
}

export function useDocentesDirectivo() {
  const router = useRouter()
  const [profile, setProfile] = useState<any>(null)
  const [docentes, setDocentes] = useState<DocenteResumen[]>([])
  const [ciclo, setCiclo] = useState<string>('')
  const [errorCarga, setErrorCarga] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/auth/login'); return }
      const { data: user } = await supabase.from('users').select('*').eq('auth_uid', session.user.id).single()
      if (!user?.profile_completed) { router.push('/onboarding'); return }
      if (user.role !== 'directivo') { router.push('/dashboard'); return }
      setProfile(user)

      try {
        const res = await fetch('/api/directivo/docentes', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        })
        const data = await res.json()
        if (!res.ok) {
          setErrorCarga(data?.error || 'No se pudo cargar la información de tus docentes.')
        } else {
          setDocentes((data?.docentes || []) as DocenteResumen[])
          setCiclo(data?.ciclo || '')
        }
      } catch {
        setErrorCarga('No se pudo conectar con el servidor. Intenta de nuevo.')
      }
      setLoading(false)
    }
    load()
  }, [])

  return { profile, docentes, ciclo, errorCarga, loading }
}
