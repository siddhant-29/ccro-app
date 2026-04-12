// ═══════════════════════════════════════════════════════════
// CCRO — Supabase Client Configuration
// KAN-37: Both clients (anon + service role) configured
// ═══════════════════════════════════════════════════════════

import { createClient } from '@supabase/supabase-js'
import { createClientComponentClient, createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'

// ─────────────────────────────────────────────────────────
// Browser client — uses anon key (safe to expose)
// Use this in React components via createClientComponentClient
// ─────────────────────────────────────────────────────────
export function createBrowserClient() {
  return createClientComponentClient()
}

// ─────────────────────────────────────────────────────────
// Route handler client — for use inside /api/* routes
// Automatically reads session from cookies
// ─────────────────────────────────────────────────────────
export { createRouteHandlerClient }

// ─────────────────────────────────────────────────────────
// Admin client — service role key, bypasses RLS
// NEVER use this in client components or expose to browser
// Only used in /api/* route handlers and server actions
// ─────────────────────────────────────────────────────────
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY

if (!supabaseUrl) throw new Error('Missing SUPABASE_URL environment variable')
if (!supabaseServiceKey) throw new Error('Missing SUPABASE_SERVICE_KEY environment variable')

export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

// ─────────────────────────────────────────────────────────
// Auth helpers
// ─────────────────────────────────────────────────────────

/**
 * Get the current session from a route handler.
 * Returns null if not authenticated.
 * Use this at the start of every protected API route.
 */
export async function getSessionFromRequest(cookies: ReturnType<typeof import('next/headers').cookies>) {
  const supabase = createRouteHandlerClient({ cookies: () => cookies })
  const { data: { session }, error } = await supabase.auth.getSession()
  if (error || !session) return null
  return session
}
