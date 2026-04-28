// ─────────────────────────────────────────────────────────
// CREDPO — Auth Callback Route
// Handles BOTH Supabase auth flows:
//   implicit:   ?token_hash=...&type=magiclink  (verifyOtp — cross-device safe)
//   PKCE/OAuth: ?code=...                       (exchangeCodeForSession)
// ─────────────────────────────────────────────────────────

import { createServerClient } from '@supabase/ssr'
import { type EmailOtpType } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const token_hash = requestUrl.searchParams.get('token_hash')
  const type = requestUrl.searchParams.get('type') as EmailOtpType | null
  const next = requestUrl.searchParams.get('next') ?? '/app/chat'
  const origin = requestUrl.origin

  console.log('[auth/callback] params:', Object.fromEntries(requestUrl.searchParams))

  const cookieStore = cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  )

  // Implicit flow — token_hash + type (cross-device, no localStorage needed)
  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash })
    if (!error) return NextResponse.redirect(new URL(next, origin))
    console.error('[auth/callback] token_hash verification failed:', error)
  }

  // PKCE / OAuth — code param (Google OAuth or fallback)
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) return NextResponse.redirect(new URL(next, origin))
    console.error('[auth/callback] code exchange failed:', error)
  }

  return NextResponse.redirect(new URL('/sign-in?error=Could+not+authenticate', origin))
}
