// ═══════════════════════════════════════════════════════════
// CREDPO — Route Protection Middleware
// KAN-39: Protects /app/* and /admin/* routes
// Uses @supabase/ssr to read chunked cookies set by auth callback.
// ═══════════════════════════════════════════════════════════

import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const PUBLIC_ROUTES = [
  '/sign-in',
  '/sign-in/verify',
  '/auth/callback',
]

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Always allow public routes through immediately — no Supabase calls
  if (PUBLIC_ROUTES.some(r => pathname.startsWith(r))) {
    return NextResponse.next()
  }

  // Allow API routes, static assets, and favicon through (they handle their own auth)
  if (
    pathname.startsWith('/api/') ||
    pathname.startsWith('/_next/') ||
    pathname === '/favicon.ico'
  ) {
    return NextResponse.next()
  }

  // Build supabase response — recreated in setAll so refreshed cookies propagate
  let supabaseResponse = NextResponse.next({ request })

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
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // getUser() validates JWT with Supabase server — more reliable than getSession()
  const { data: { user } } = await supabase.auth.getUser()

  // ── Admin routes — user + ADMIN_USER_ID check ────────────
  if (pathname.startsWith('/admin')) {
    const isAdmin =
      user != null &&
      process.env.ADMIN_USER_ID != null &&
      user.id === process.env.ADMIN_USER_ID

    if (!isAdmin) {
      return NextResponse.rewrite(new URL('/404', request.url))
    }
    return supabaseResponse
  }

  // ── Protected app routes — session check ─────────────────
  if (pathname.startsWith('/app')) {
    if (!user) {
      const signInUrl = new URL('/sign-in', request.url)
      signInUrl.searchParams.set('returnTo', pathname)
      return NextResponse.redirect(signInUrl)
    }

    // New user — redirect to onboarding if not completed
    if (pathname === '/app/chat' || pathname === '/app') {
      const { count: cardCount } = await supabase
        .from('user_cards')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)

      const isNewUser = (cardCount ?? 0) === 0
      if (isNewUser && !request.cookies.get('onboarding_skipped')) {
        return NextResponse.redirect(new URL('/onboarding', request.url))
      }
    }

    return supabaseResponse
  }

  // ── Onboarding — requires auth ────────────────────────────
  if (pathname.startsWith('/onboarding')) {
    if (!user) {
      const signInUrl = new URL('/sign-in', request.url)
      signInUrl.searchParams.set('returnTo', '/onboarding')
      return NextResponse.redirect(signInUrl)
    }
    return supabaseResponse
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/app/:path*',
    '/admin/:path*',
    '/onboarding/:path*',
    '/sign-in/:path*',
    '/auth/:path*',
  ],
}
