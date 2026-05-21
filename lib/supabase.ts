// ============================================================
//  PlanIA Digital — Cliente Supabase
//  lib/supabase.ts
// ============================================================

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY!

// Cliente público — usar en componentes del lado del cliente
// Respeta RLS automáticamente
export const supabase = createClient(supabaseUrl, supabasePublishableKey)

// Cliente admin — usar SOLO en API routes del servidor
// Bypasea RLS — nunca exponer al cliente
export const supabaseAdmin = createClient(supabaseUrl, supabaseSecretKey)