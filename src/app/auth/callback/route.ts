// ─────────────────────────────────────────────────────────
// CREDPO — Auth Callback Route
// Handles BOTH Supabase auth flows:
//   PKCE:       ?code=...                      (exchangeCodeForSession)
//   token_hash: ?token_hash=...&type=magiclink  (verifyOtp — cross-device safe)
// ─────────────────────────────────────────────────────────

import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type')
  const next = searchParams.get('next') ?? '/app/chat'

  console.log('[auth/callback] params:', Object.fromEntries(searchParams))

  // Build redirect response early so we can attach cookies to it
  const successResponse = NextResponse.redirect(`${origin}${next}`)

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            successResponse.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  // PKCE flow — magic link with ?code=
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) return successResponse
    console.error('[auth/callback] code exchange error:', error.message)
  }

  // token_hash flow — works cross-device, no code_verifier cookie needed
  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash,
      type: type as EmailOtpType,
    })
    if (!error) return successResponse
    console.error('[auth/callback] token_hash error:', error.message)
  }

  console.error('[auth/callback] no valid params — code:', code, 'token_hash:', token_hash, 'type:', type)
  return NextResponse.redirect(`${origin}/sign-in?error=Could+not+authenticate`)
}
