import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'

// Browser client — raw createClient (auth-js defaults to implicit flow).
// @supabase/ssr and @supabase/auth-helpers-nextjs both hardcode flowType:'pkce'
// after spreading user options, so they cannot be overridden. Raw createClient
// respects auth.flowType:'implicit', so magic links carry token_hash instead
// of a PKCE code — usable cross-device without a localStorage code_verifier.
export function createBrowserClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        flowType: 'implicit',
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    },
  )
}

// Route handler client — reads session from cookies
export { createRouteHandlerClient }

// Admin client — server-side only, bypasses RLS.
//
// Uses a Proxy so the env-var check and createClient call are deferred to
// first use (request time), not module load time. This keeps `next build`
// working in environments without SUPABASE_* vars (CI, preview), while
// still throwing a loud, named error the moment a real request hits a
// misconfigured deploy — visible in Vercel/server logs.
let _adminClient: SupabaseClient | null = null

function getAdminClient(): SupabaseClient {
  if (_adminClient) return _adminClient

  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_KEY

  if (!url) throw new Error('Missing SUPABASE_URL')
  if (!key) throw new Error('Missing SUPABASE_SERVICE_KEY')

  _adminClient = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  return _adminClient
}

export const supabaseAdmin: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    return getAdminClient()[prop as keyof SupabaseClient]
  },
})

// Convenience alias used by telegram bot routes
export const supabase = supabaseAdmin

export async function getSessionFromRequest(
  cookies: ReturnType<typeof import('next/headers').cookies>
) {
  const client = createRouteHandlerClient({ cookies: () => cookies })
  const { data: { session }, error } = await client.auth.getSession()
  if (error || !session) return null
  return session
}
