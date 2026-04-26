'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { NewsPostCard } from '@/components/NewsPostCard'
import type { NewsPost } from '@/types/news'

const STATUS_TABS = [
  { key: '',          label: 'All'       },
  { key: 'draft',     label: 'Drafts'    },
  { key: 'published', label: 'Published' },
  { key: 'archived',  label: 'Archived'  },
]

const SEVERITY_OPTIONS = [
  { key: '',              label: 'All severities' },
  { key: 'critical',      label: '🔴 Critical'   },
  { key: 'important',     label: '🟠 Important'  },
  { key: 'informational', label: '🟢 Info'       },
]

export default function AdminNewsPage() {
  const router = useRouter()
  const [posts, setPosts] = useState<NewsPost[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('')
  const [severity, setSeverity] = useState('')
  const [draftsPending, setDraftsPending] = useState(0)

  useEffect(() => {
    setLoading(true)
    const params = new URLSearchParams()
    if (activeTab) params.set('status', activeTab)
    if (severity)  params.set('severity', severity)

    fetch(`/api/admin/news?${params}`)
      .then(r => r.json())
      .then(({ posts: p, stats }: { posts: NewsPost[]; stats?: { drafts_pending: number } }) => {
        setPosts(p ?? [])
        if (stats) setDraftsPending(stats.drafts_pending)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [activeTab, severity])

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-stone-900">News Posts</h1>
          {draftsPending > 0 && (
            <p className="text-sm text-amber-600 mt-0.5">
              {draftsPending} draft{draftsPending !== 1 ? 's' : ''} pending review
            </p>
          )}
        </div>
        <Link
          href="/admin/news/new"
          className="bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors"
        >
          + New post
        </Link>
      </div>

      {/* Status tabs */}
      <div className="flex gap-1 mb-4 bg-stone-100 p-1 rounded-xl w-fit">
        {STATUS_TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-colors ${
              activeTab === tab.key
                ? 'bg-white text-stone-900 shadow-sm'
                : 'text-stone-500 hover:text-stone-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Severity filter */}
      <div className="mb-6">
        <select
          value={severity}
          onChange={e => setSeverity(e.target.value)}
          className="text-sm bg-white border border-stone-200 rounded-lg px-3 py-1.5 text-stone-700 focus:outline-none focus:ring-2 focus:ring-amber-500"
        >
          {SEVERITY_OPTIONS.map(o => (
            <option key={o.key} value={o.key}>{o.label}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="text-stone-400 text-sm">Loading…</div>
      ) : posts.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-4xl mb-3">📭</p>
          <p className="text-sm text-stone-400">No posts found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {posts.map(post => (
            <NewsPostCard
              key={post.id}
              post={post}
              variant="admin"
              onClick={() => router.push(`/admin/news/${post.id}`)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
