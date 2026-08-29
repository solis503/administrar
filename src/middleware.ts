import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: { headers: request.headers },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request: { headers: request.headers } })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Si Supabase se está "despertando" y tarda mucho, no dejamos que Vercel mate
  // la petición entera a los 25s con una pantalla de error fea. Le damos 8 segundos
  // nada más, y si no contesta a tiempo, dejamos pasar de todos modos: la pantalla
  // que sigue (el layout de la app) ya se encarga de mandar a /login si hace falta.
  const timeout = new Promise((resolve) => setTimeout(() => resolve(null), 8000))
  await Promise.race([supabase.auth.getUser(), timeout])

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
