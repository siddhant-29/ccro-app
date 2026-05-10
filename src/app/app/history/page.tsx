'use client'

export const dynamic = 'force-dynamic'

// KAN-124: Conversation history list screen

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useRequireAuth } from '@/hooks/useAuth'
import { BottomNav } from '@/components/BottomNav'

interface ConversationEntry {
  id: string
  title: string
  preview: string
  created_at: string
  recent: boolean
}

function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/#{1,6}\s/g, '')
    .replace(/\|.*\|/g, '')
    .replace(/---/g, '')
    .trim()
}

function relativeTime(dateStr: string): string {
  const s = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (s < 60) return 'Just now'
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d}d ago`
  return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

// ── Swipeable row ────────────────────────────────────────────────────────

function ConversationRow({
  entry,
  onTap,
  onDelete,
}: {
  entry: ConversationEntry
  onTap: (id: string) => void
  onDelete: (id: string) => void
}) {
  const [swiped, setSwiped] = useState(false)
  const startXRef = useRef(0)

  function handleTouchStart(e: React.TouchEvent) {
    startXRef.current = e.touches[0].clientX
  }

  function handleTouchEnd(e: React.TouchEvent) {
    const dx = e.changedTouches[0].clientX - startXRef.current
    if (dx < -60) setSwiped(true)
    else if (dx > 20) setSwiped(false)
  }

  function handleClick() {
    if (swiped) { setSwiped(false); return }
    onTap(entry.id)
  }

  return (
    <div className="relative overflow-hidden border-b border-stone-100 last:border-0">
      {/* Delete button revealed on swipe */}
      <div
        aria-hidden="true"
        className={`absolute right-0 top-0 bottom-0 bg-red-500 flex items-center justify-center transition-all duration-200 ${swiped ? 'w-20' : 'w-0'}`}
      >
        <button
          onClick={() => onDelete(entry.id)}
          className="text-white text-xs font-semibold px-3 whitespace-nowrap"
        >
          Delete
        </button>
      </div>

      {/* Main content — slides left on swipe */}
      <button
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onClick={handleClick}
        style={{
          transform: swiped ? 'translateX(-80px)' : 'translateX(0)',
          transition: 'transform 200ms ease',
        }}
        className="w-full bg-white px-4 py-3.5 flex gap-3 items-start text-left hover:bg-stone-50 active:bg-stone-100"
      >
        <span
          className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${
            entry.recent ? 'bg-amber-500' : 'bg-stone-300'
          }`}
        />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-stone-900 truncate">{entry.title}</p>
          <p className="text-xs text-stone-400 truncate mt-0.5">{stripMarkdown(entry.preview)}</p>
        </div>
        <span suppressHydrationWarning className="text-xs text-stone-400 flex-shrink-0 mt-0.5">
          {relativeTime(entry.created_at)}
        </span>
      </button>
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────

export default function HistoryPage() {
  const { loading: authLoading } = useRequireAuth()
  const router = useRouter()

  const [conversations, setConversations] = useState<ConversationEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    fetch('/api/chat/history')
      .then(r => r.json())
      .then((data: { conversations?: ConversationEntry[] }) => {
        setConversations(data.conversations ?? [])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  function handleTap(id: string) {
    router.push(`/app/chat?conversationId=${encodeURIComponent(id)}`)
  }

  function handleDelete(id: string) {
    // Optimistic removal
    setConversations(prev => prev.filter(c => c.id !== id))
    // Fire-and-forget
    fetch('/api/chat/history', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    }).catch(() => {})
  }

  const filtered = search
    ? conversations.filter(c =>
        c.title.toLowerCase().includes(search.toLowerCase()) ||
        c.preview.toLowerCase().includes(search.toLowerCase())
      )
    : conversations

  if (authLoading) {
    return (
      <div className="h-[100dvh] bg-stone-50 flex items-center justify-center">
        <div className="text-stone-400 text-sm">Loading…</div>
      </div>
    )
  }

  return (
    <div className="flex flex-col bg-stone-50" style={{ minHeight: '100svh' }}>

      {/* Header */}
      <header className="flex-shrink-0 bg-white border-b border-stone-200 px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <h1 className="font-semibold text-stone-900 text-base">Conversations</h1>
        <button
          onClick={() => router.push('/app/chat')}
          className="text-sm font-medium text-amber-600 hover:text-amber-700 transition-all duration-100 active:scale-95"
        >
          + New chat
        </button>
      </header>

      {/* Search */}
      <div className="flex-shrink-0 bg-white border-b border-stone-100 px-4 py-2.5">
        <div className="relative">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400"
            viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
          >
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" strokeLinecap="round" />
          </svg>
          <input
            type="text"
            placeholder="Search conversations…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-stone-100 rounded-xl text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div>
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="bg-white px-4 py-3.5 flex gap-3 animate-pulse border-b border-stone-100">
                <div className="w-2 h-2 rounded-full bg-stone-200 mt-2 flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 bg-stone-100 rounded w-3/4" />
                  <div className="h-3 bg-stone-100 rounded w-full" />
                </div>
                <div className="h-3 bg-stone-100 rounded w-10 flex-shrink-0" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center px-6">
            {search ? (
              <>
                <p className="text-stone-500 text-sm">No conversations match &ldquo;{search}&rdquo;</p>
                <button
                  onClick={() => setSearch('')}
                  className="mt-3 text-sm text-amber-600 hover:text-amber-700 transition-all duration-100 active:scale-95"
                >
                  Clear search
                </button>
              </>
            ) : (
              <>
                <div className="w-12 h-12 bg-stone-100 rounded-2xl flex items-center justify-center mb-4">
                  <svg className="w-6 h-6 text-stone-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 6v6l4 2" strokeLinecap="round" />
                  </svg>
                </div>
                <p className="text-stone-500 text-sm mb-4">No conversations yet — ask your first question</p>
                <button
                  onClick={() => router.push('/app/chat')}
                  className="bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium py-2 px-5 rounded-xl transition-all duration-100 active:scale-95"
                >
                  Start a chat
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="bg-white">
            {filtered.map(c => (
              <ConversationRow
                key={c.id}
                entry={c}
                onTap={handleTap}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  )
}
