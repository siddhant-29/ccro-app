'use client'

import type { NewsPost, NewsSeverity, NewsStatus } from '@/types/news'

const SEVERITY_CONFIG: Record<NewsSeverity, { label: string; dot: string; bg: string; text: string }> = {
  critical:      { label: 'CRITICAL',  dot: '🔴', bg: 'bg-red-50',     text: 'text-red-700'     },
  important:     { label: 'IMPORTANT', dot: '🟠', bg: 'bg-amber-50',   text: 'text-amber-700'   },
  informational: { label: 'INFO',      dot: '🟢', bg: 'bg-emerald-50', text: 'text-emerald-700' },
}

const STATUS_CONFIG: Record<NewsStatus, { label: string; bg: string; text: string }> = {
  draft:     { label: 'Draft',     bg: 'bg-stone-100',   text: 'text-stone-500'   },
  published: { label: 'Published', bg: 'bg-emerald-50',  text: 'text-emerald-700' },
  archived:  { label: 'Archived',  bg: 'bg-stone-100',   text: 'text-stone-400'   },
}

function relativeTime(dateStr: string): string {
  const ms = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(ms / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(ms / 3600000)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(ms / 86400000)}d ago`
}

export function NewsPostCard({
  post,
  variant,
  onClick,
}: {
  post: NewsPost
  variant: 'user' | 'admin'
  onClick?: () => void
}) {
  const sev = SEVERITY_CONFIG[post.severity]
  const cardNames = post.affected_card_names ?? post.affected_cards
  const isUnread = variant === 'user' && post.is_read === false

  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-2xl p-4 transition-all duration-150 ${
        onClick ? 'cursor-pointer hover:shadow-sm active:scale-[0.99]' : ''
      } ${
        isUnread
          ? 'border-l-[4px] border-l-amber-500 border border-stone-200'
          : 'border border-stone-200'
      }`}
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${sev.bg} ${sev.text}`}>
          {sev.dot} {sev.label}
        </span>
        <div className="flex items-center gap-2 flex-shrink-0">
          {variant === 'admin' && (
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_CONFIG[post.status].bg} ${STATUS_CONFIG[post.status].text}`}>
              {STATUS_CONFIG[post.status].label}
            </span>
          )}
          <span className="text-xs text-stone-400 whitespace-nowrap">{relativeTime(post.created_at)}</span>
        </div>
      </div>

      <h3 className="font-semibold text-stone-900 text-sm leading-snug line-clamp-2 mb-2">
        {post.headline}
      </h3>

      {cardNames.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {cardNames.slice(0, 3).map((card, i) => (
            <span key={i} className="text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full">
              {card}
            </span>
          ))}
          {cardNames.length > 3 && (
            <span className="text-xs text-stone-400">+{cardNames.length - 3} more</span>
          )}
        </div>
      )}
    </div>
  )
}
