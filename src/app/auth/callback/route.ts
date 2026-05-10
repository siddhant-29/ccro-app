import { createServerClient } from '@supabase/ssr'
import { type EmailOtpType } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const token_hash = requestUrl.searchParams.get('token_hash')
  const type = requestUrl.searchParams.get('type') as EmailOtpType | null
  const code = requestUrl.searchParams.get('code')
  const next = requestUrl.searchParams.get('next') ?? '/app/chat'
  const origin = requestUrl.origin

  // Build both responses up front — cookies are set on redirectSuccess
  const redirectSuccess = NextResponse.redirect(new URL(next, origin))
  const redirectError = NextResponse.redirect(
    new URL('/sign-in?error=Could+not+authenticate', origin)
  )

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
            request.cookies.set(name, value)
            redirectSuccess.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  // Implicit flow — token_hash + type (cross-device, no code_verifier needed)
  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash })
    if (!error) return redirectSuccess
    console.error('[auth/callback] token_hash failed:', error.message)
    return redirectError
  }

  // PKCE / OAuth — code param (Google OAuth or similar)
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) return redirectSuccess
    console.error('[auth/callback] code exchange failed:', error.message)
    return redirectError
  }

  return redirectError
}
