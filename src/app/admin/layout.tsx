import type { ReactNode } from 'react'

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-stone-100">
      <header className="bg-white border-b border-stone-200 px-6 py-3 flex items-center gap-3">
        <div className="w-6 h-6 bg-red-600 rounded flex items-center justify-center flex-shrink-0">
          <span className="text-white text-[10px] font-bold leading-none">A</span>
        </div>
        <span className="font-semibold text-stone-900 text-sm">CCRO Admin</span>
      </header>
      <main className="px-6 py-8 max-w-5xl mx-auto">
        {children}
      </main>
    </div>
  )
}
