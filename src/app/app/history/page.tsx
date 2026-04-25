'use client'

// KAN-124: Conversation history list screen

import { useEffect, useState } from 'react'
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

  const filtered = search
    ? conversations.filter(c =>
        c.title.toLowerCase().includes(search.toLowerCase()) ||
        c.preview.toLowerCase().includes(search.toLowerCase())
      )
    : conversations

  if (authLoading) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <div className="text-stone-400 text-sm">Loading…</div>
      </div>
    )
  }

  return (
    <div className="flex flex-col bg-stone-50" style={{ minHeight: '100svh' }}>

      {/* Header */}
      <header className="bg-white border-b border-stone-200 px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <h1 className="font-semibold text-stone-900 text-base">History</h1>
        <button
          onClick={() => router.push('/app/chat')}
          className="text-sm font-medium text-amber-600 hover:text-amber-700 transition-colors"
        >
          + New chat
        </button>
      </header>

      {/* Search */}
      <div className="bg-white border-b border-stone-100 px-4 py-2.5">
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
            className="w-full pl-9 pr-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="space-y-px">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="bg-white px-4 py-3.5 flex gap-3 animate-pulse">
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
                  className="mt-3 text-sm text-amber-600 hover:text-amber-700"
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
                <p className="text-stone-500 text-sm mb-4">No conversations yet</p>
                <button
                  onClick={() => router.push('/app/chat')}
                  className="bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium py-2 px-5 rounded-xl transition-colors"
                >
                  Start a chat
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="divide-y divide-stone-100">
            {filtered.map(c => (
              <button
                key={c.id}
                onClick={() => router.push('/app/chat')}
                className="w-full bg-white px-4 py-3.5 flex gap-3 items-start text-left hover:bg-stone-50 transition-colors active:bg-stone-100"
              >
                <span
                  className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${
                    c.recent ? 'bg-amber-500' : 'bg-stone-300'
                  }`}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-stone-900 truncate">{c.title}</p>
                  <p className="text-xs text-stone-400 truncate mt-0.5">{c.preview}</p>
                </div>
                <span className="text-xs text-stone-400 flex-shrink-0 mt-0.5">
                  {relativeTime(c.created_at)}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  )
}
