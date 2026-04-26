'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

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

  return (
    <nav
      className="flex-shrink-0 bg-white border-t border-stone-100 flex h-14"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      {TABS.map(tab => {
        const active = pathname === tab.href || pathname.startsWith(tab.href + '/')
        const cls = 'flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors duration-150'
        const iconEl = (
          <div className={`p-1.5 rounded-lg transition-colors duration-150 ${active ? 'bg-amber-50 text-amber-600' : 'text-stone-400'}`}>
            {tab.icon}
          </div>
        )
        const labelEl = (
          <span className={`text-[10px] font-medium leading-none transition-colors duration-150 ${active ? 'text-amber-600' : 'text-stone-400'}`}>
            {tab.label}
          </span>
        )

        // Home tab while on /app/chat: fire reset event instead of navigating
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

        return (
          <Link key={tab.href} href={tab.href} className={cls}>
            {iconEl}{labelEl}
          </Link>
        )
      })}
    </nav>
  )
}
