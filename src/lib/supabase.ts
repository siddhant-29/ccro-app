import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { createClientComponentClient, createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'

// Browser client — uses anon key (safe to expose)
export function createBrowserClient() {
  return createClientComponentClient()
}

// Route handler client — reads session from cookies
export { createRouteHandlerClient }

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY

if (!supabaseUrl) console.warn('Missing SUPABASE_URL — DB features disabled')
if (!supabaseServiceKey) console.warn('Missing SUPABASE_SERVICE_KEY — DB features disabled')

// Admin client — server-side only, bypasses RLS.
// null when env vars are absent (build time / misconfigured deploy).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const supabaseAdmin: SupabaseClient = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })
  : null as any

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
