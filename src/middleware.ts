// ═══════════════════════════════════════════════════════════
// CCRO — Route Protection Middleware
// KAN-39: Protects /app/* and /admin/* routes
// ═══════════════════════════════════════════════════════════

import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const PUBLIC_ROUTES = [
  '/sign-in',
  '/sign-in/verify',
  '/auth/callback',
]

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()
  const { pathname } = req.nextUrl

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

  // ── Admin routes — Supabase session + ADMIN_USER_ID check ────
  if (pathname.startsWith('/admin')) {
    const supabase = createMiddlewareClient({ req, res })
    const { data: { session } } = await supabase.auth.getSession()

    const isAdmin =
      session != null &&
      process.env.ADMIN_USER_ID != null &&
      session.user.id === process.env.ADMIN_USER_ID

    if (!isAdmin) {
      return NextResponse.rewrite(new URL('/404', req.url))
    }
    return res
  }

  // ── Protected app routes — Supabase session check ─────────────
  if (pathname.startsWith('/app')) {
    const supabase = createMiddlewareClient({ req, res })
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      const signInUrl = new URL('/sign-in', req.url)
      signInUrl.searchParams.set('returnTo', pathname)
      return NextResponse.redirect(signInUrl)
    }

    // New user — redirect to onboarding if not completed
    if (pathname === '/app/chat' || pathname === '/app') {
      const { count: cardCount } = await supabase
        .from('user_cards')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', session.user.id)

      const isNewUser = (cardCount ?? 0) === 0
      if (isNewUser && !req.cookies.get('onboarding_skipped')) {
        return NextResponse.redirect(new URL('/onboarding', req.url))
      }
    }

    return res
  }

  // ── Onboarding — requires auth ─────────────────────────────────
  if (pathname.startsWith('/onboarding')) {
    const supabase = createMiddlewareClient({ req, res })
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      const signInUrl = new URL('/sign-in', req.url)
      signInUrl.searchParams.set('returnTo', '/onboarding')
      return NextResponse.redirect(signInUrl)
    }
    return res
  }

  return res
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
