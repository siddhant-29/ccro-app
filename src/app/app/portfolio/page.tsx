'use client'

export const dynamic = 'force-dynamic'

// KAN-125: Card portfolio management screen

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useRequireAuth } from '@/hooks/useAuth'
import { useCards, useUpdateCardBalance, useRemoveCard } from '@/hooks/useCards'
import { BottomNav } from '@/components/BottomNav'
import type { UserCard } from '@/types'

function issuerColor(issuer = ''): string {
  const s = issuer.toLowerCase()
  if (s.includes('axis'))  return 'bg-purple-500'
  if (s.includes('hdfc'))  return 'bg-blue-600'
  if (s.includes('amex') || s.includes('american')) return 'bg-emerald-600'
  if (s.includes('icici')) return 'bg-orange-500'
  if (s.includes('sbi'))   return 'bg-red-600'
  return 'bg-stone-500'
}

function cardInitials(name = ''): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

function staleness(dateStr: string) {
  const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86_400_000)
  if (days <= 2) return {
    label: days === 0 ? 'Today' : `${days}d ago`,
    cls: 'text-emerald-700 bg-emerald-50',
  }
  if (days <= 7) return { label: `${days}d ago`, cls: 'text-amber-700 bg-amber-50' }
  return { label: `${days}d ago`, cls: 'text-red-700 bg-red-50' }
}

interface CardRowProps {
  card: UserCard
  userId: string
  editMode: boolean
  onDelete: (cardId: string) => void
}

function CardRow({ card, userId, editMode, onDelete }: CardRowProps) {
  const name = card.card_rewards?.card_name ?? card.card_id
  const issuer = card.card_rewards?.issuer ?? ''
  const stale = staleness(card.balance_last_updated)

  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(String(card.current_points_balance))
  const { mutate: updateBalance } = useUpdateCardBalance()

  function commitBalance() {
    const n = parseInt(value, 10)
    if (Number.isFinite(n) && n >= 0 && n !== card.current_points_balance) {
      updateBalance({ cardId: card.card_id, userId, balance: n })
    }
    setEditing(false)
  }

  return (
    <div className="bg-white border border-stone-200 rounded-2xl p-4 flex items-center gap-3">
      {/* Avatar */}
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${issuerColor(issuer)}`}>
        <span className="text-white text-xs font-bold">{cardInitials(name)}</span>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="font-medium text-stone-900 text-sm truncate">{name}</p>
        <p className="text-stone-400 text-xs mt-0.5">{issuer}</p>
      </div>

      {/* Balance + staleness */}
      <div className="text-right flex-shrink-0">
        {editing ? (
          <input
            autoFocus
            type="number"
            min="0"
            value={value}
            onChange={e => setValue(e.target.value)}
            onBlur={commitBalance}
            onKeyDown={e => { if (e.key === 'Enter') commitBalance() }}
            className="w-28 text-right text-sm font-semibold bg-amber-50 border border-amber-400 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        ) : (
          <button
            onClick={() => { setValue(String(card.current_points_balance)); setEditing(true) }}
            className="text-sm font-semibold text-stone-900 hover:text-amber-600 transition-colors"
            title="Tap to edit balance"
          >
            {card.current_points_balance.toLocaleString('en-IN')} pts
          </button>
        )}
        <span className={`block text-xs mt-0.5 px-1.5 py-0.5 rounded-full font-medium ${stale.cls}`}>
          {stale.label}
        </span>
      </div>

      {/* Delete button (edit mode only) */}
      {editMode && (
        <button
          onClick={() => onDelete(card.card_id)}
          className="ml-1 w-8 h-8 flex items-center justify-center rounded-xl bg-red-50 text-red-500 hover:bg-red-100 transition-colors flex-shrink-0"
          aria-label="Remove card"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
            <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
          </svg>
        </button>
      )}
    </div>
  )
}

export default function PortfolioPage() {
  const { user, loading: authLoading } = useRequireAuth()
  const { data: cards, isLoading: cardsLoading } = useCards(user?.id)
  const { mutate: removeCard } = useRemoveCard()
  const router = useRouter()

  const [editMode, setEditMode] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

  const loading = authLoading || cardsLoading

  function handleDeleteRequest(cardId: string) {
    setDeleteTarget(cardId)
  }

  function confirmDelete() {
    if (!deleteTarget || !user) return
    removeCard({ cardId: deleteTarget, userId: user.id })
    setDeleteTarget(null)
    if ((cards?.length ?? 0) <= 1) setEditMode(false)
  }

  return (
    <div className="flex flex-col bg-stone-50" style={{ minHeight: '100svh' }}>

      {/* Header */}
      <header className="bg-white border-b border-stone-200 px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <div>
          <h1 className="font-semibold text-stone-900 text-base">Your cards</h1>
          {!loading && (
            <p className="text-stone-500 text-xs mt-0.5">
              {cards && cards.length > 0
                ? `${cards.length} card${cards.length === 1 ? '' : 's'} registered`
                : 'No cards yet'}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          {cards && cards.length > 0 && (
            <button
              onClick={() => setEditMode(e => !e)}
              className={`text-sm font-medium transition-colors ${
                editMode ? 'text-amber-600' : 'text-stone-500 hover:text-stone-700'
              }`}
            >
              {editMode ? 'Done' : 'Edit'}
            </button>
          )}
          <button
            onClick={() => router.push('/onboarding')}
            className="text-sm font-medium text-amber-600 hover:text-amber-700 transition-colors"
          >
            + Add
          </button>
        </div>
      </header>

      {/* Card list */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {loading ? (
          [1, 2, 3].map(i => (
            <div key={i} className="bg-white border border-stone-200 rounded-2xl p-4 flex gap-3 animate-pulse">
              <div className="w-10 h-10 rounded-xl bg-stone-100 flex-shrink-0" />
              <div className="flex-1 space-y-2 py-1">
                <div className="h-3.5 bg-stone-100 rounded w-1/2" />
                <div className="h-3 bg-stone-100 rounded w-1/3" />
              </div>
              <div className="space-y-1.5 py-1">
                <div className="h-3.5 bg-stone-100 rounded w-20" />
                <div className="h-3 bg-stone-100 rounded w-14" />
              </div>
            </div>
          ))
        ) : !cards || cards.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 bg-amber-100 rounded-2xl flex items-center justify-center mb-5">
              <svg className="w-8 h-8 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <rect x="2" y="5" width="20" height="14" rx="2" />
                <path strokeLinecap="round" d="M2 10h20" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-stone-900 mb-2">No cards yet</h2>
            <p className="text-stone-500 text-sm max-w-xs mb-6">
              Add your premium credit cards to get personalised rewards advice.
            </p>
            <button
              onClick={() => router.push('/onboarding')}
              className="bg-amber-600 hover:bg-amber-700 text-white font-medium py-2.5 px-6 rounded-xl text-sm transition-colors"
            >
              Add your cards
            </button>
          </div>
        ) : (
          cards.map(card => (
            <CardRow
              key={card.id}
              card={card}
              userId={user!.id}
              editMode={editMode}
              onDelete={handleDeleteRequest}
            />
          ))
        )}
      </div>

      {/* Delete confirmation */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-sm p-6">
            <h3 className="font-semibold text-stone-900 mb-1.5">Remove this card?</h3>
            <p className="text-stone-500 text-sm mb-6">
              Your points balance and history for this card will be removed.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                className="flex-1 bg-stone-100 hover:bg-stone-200 text-stone-700 font-medium py-2.5 rounded-xl text-sm transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white font-medium py-2.5 rounded-xl text-sm transition-colors"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  )
}
