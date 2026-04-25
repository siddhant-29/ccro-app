'use client'

import { Suspense, useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createBrowserClient } from '@/lib/supabase'

function VerifyForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const email = searchParams.get('email') ?? ''

  const [otp, setOtp] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Redirect back to sign-in if no email in URL
  useEffect(() => {
    if (!email) router.replace('/sign-in')
  }, [email, router])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (otp.length !== 6) return

    setLoading(true)
    setError(null)

    const supabase = createBrowserClient()
    const { error } = await supabase.auth.verifyOtp({
      email,
      token: otp,
      type: 'email',
    })

    setLoading(false)

    if (error) {
      if (error.message.toLowerCase().includes('expired')) {
        setError('This code has expired. Go back and request a new one.')
      } else if (error.message.toLowerCase().includes('invalid')) {
        setError('Incorrect code. Double-check and try again.')
      } else {
        setError(error.message)
      }
      return
    }

    router.replace('/app/chat')
  }

  function handleOtpChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value.replace(/\D/g, '').slice(0, 6)
    setOtp(val)
    // Auto-submit when all 6 digits entered
    if (val.length === 6) {
      setTimeout(() => {
        e.target.form?.requestSubmit()
      }, 50)
    }
  }

  return (
    <div className="max-w-sm w-full">
      <div className="mb-8 text-center">
        <h1 className="text-xl font-semibold text-gray-900 mb-1">Enter your code</h1>
        <p className="text-sm text-gray-500">
          Sent to <span className="font-medium text-gray-700">{email}</span>
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="otp" className="block text-sm font-medium text-gray-700 mb-1">
            6-digit code
          </label>
          <input
            id="otp"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            value={otp}
            onChange={handleOtpChange}
            placeholder="000000"
            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-center tracking-[0.5em] font-mono focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
          />
        </div>

        {error && (
          <p className="text-sm text-red-600">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading || otp.length !== 6}
          className="w-full py-2.5 px-4 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Verifying…' : 'Verify'}
        </button>
      </form>

      <div className="mt-4 text-center">
        <a href="/sign-in" className="text-sm text-gray-400 hover:text-gray-600">
          ← Back to sign in
        </a>
      </div>
    </div>
  )
}

export default function VerifyPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <Suspense fallback={<p className="text-sm text-gray-400">Loading…</p>}>
        <VerifyForm />
      </Suspense>
    </div>
  )
}
