'use client'

// KAN-126: Profile and settings screen

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { createBrowserClient } from '@/lib/supabase'
import { BottomNav } from '@/components/BottomNav'

const PREFERENCES = [
  { value: 'travel_hotels', label: 'Hotel stays & points transfers', emoji: '🏨' },
  { value: 'flights',       label: 'Flights & airline miles',        emoji: '✈️' },
  { value: 'cash_value',    label: 'Maximum cash value',             emoji: '💰' },
  { value: 'not_sure',      label: 'Not sure yet',                   emoji: '🤔' },
] as const

type Preference = typeof PREFERENCES[number]['value']

function initials(name?: string | null, email?: string | null): string {
  if (name) {
    const parts = name.trim().split(/\s+/)
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
    return parts[0].slice(0, 2).toUpperCase()
  }
  return email?.slice(0, 2).toUpperCase() ?? '??'
}

export default function ProfilePage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()

  const displayNameRef = useRef<HTMLInputElement>(null)

  const [displayName, setDisplayName] = useState('')
  const [preference, setPreference] = useState<Preference | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [prefSaving, setPrefSaving] = useState(false)

  // Load fresh name from server on mount (avoids stale cache)
  useEffect(() => {
    const supabase = createBrowserClient()
    supabase.auth.getUser().then(({ data: { user: freshUser } }) => {
      if (!freshUser) return
      setDisplayName(freshUser.user_metadata?.display_name ?? freshUser.email?.split('@')[0] ?? '')
      setPreference(freshUser.user_metadata?.preference ?? null)
    })
  }, [])

  async function handleSaveName(newName: string) {
    if (!user || !newName.trim()) return
    setSaving(true)
    const supabase = createBrowserClient()
    await supabase.auth.updateUser({ data: { display_name: newName.trim() } })
    await supabase.auth.refreshSession()
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function savePreference(value: Preference) {
    if (!user || value === preference) return
    setPreference(value)
    setPrefSaving(true)
    const supabase = createBrowserClient()
    await supabase.auth.updateUser({ data: { preference: value } })
    setPrefSaving(false)
  }

  async function signOut() {
    const supabase = createBrowserClient()
    await supabase.auth.signOut()
    router.replace('/sign-in')
  }

  if (authLoading || !user) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <div className="text-stone-400 text-sm">Loading…</div>
      </div>
    )
  }

  const name = user.user_metadata?.display_name as string | undefined
  const email = user.email

  return (
    <div className="flex flex-col bg-stone-50" style={{ minHeight: '100svh' }}>

      {/* Header */}
      <header className="bg-white border-b border-stone-200 px-4 py-3 sticky top-0 z-10">
        <h1 className="font-semibold text-stone-900 text-base">Profile</h1>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-5">

        {/* Avatar + name */}
        <div className="bg-white border border-stone-200 rounded-2xl p-5">
          <div className="flex items-center gap-4 mb-5">
            <div className="w-14 h-14 rounded-full bg-amber-600 flex items-center justify-center flex-shrink-0">
              <span className="text-white text-lg font-semibold">
                {initials(name, email)}
              </span>
            </div>
            <div>
              <p className="font-medium text-stone-900 text-sm">{name || 'Add your name'}</p>
              <p className="text-stone-400 text-xs mt-0.5">{email}</p>
            </div>
          </div>

          {/* Display name */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-stone-500 uppercase tracking-wide">
              Display name
            </label>
            <div className="flex gap-2">
              <input
                ref={displayNameRef}
                type="text"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                onBlur={e => handleSaveName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') displayNameRef.current?.blur() }}
                placeholder="Your name"
                className="flex-1 px-3 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
              />
              {saving && (
                <div className="flex items-center text-xs text-stone-400 px-2">Saving…</div>
              )}
              {saved && !saving && (
                <div className="flex items-center gap-1 text-xs text-green-600 px-2">
                  <svg className="w-3.5 h-3.5" viewBox="0 0 12 12" fill="none">
                    <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Saved
                </div>
              )}
            </div>
          </div>

          {/* Email (read-only) */}
          <div className="space-y-1 mt-3">
            <label className="text-xs font-medium text-stone-500 uppercase tracking-wide">
              Email
            </label>
            <p className="px-3 py-2.5 bg-stone-50 border border-stone-100 rounded-xl text-sm text-stone-500">
              {email}
            </p>
          </div>
        </div>

        {/* Preference */}
        <div className="bg-white border border-stone-200 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-medium text-stone-900 text-sm">What do you optimise for?</h2>
            {prefSaving && <span className="text-xs text-stone-400">Saving…</span>}
          </div>
          <div className="space-y-2">
            {PREFERENCES.map(pref => (
              <button
                key={pref.value}
                onClick={() => savePreference(pref.value)}
                className={`w-full flex items-center gap-3 p-3.5 rounded-xl border-2 text-left transition-all ${
                  preference === pref.value
                    ? 'border-amber-500 bg-amber-50'
                    : 'border-stone-100 hover:border-stone-200'
                }`}
              >
                <span className="text-xl leading-none">{pref.emoji}</span>
                <span className={`text-sm font-medium ${
                  preference === pref.value ? 'text-amber-800' : 'text-stone-700'
                }`}>
                  {pref.label}
                </span>
                {preference === pref.value && (
                  <div className="ml-auto w-4 h-4 rounded-full bg-amber-500 flex items-center justify-center flex-shrink-0">
                    <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 12 12" fill="none">
                      <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Sign out */}
        <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden">
          <button
            onClick={signOut}
            className="w-full flex items-center gap-3 px-5 py-4 text-red-600 hover:bg-red-50 transition-colors"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 flex-shrink-0">
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" />
            </svg>
            <span className="text-sm font-medium">Sign out</span>
          </button>
        </div>

        <div className="pb-2" />
      </div>

      <BottomNav />
    </div>
  )
}
