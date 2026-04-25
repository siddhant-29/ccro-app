import { cookies } from 'next/headers'
import { createRouteHandlerClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export default async function AdminPage() {
  const supabase = createRouteHandlerClient({ cookies })
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-stone-900">Admin dashboard</h1>
        <p className="text-stone-500 text-sm mt-1">Internal tools for CCRO.</p>
      </div>

      <div className="bg-white border border-stone-200 rounded-2xl p-5 space-y-1">
        <p className="text-xs font-medium text-stone-500 uppercase tracking-wide">Authenticated as</p>
        <p className="text-sm text-stone-900 font-medium">{user?.email ?? '—'}</p>
        <p className="text-xs text-stone-400 font-mono">{user?.id ?? '—'}</p>
      </div>
    </div>
  )
}
