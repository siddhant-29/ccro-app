import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { createServerClient, createBrowserClient as createSSRBrowserClient } from '@supabase/ssr'

// Browser client — uses @supabase/ssr so it reads the chunked cookies
// (sb-xxx-auth-token.0/.1/...) that createServerClient writes in the
// auth callback. auth-helpers-nextjs reads a single cookie and finds nothing.
export function createBrowserClient() {
  return createSSRBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}

// Route handler client — wrapper with the same call signature as
// auth-helpers-nextjs createRouteHandlerClient so all API routes work unchanged.
// Uses @supabase/ssr to read the chunked cookie format written by the callback.
export function createRouteHandlerClient({
  cookies: getCookies,
}: {
  cookies: () => ReturnType<typeof import('next/headers').cookies>
}) {
  const cookieStore = getCookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  )
}

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
