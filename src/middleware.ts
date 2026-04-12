// ═══════════════════════════════════════════════════════════
// CCRO — Route Protection Middleware
// KAN-39: Protects /app/* and /admin/* routes
// ═══════════════════════════════════════════════════════════

import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()
  const { pathname } = req.nextUrl

  // ── Admin routes — separate JWT check ─────────────────
  if (pathname.startsWith('/admin')) {
    // Skip the login page itself
    if (pathname === '/admin/login') return res

    const adminToken = req.cookies.get('admin_token')?.value
    if (!adminToken || !isValidAdminToken(adminToken)) {
      const loginUrl = new URL('/admin/login', req.url)
      return NextResponse.redirect(loginUrl)
    }
    return res
  }

  // ── Protected app routes — Supabase session check ─────
  if (pathname.startsWith('/app')) {
    const supabase = createMiddlewareClient({ req, res })
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      // Preserve the destination for post-login redirect (EC-012)
      const signInUrl = new URL('/sign-in', req.url)
      signInUrl.searchParams.set('returnTo', pathname)
      return NextResponse.redirect(signInUrl)
    }

    // New user — redirect to onboarding if not completed
    if (pathname === '/app/chat' || pathname === '/app') {
      const { data: userCards } = await supabase
        .from('user_cards')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', session.user.id)

      const isNewUser = !userCards
      if (isNewUser && !req.cookies.get('onboarding_skipped')) {
        return NextResponse.redirect(new URL('/onboarding', req.url))
      }
    }

    return res
  }

  // ── Onboarding — requires auth ─────────────────────────
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

// ─────────────────────────────────────────────────────────
// Admin token verification
// Simple JWT check — admin panel has separate auth from users
// ─────────────────────────────────────────────────────────
function isValidAdminToken(token: string): boolean {
  try {
    // In production this uses jsonwebtoken to verify the JWT
    // For now, basic presence check — full JWT verify in KAN-59
    return token.length > 20
  } catch {
    return false
  }
}

export const config = {
  matcher: [
    '/app/:path*',
    '/admin/:path*',
    '/onboarding/:path*',
  ],
}
