'use client'

// ─────────────────────────────────────────────────────────
// CCRO — Sign In Page
// KAN-38: Email OTP auth flow
// ─────────────────────────────────────────────────────────

import { useState } from 'react'
import { createBrowserClient } from '@/lib/supabase'

export default function SignInPage() {
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return

    setLoading(true)
    setError('')

    const supabase = createBrowserClient()
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: {
        shouldCreateUser: true,
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    setLoading(false)

    if (error) {
      console.error('[sign-in] OTP error:', error.message, error.status)
      if (error.message?.includes('rate')) {
        setError('Too many requests — please wait a few minutes and try again.')
      } else if (error.status === 422) {
        setError('Invalid email address.')
      } else {
        setError(`Sign-in failed: ${error.message}`)
      }
      return
    }

    setSubmitted(true)
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center px-4">
        <div className="w-full max-w-sm text-center">
          <div className="w-14 h-14 bg-amber-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <svg className="w-7 h-7 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
            </svg>
          </div>

          <h1 className="text-2xl font-semibold text-stone-900 mb-2">Check your email</h1>
          <p className="text-stone-500 text-sm leading-relaxed mb-1">
            We sent a sign-in link to
          </p>
          <p className="text-stone-800 font-medium text-sm mb-6">{email}</p>
          <p className="text-stone-400 text-xs">
            Click the link in the email to sign in. It expires in 60 minutes.
          </p>

          <button
            onClick={() => { setSubmitted(false); setEmail('') }}
            className="mt-8 text-sm text-amber-600 hover:text-amber-700 underline underline-offset-2"
          >
            Use a different email
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">

        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 mb-6">
            <div className="w-9 h-9 bg-amber-600 rounded-xl flex items-center justify-center">
              <span className="text-white font-bold text-sm">CC</span>
            </div>
            <span className="text-stone-900 font-semibold text-lg tracking-tight">CCRO</span>
          </div>
          <h1 className="text-2xl font-semibold text-stone-900 mb-2">
            Sign in to CCRO
          </h1>
          <p className="text-stone-500 text-sm">
            Your AI-powered credit card rewards advisor
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-stone-700 mb-1.5">
              Email address
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              className="w-full px-3.5 py-2.5 bg-white border border-stone-200 rounded-xl text-stone-900 placeholder:text-stone-400 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition"
            />
          </div>

          {error && (
            <p className="text-red-600 text-sm">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || !email.trim()}
            className="w-full bg-amber-600 hover:bg-amber-700 disabled:bg-stone-200 disabled:text-stone-400 text-white font-medium py-2.5 px-4 rounded-xl text-sm transition-colors"
          >
            {loading ? 'Sending…' : 'Continue with email'}
          </button>
        </form>

        <p className="text-center text-stone-400 text-xs mt-8 leading-relaxed">
          We&apos;ll email you a magic link. No password needed.
        </p>
      </div>
    </div>
  )
}
