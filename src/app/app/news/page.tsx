'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useRequireAuth } from '@/hooks/useAuth'
import { NewsPostCard } from '@/components/NewsPostCard'
import { BottomNav } from '@/components/BottomNav'
import type { NewsPost } from '@/types/news'

const FILTERS = [
  { key: '',             label: 'All'          },
  { key: 'for_you',      label: 'For You'      },
  { key: 'critical',     label: 'Critical'     },
  { key: 'this_week',    label: 'This week'    },
  { key: 'devaluations', label: 'Devaluations' },
]

export default function NewsPage() {
  const { user, loading: authLoading } = useRequireAuth()
  const router = useRouter()
  const [posts,        setPosts]        = useState<NewsPost[]>([])
  const [loading,      setLoading]      = useState(true)
  const [activeFilter, setActiveFilter] = useState('')

  useEffect(() => {
    if (!user) return
    setLoading(true)
    const params = new URLSearchParams({ country: 'IN' })
    if (activeFilter) params.set('filter', activeFilter)

    fetch(`/api/news?${params}`)
      .then(r => r.json())
      .then(({ posts: p }: { posts: NewsPost[] }) => setPosts(p ?? []))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [user, activeFilter])

  if (authLoading) {
    return (
      <div className="h-[100dvh] bg-stone-50 flex items-center justify-center">
        <div className="text-stone-400 text-sm">Loading…</div>
      </div>
    )
  }

  return (
    <div className="h-[100dvh] bg-stone-50 flex flex-col">
      <header className="flex-shrink-0 bg-white border-b border-stone-200 px-4 py-3">
        <h1 className="font-semibold text-stone-900 text-base">📰 News</h1>
      </header>

      {/* Filter chips */}
      <div className="flex-shrink-0 bg-white border-b border-stone-100 px-4 py-2 flex gap-2 overflow-x-auto">
        {FILTERS.map(f => (
          <button
            key={f.key}
            onClick={() => setActiveFilter(f.key)}
            className={`text-xs px-3 py-1.5 rounded-full whitespace-nowrap flex-shrink-0 font-medium transition-colors ${
              activeFilter === f.key
                ? 'bg-amber-600 text-white'
                : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 max-w-2xl mx-auto w-full">
        {loading ? (
          <div className="text-center py-12 text-stone-400 text-sm">Loading…</div>
        ) : posts.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-4xl mb-3">📭</p>
            <p className="text-sm text-stone-500 leading-relaxed">
              No news yet — we&apos;ll keep you posted on changes affecting your cards
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {posts.map(post => (
              <NewsPostCard
                key={post.id}
                post={post}
                variant="user"
                onClick={() => router.push(`/app/news/${post.id}`)}
              />
            ))}
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  )
}
