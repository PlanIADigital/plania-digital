// ============================================================
//  PlanIA Digital — Cliente Supabase para el NAVEGADOR (SSR-ready)
//  lib/supabase-browser.ts
//
//  Reemplaza gradualmente los createClient() inline que hoy viven
//  en login, AdminLayout y fetchAdmin. Este cliente sincroniza la
//  sesión en cookies (además de localStorage), para que el
//  servidor (middleware, route handlers) también pueda leerla.
// ============================================================
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
