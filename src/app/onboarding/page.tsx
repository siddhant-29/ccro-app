'use client'

// ─────────────────────────────────────────────────────────
// KAN-43/44/45/46/47: EP5 Onboarding — 3-step flow
//   Step 1: Card selection
//   Step 2: Points entry
//   Step 3: Rewards preference
//   → upsert to user_cards + redirect to /app/chat
// ─────────────────────────────────────────────────────────

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@/lib/supabase'

// ── Card catalogue ─────────────────────────────────────
const CARDS = [
  { id: 'axis_magnus',          name: 'Axis Magnus',              issuer: 'Axis Bank',          annual_fee: '₹10,000' },
  { id: 'hdfc_infinia',         name: 'HDFC Infinia',             issuer: 'HDFC Bank',          annual_fee: '₹12,500' },
  { id: 'hdfc_diners_black',    name: 'HDFC Diners Club Black',   issuer: 'HDFC Bank',          annual_fee: '₹10,000' },
  { id: 'amex_platinum_travel', name: 'Amex Platinum Travel',     issuer: 'American Express',   annual_fee: '₹5,000'  },
  { id: 'icici_emeralde',       name: 'ICICI Emeralde',           issuer: 'ICICI Bank',         annual_fee: '₹12,000' },
  { id: 'axis_reserve',         name: 'Axis Reserve',             issuer: 'Axis Bank',          annual_fee: '₹50,000' },
  { id: 'amex_gold',            name: 'Amex Gold',                issuer: 'American Express',   annual_fee: '₹1,000'  },
  { id: 'sbi_elite',            name: 'SBI Card Elite',           issuer: 'SBI Card',           annual_fee: '₹4,999'  },
] as const

// ── Preference options ─────────────────────────────────
const PREFERENCES = [
  { value: 'travel_hotels', label: 'Hotel stays & points transfers', emoji: '🏨' },
  { value: 'flights',       label: 'Flights & airline miles',        emoji: '✈️' },
  { value: 'cash_value',    label: 'Maximum cash value',             emoji: '💰' },
  { value: 'not_sure',      label: 'Not sure yet',                   emoji: '🤔' },
] as const

type Preference = 'travel_hotels' | 'flights' | 'cash_value' | 'not_sure'

// ── Step indicator ─────────────────────────────────────
function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-2 mb-8">
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className={`h-1.5 rounded-full transition-all ${
            i < current ? 'bg-amber-600 flex-1' :
            i === current ? 'bg-amber-600 flex-[2]' :
            'bg-stone-200 flex-1'
          }`}
        />
      ))}
    </div>
  )
}

