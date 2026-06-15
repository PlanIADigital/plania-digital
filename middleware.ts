// ============================================================
//  PlanIA Digital — Middleware de seguridad
//  middleware.ts
// ============================================================
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Solo proteger rutas /admin
  if (!pathname.startsWith('/admin')) {
    return NextResponse.next()
  }

  // Verificar que existe una cookie de sesión de Supabase
  const cookies = request.headers.get('cookie') ?? ''
  const hasSession = cookies.includes('sb-') && cookies.includes('-auth-token')

  if (!hasSession) {
    const authUrl = new URL('/auth/login', request.url)
    authUrl.searchParams.set('next', pathname)
    return NextResponse.redirect(authUrl)
  }

  // La verificación de is_super_admin la hace el layout server-side
  return NextResponse.next()
}

export const config = {
  matcher: ['/admin/:path*'],
}
