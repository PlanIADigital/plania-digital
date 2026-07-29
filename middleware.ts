import { type NextRequest, NextResponse } from 'next/server'
import { actualizarSesion } from '@/lib/supabase-middleware'

export async function middleware(request: NextRequest) {
  const { response, user } = await actualizarSesion(request)

  const esRutaAdmin = request.nextUrl.pathname.startsWith('/admin')

  if (esRutaAdmin && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/auth/login'
    url.searchParams.set('next', request.nextUrl.pathname)
    return NextResponse.redirect(url)
  }

  return response
}

export const config = {
  matcher: ['/admin/:path*'],
}