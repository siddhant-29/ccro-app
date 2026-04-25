'use client'

export const dynamic = 'force-dynamic'

// ─────────────────────────────────────────────────────────
// KAN-48: Portfolio page — shows user cards, empty state
// for users who skipped onboarding
// ─────────────────────────────────────────────────────────

import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { useCards } from '@/hooks/useCards'

function CardRow({ name, issuer, balance, updated }: {
  name: string
  issuer: string
  balance: number
  updated: string
}) {
  const date = new Date(updated).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })

  return (
    <div className="bg-white border border-stone-200 rounded-2xl p-4 flex items-center justify-between gap-4">
      <div>
        <p className="font-medium text-stone-900 text-sm">{name}</p>
        <p className="text-stone-400 text-xs mt-0.5">{issuer}</p>
      </div>
      <div className="text-right">
        <p className="font-semibold text-stone-900 text-sm">{balance.toLocaleString('en-IN')} pts</p>
        <p className="text-stone-400 text-xs mt-0.5">Updated {date}</p>
      </div>
    </div>
  )
}

function EmptyState() {
  const router = useRouter()

  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-16 h-16 bg-amber-100 rounded-2xl flex items-center justify-center mb-6">
        <svg className="w-8 h-8 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
        </svg>
      </div>
      <h2 className="text-lg font-semibold text-stone-900 mb-2">No cards yet</h2>
      <p className="text-stone-500 text-sm max-w-xs mb-8">
        Add your premium credit cards to get personalised rewards advice.
      </p>
      <button
        onClick={() => router.push('/onboarding')}
        className="bg-amber-600 hover:bg-amber-700 text-white font-medium py-2.5 px-6 rounded-xl text-sm transition-colors"
      >
        Add your cards
      </button>
    </div>
  )
}

export default function PortfolioPage() {
  const { user, loading: authLoading } = useAuth()
  const { data: cards, isLoading: cardsLoading } = useCards(user?.id)
  const router = useRouter()

  const loading = authLoading || cardsLoading

  if (!authLoading && !user) {
    router.replace('/sign-in')
    return null
  }

  return (
    <div className="min-h-screen bg-stone-50 px-4 py-12">
      <div className="max-w-lg mx-auto">

        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold text-stone-900">Your cards</h1>
            <p className="text-stone-500 text-sm mt-0.5">
              {cards && cards.length > 0
                ? `${cards.length} card${cards.length === 1 ? '' : 's'} registered`
                : 'Manage your portfolio'}
            </p>
          </div>
          {cards && cards.length > 0 && (
            <button
              onClick={() => router.push('/onboarding')}
              className="text-sm text-amber-600 hover:text-amber-700 font-medium"
            >
              + Add card
            </button>
          )}
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-white border border-stone-200 rounded-2xl p-4 animate-pulse">
                <div className="h-4 bg-stone-100 rounded w-1/2 mb-2" />
                <div className="h-3 bg-stone-100 rounded w-1/3" />
              </div>
            ))}
          </div>
        ) : !cards || cards.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="space-y-3">
            {cards.map(card => (
              <CardRow
                key={card.id}
                name={card.card_rewards?.card_name ?? card.card_id}
                issuer={card.card_rewards?.issuer ?? '—'}
                balance={card.current_points_balance}
                updated={card.balance_last_updated}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
