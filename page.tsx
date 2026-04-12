// ═══════════════════════════════════════════════════════════
// CCRO — Root page
// Redirects authenticated users to /app/chat
// Redirects unauthenticated users to /sign-in
// ═══════════════════════════════════════════════════════════

import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'

export default async function RootPage() {
  const supabase = createRouteHandlerClient({ cookies })
  const { data: { session } } = await supabase.auth.getSession()

  if (session) {
    redirect('/app/chat')
  } else {
    redirect('/sign-in')
  }
}
