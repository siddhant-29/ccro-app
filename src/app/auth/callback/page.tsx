'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { createBrowserClient } from '@/lib/supabase'

export default function AuthCallbackPage() {
  const router = useRouter()

  useEffect(() => {
    // @supabase/ssr createBrowserClient hardcodes flowType:'pkce' which looks
    // for ?code= in query params, not #access_token= in the hash fragment.
    // Use a raw implicit-flow client to extract the session from the hash,
    // then hand it to the @supabase/ssr client which stores it in cookies
    // so the server-side middleware can read it.
    const implicitClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { flowType: 'implicit', detectSessionInUrl: true } }
    )

    implicitClient.auth.getSession().then(async ({ data: { session } }) => {
      if (session) {
        // Write the session into @supabase/ssr's cookie-based storage so
        // the Next.js middleware can find it on subsequent requests
        const ssrClient = createBrowserClient()
        await ssrClient.auth.setSession({
          access_token: session.access_token,
          refresh_token: session.refresh_token,
        })
        router.replace('/app/chat')
      } else {
        console.error('[auth/callback] no session in hash fragment')
        router.replace('/sign-in?error=Could+not+authenticate')
      }
    })
  }, [router])

  return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-amber-500 flex items-center justify-center">
          <span className="text-white font-bold text-xs">CP</span>
        </div>
        <p className="text-stone-400 text-sm">Signing you in...</p>
      </div>
    </div>
  )
}
