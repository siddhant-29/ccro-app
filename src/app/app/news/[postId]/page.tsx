'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useRequireAuth } from '@/hooks/useAuth'
import { BottomNav } from '@/components/BottomNav'
import type { NewsPost, NewsSeverity } from '@/types/news'

const SEVERITY_CONFIG: Record<NewsSeverity, { label: string; dot: string; bg: string; text: string }> = {
  critical:      { label: 'CRITICAL',  dot: '🔴', bg: 'bg-red-50',     text: 'text-red-700'     },
  important:     { label: 'IMPORTANT', dot: '🟠', bg: 'bg-amber-50',   text: 'text-amber-700'   },
  informational: { label: 'INFO',      dot: '🟢', bg: 'bg-emerald-50', text: 'text-emerald-700' },
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function NewsDetailPage() {
  const { user, loading: authLoading } = useRequireAuth()
  const params   = useParams()
  const router   = useRouter()
  const postId   = params.postId as string

  const [post,     setPost]     = useState<NewsPost | null>(null)
  const [loading,  setLoading]  = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (!user) return
    fetch(`/api/news/${postId}`)
      .then(r => {
        if (r.status === 404) { setNotFound(true); return null }
        return r.json()
      })
      .then(data => { if (data?.post) setPost(data.post) })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [user, postId])

  // Mark as read
  useEffect(() => {
    if (!user || !postId) return
    fetch(`/api/news/${postId}/read`, { method: 'POST' }).catch(() => {})
  }, [user, postId])

  if (authLoading || loading) {
    return (
      <div className="h-[100dvh] bg-stone-50 flex items-center justify-center">
        <div className="text-stone-400 text-sm">Loading…</div>
      </div>
    )
  }

  if (notFound || !post) {
    return (
      <div className="h-[100dvh] bg-stone-50 flex flex-col">
        <header className="bg-white border-b border-stone-200 px-4 py-3 flex items-center gap-3">
          <button onClick={() => router.push('/app/news')} className="text-stone-500 text-lg">←</button>
          <span className="font-medium text-stone-800 text-sm">News</span>
        </header>
        <div className="flex-1 flex items-center justify-center">
          <p className="text-stone-400 text-sm">Post not found</p>
        </div>
        <BottomNav />
      </div>
    )
  }

  const sev = SEVERITY_CONFIG[post.severity]
  const cardNames = post.affected_card_names ?? post.affected_cards

  return (
    <div className="h-[100dvh] bg-stone-50 flex flex-col">
      <header className="flex-shrink-0 bg-white border-b border-stone-200 px-4 py-3 flex items-center gap-3">
        <button onClick={() => router.push('/app/news')} className="text-stone-500 text-lg leading-none">←</button>
        <span className="font-medium text-stone-800 text-sm">News</span>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">

          <div className="flex items-center gap-3 flex-wrap">
            <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${sev.bg} ${sev.text}`}>
              {sev.dot} {sev.label}
            </span>
            <span className="text-xs text-stone-400">{formatDate(post.published_at ?? post.created_at)}</span>
          </div>

          <h1 className="text-2xl font-bold text-stone-900 leading-snug">{post.headline}</h1>

          {cardNames.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {cardNames.map((name, i) => (
                <span key={i} className="text-sm bg-amber-50 text-amber-700 px-3 py-1 rounded-full">{name}</span>
              ))}
            </div>
          )}

          <hr className="border-stone-100" />

          <p className="text-stone-700 leading-relaxed text-sm">{post.summary}</p>

          {/* Source attribution */}
          <div className="bg-stone-50 border border-stone-100 rounded-xl px-4 py-3 space-y-2">
            <div className="flex items-center gap-2 text-sm text-stone-600">
              <span>📎</span>
              <span>Source:</span>
              <a
                href={post.primary_source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-amber-600 hover:text-amber-700 underline underline-offset-2 truncate"
              >
                {post.primary_source_name}
              </a>
              <span className="text-stone-400 text-xs flex-shrink-0">↗</span>
            </div>
            {post.secondary_source_url && post.secondary_source_name && (
              <div className="flex items-center gap-2 text-sm text-stone-600">
                <span>📎</span>
                <span>Reported by:</span>
                <a
                  href={post.secondary_source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-amber-600 hover:text-amber-700 underline underline-offset-2 truncate"
                >
                  {post.secondary_source_name}
                </a>
                <span className="text-stone-400 text-xs flex-shrink-0">↗</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <hr className="flex-1 border-stone-100" />
            <span className="text-xs text-stone-400 whitespace-nowrap font-medium">💡 What this means for you</span>
            <hr className="flex-1 border-stone-100" />
          </div>

          <p className="text-stone-700 leading-relaxed text-sm">{post.analysis}</p>

          <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-4">
            <p className="text-sm font-medium text-stone-800 mb-3">Want to know more about this?</p>
            <button
              onClick={() => {
                const q = `Tell me more about: ${post.headline}`
                router.push(`/app/chat?q=${encodeURIComponent(q)}`)
              }}
              className="w-full bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium py-2.5 px-4 rounded-xl transition-colors"
            >
              Ask CCRO about it
            </button>
          </div>

          <div className="h-4" />
        </div>
      </div>

      <BottomNav />
    </div>
  )
}
