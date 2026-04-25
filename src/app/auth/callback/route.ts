// ─────────────────────────────────────────────────────────
// CCRO — Auth Callback Route
// Handles the redirect from Supabase magic link email.
// User clicks link in email → lands here → session created
// → redirected to /onboarding (new) or /app/chat (returning)
// ─────────────────────────────────────────────────────────

import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const requestUrl = new URL(req.url)
  const code = requestUrl.searchParams.get('code')
  const next = requestUrl.searchParams.get('next') ?? '/app/chat'

  if (code) {
    const supabase = createRouteHandlerClient({ cookies })
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error && data.user) {
      // Check if this is a new user (no cards registered)
      const { count } = await supabase
        .from('user_cards')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', data.user.id)

      if (count === 0) {
        return NextResponse.redirect(new URL('/onboarding', requestUrl.origin))
      }

      return NextResponse.redirect(new URL(next, requestUrl.origin))
    }
  }

  // Code exchange failed — redirect to sign-in with error
  return NextResponse.redirect(
    new URL('/sign-in?error=auth_failed', requestUrl.origin)
  )
}
