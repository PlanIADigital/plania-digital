// ============================================================
//  PlanIA Digital — Cliente Supabase
//  lib/supabase.ts
// ============================================================
import { createClient as createBrowserSupabaseClient } from '@/lib/supabase-browser'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY!

// Cliente público — usar en componentes del lado del cliente
// Respeta RLS automáticamente. Sincroniza sesión en cookies (SSR-ready).
export const supabase = createBrowserSupabaseClient()

// Cliente admin — usar SOLO en API routes del servidor
// Bypasea RLS — nunca exponer al cliente
export const supabaseAdmin = typeof window === 'undefined' ? createClient(supabaseUrl, supabaseSecretKey) : null as any