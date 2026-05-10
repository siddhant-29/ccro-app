'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

const TABS = [
  {
    href: '/app/chat',
    label: 'Home',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        <path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H5a1 1 0 01-1-1z" />
        <path d="M9 21V12h6v9" />
      </svg>
    ),
  },
  {
    href: '/app/news',
    label: 'News',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        <path d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10l6 6v8a2 2 0 01-2 2z" />
        <path d="M17 20v-8h-6v8" />
        <path d="M7 8h4" />
        <path d="M7 12h4" />
      </svg>
    ),
    showBadge: true,
  },
  {
    href: '/app/history',
    label: 'History',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 6v6l4 2" />
      </svg>
    ),
  },
  {
    href: '/app/portfolio',
    label: 'Cards',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        <rect x="2" y="5" width="20" height="14" rx="2" />
        <path d="M2 10h20" />
      </svg>
    ),
  },
  {
    href: '/app/profile',
    label: 'Profile',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        <circle cx="12" cy="8" r="4" />
        <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
      </svg>
    ),
  },
]

export function BottomNav() {
  const pathname = usePathname()
  const router = useRouter()
  const [newsUnread, setNewsUnread] = useState<number | null>(null)

  useEffect(() => {
    ;(async () => {
      try {
        const res = await fetch('/api/news/unread-count')
        const data = await res.json() as { count?: number }
        setNewsUnread(data.count ?? 0)
      } catch {
        setNewsUnread(0)
      }
    })()
  }, [pathname])

  return (
    <nav
      className="flex-shrink-0 bg-white border-t border-stone-100 flex h-14"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      {TABS.map(tab => {
        const active = pathname === tab.href || pathname.startsWith(tab.href + '/')
        const cls = 'flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors duration-150 relative'
        const showBadge = (tab as { showBadge?: boolean }).showBadge && newsUnread !== null && newsUnread > 0

        const iconEl = (
          <div className={`p-1.5 rounded-lg transition-colors duration-150 relative ${active ? 'bg-amber-50 text-amber-600' : 'text-stone-400'}`}>
            {tab.icon}
            {showBadge && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-0.5 leading-none">
                {newsUnread > 9 ? '9+' : newsUnread}
              </span>
            )}
          </div>
        )
        const labelEl = (
          <span className={`text-[10px] font-medium leading-none transition-colors duration-150 ${active ? 'text-amber-600' : 'text-stone-400'}`}>
            {tab.label}
          </span>
        )

        if (tab.href === '/app/chat' && active) {
          return (
            <button
              key={tab.href}
              className={cls}
              onClick={() => {
                if (typeof window !== 'undefined') {
                  window.dispatchEvent(new CustomEvent('ccro:home-reset'))
                }
              }}
            >
              {iconEl}{labelEl}
            </button>
          )
        }

        // History tab — router.refresh() busts the route cache so useEffect
        // re-runs and always shows the latest conversations
        if (tab.href === '/app/history') {
          return (
            <button
              key={tab.href}
              className={cls}
              onClick={() => {
                router.push('/app/history')
                router.refresh()
              }}
            >
              {iconEl}{labelEl}
            </button>
          )
        }

        return (
          <Link key={tab.href} href={tab.href} className={cls}>
            {iconEl}{labelEl}
          </Link>
        )
      })}
    </nav>
  )
}