export default function OnboardingPage() {
  const router = useRouter()

  const [step, setStep] = useState(0)
  const [selectedCards, setSelectedCards] = useState<Set<string>>(new Set())
  const [balances, setBalances] = useState<Record<string, string>>({})
  const [preference, setPreference] = useState<Preference | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // ── Step 0: Card selection ─────────────────────────

  function toggleCard(id: string) {
    setSelectedCards(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
        // Clear balance when deselected
        setBalances(b => { const nb = { ...b }; delete nb[id]; return nb })
      } else {
        next.add(id)
      }
      return next
    })
  }

  // ── Step 2: Save to Supabase ───────────────────────

  async function handleFinish() {
    setSaving(true)
    setError(null)

    const supabase = createBrowserClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      router.replace('/sign-in')
      return
    }

    const rows = Array.from(selectedCards).map(cardId => ({
      user_id: user.id,
      card_id: cardId,
      current_points_balance: parseInt(balances[cardId] || '0', 10),
    }))

    if (rows.length > 0) {
      const { error: upsertError } = await supabase
        .from('user_cards')
        .upsert(rows, { onConflict: 'user_id,card_id' })

      if (upsertError) {
        setError('Failed to save your cards. Please try again.')
        setSaving(false)
        return
      }
    }

    // Stamp country and preference onto user metadata
    await supabase.auth.updateUser({
      data: { country_code: 'IN', preference },
    })

    // Mark onboarding done so middleware won't redirect back
    document.cookie = 'onboarding_skipped=1; path=/; max-age=31536000'

    router.replace('/app/chat')
  }

  // ── Step 0: Choose cards ───────────────────────────

  if (step === 0) {
    return (
      <div className="min-h-screen bg-stone-50 px-4 py-12">
        <div className="max-w-lg mx-auto">
          <StepIndicator current={0} total={3} />

          <h1 className="text-2xl font-semibold text-stone-900 mb-1">Which cards do you hold?</h1>
          <p className="text-stone-500 text-sm mb-8">Select all that apply. You can add more later.</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
            {CARDS.map(card => {
              const selected = selectedCards.has(card.id)
              return (
                <button
                  key={card.id}
                  onClick={() => toggleCard(card.id)}
                  className={`text-left p-4 rounded-2xl border-2 transition-all ${
                    selected
                      ? 'border-amber-500 bg-amber-50'
                      : 'border-stone-200 bg-white hover:border-stone-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-stone-900 text-sm">{card.name}</p>
                      <p className="text-stone-400 text-xs mt-0.5">{card.issuer} · {card.annual_fee}/yr</p>
                    </div>
                    <div className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center mt-0.5 transition-colors ${
                      selected ? 'border-amber-500 bg-amber-500' : 'border-stone-300'
                    }`}>
                      {selected && (
                        <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none">
                          <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>

          <button
            onClick={() => setStep(1)}
            disabled={selectedCards.size === 0}
            className="w-full bg-amber-600 hover:bg-amber-700 disabled:bg-stone-200 disabled:text-stone-400 text-white font-medium py-3 px-4 rounded-xl text-sm transition-colors"
          >
            Continue ({selectedCards.size} selected)
          </button>

          <button
            onClick={() => {
              document.cookie = 'onboarding_skipped=1; path=/; max-age=31536000'
              router.replace('/app/chat')
            }}
            className="w-full text-center mt-3 text-sm text-stone-400 hover:text-stone-600"
          >
            Skip for now
          </button>
        </div>
      </div>
    )
  }

  // ── Step 1: Points entry ───────────────────────────

  if (step === 1) {
    const cards = CARDS.filter(c => selectedCards.has(c.id))
    const allFilled = cards.every(c => balances[c.id] !== undefined)

    return (
      <div className="min-h-screen bg-stone-50 px-4 py-12">
        <div className="max-w-lg mx-auto">
          <StepIndicator current={1} total={3} />

          <h1 className="text-2xl font-semibold text-stone-900 mb-1">What are your current balances?</h1>
          <p className="text-stone-500 text-sm mb-8">Enter your current points for each card. You can update these anytime.</p>

          <div className="space-y-4 mb-8">
            {cards.map(card => (
              <div key={card.id} className="bg-white border border-stone-200 rounded-2xl p-4">
                <label className="block">
                  <span className="text-sm font-medium text-stone-900">{card.name}</span>
                  <span className="text-xs text-stone-400 ml-2">{card.issuer}</span>
                  <div className="mt-2 relative">
                    <input
                      type="number"
                      min="0"
                      placeholder="0"
                      value={balances[card.id] ?? ''}
                      onChange={e => setBalances(b => ({ ...b, [card.id]: e.target.value }))}
                      className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 placeholder:text-stone-400 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                    />
                    <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-stone-400">pts</span>
                  </div>
                </label>
              </div>
            ))}
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setStep(0)}
              className="flex-1 bg-white border border-stone-200 text-stone-700 font-medium py-3 px-4 rounded-xl text-sm hover:bg-stone-50 transition-colors"
            >
              Back
            </button>
            <button
              onClick={() => setStep(2)}
              disabled={!allFilled}
              className="flex-[2] bg-amber-600 hover:bg-amber-700 disabled:bg-stone-200 disabled:text-stone-400 text-white font-medium py-3 px-4 rounded-xl text-sm transition-colors"
            >
              Continue
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Step 2: Preference ─────────────────────────────

  return (
    <div className="min-h-screen bg-stone-50 px-4 py-12">
      <div className="max-w-lg mx-auto">
        <StepIndicator current={2} total={3} />

        <h1 className="text-2xl font-semibold text-stone-900 mb-1">What do you optimise for?</h1>
        <p className="text-stone-500 text-sm mb-8">This helps the advisor tailor its recommendations for you.</p>

        <div className="space-y-3 mb-8">
          {PREFERENCES.map(pref => (
            <button
              key={pref.value}
              onClick={() => setPreference(pref.value)}
              className={`w-full text-left p-4 rounded-2xl border-2 transition-all flex items-center gap-4 ${
                preference === pref.value
                  ? 'border-amber-500 bg-amber-50'
                  : 'border-stone-200 bg-white hover:border-stone-300'
              }`}
            >
              <span className="text-2xl">{pref.emoji}</span>
              <span className="text-sm font-medium text-stone-900">{pref.label}</span>
              {preference === pref.value && (
                <div className="ml-auto w-5 h-5 rounded-full bg-amber-500 flex items-center justify-center flex-shrink-0">
                  <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none">
                    <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
              )}
            </button>
          ))}
        </div>

        {error && <p className="text-red-600 text-sm mb-4">{error}</p>}

        <div className="flex gap-3">
          <button
            onClick={() => setStep(1)}
            className="flex-1 bg-white border border-stone-200 text-stone-700 font-medium py-3 px-4 rounded-xl text-sm hover:bg-stone-50 transition-colors"
          >
            Back
          </button>
          <button
            onClick={handleFinish}
            disabled={!preference || saving}
            className="flex-[2] bg-amber-600 hover:bg-amber-700 disabled:bg-stone-200 disabled:text-stone-400 text-white font-medium py-3 px-4 rounded-xl text-sm transition-colors"
          >
            {saving ? 'Saving…' : 'Finish setup'}
          </button>
        </div>
      </div>
    </div>
  )
}
