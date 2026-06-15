// ============================================================
//  PlanIA Digital — Middleware de seguridad
//  middleware.ts
// ============================================================
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (!pathname.startsWith('/admin')) {
    return NextResponse.next()
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        cookie: request.headers.get('cookie') ?? '',
      },
    },
  })

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    const authUrl = new URL('/auth/login', request.url)
    authUrl.searchParams.set('next', pathname)
    return NextResponse.redirect(authUrl)
  }

  const supabaseAdmin = createClient(
    supabaseUrl,
    process.env.SUPABASE_SECRET_KEY!
  )

  const { data: userData } = await supabaseAdmin
    .from('users')
    .select('is_super_admin')
    .eq('auth_uid', user.id)
    .single()

  if (!userData?.is_super_admin) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/admin/:path*'],
}
