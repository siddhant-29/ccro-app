import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { createClientComponentClient, createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'

// Browser client — uses anon key (safe to expose)
export function createBrowserClient() {
  return createClientComponentClient()
}

// Route handler client — reads session from cookies
export { createRouteHandlerClient }

// Admin client — lazily initialised so module import never throws at build time.
// Server-side only: bypasses RLS.
let _adminClient: SupabaseClient | null = null

export function getSupabaseAdmin(): SupabaseClient {
  if (_adminClient) return _adminClient

  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_KEY

  if (!url) throw new Error('Missing SUPABASE_URL environment variable')
  if (!key) throw new Error('Missing SUPABASE_SERVICE_KEY environment variable')

  _adminClient = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  return _adminClient
}

// Named export used by subscription-config.ts and other server code
export const supabaseAdmin = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    return getSupabaseAdmin()[prop as keyof SupabaseClient]
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
