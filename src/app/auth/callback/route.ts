// ─────────────────────────────────────────────────────────
// CCRO — Auth Callback Route
// Handles BOTH Supabase auth flows:
//   PKCE:       ?code=...           (exchangeCodeForSession)
//   token_hash: ?token_hash=...&type=magiclink  (verifyOtp)
// ─────────────────────────────────────────────────────────

import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const token_hash = requestUrl.searchParams.get('token_hash')
  const type = requestUrl.searchParams.get('type')
  const next = requestUrl.searchParams.get('next') ?? '/app/chat'
  const origin = requestUrl.origin

  console.log('[auth/callback] params:', Object.fromEntries(requestUrl.searchParams))

  const cookieStore = cookies()
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore })

  // PKCE flow — magic link with ?code=
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
    console.error('[auth/callback] code exchange error:', error.message)
  }

  // OTP / token_hash flow — magic link with ?token_hash=&type=
  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash,
      type: type as EmailOtpType,
    })
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
    console.error('[auth/callback] token_hash error:', error.message)
  }

  console.error('[auth/callback] no valid params — code:', code, 'token_hash:', token_hash, 'type:', type)
  return NextResponse.redirect(`${origin}/sign-in?error=Could+not+authenticate`)
}
