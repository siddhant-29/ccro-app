// ═══════════════════════════════════════════════════════════
// CCRO — React Query Client
// KAN-28: Cache TTLs configured per data type
// ═══════════════════════════════════════════════════════════

import { QueryClient } from '@tanstack/react-query'

// Cache TTL reference (in milliseconds)
// These match the values documented in the API and data access layer strategy
export const CACHE_TTL = {
  CARD_CATALOGUE:    60 * 60 * 1000,  // 60 min — changes at most once a day
  CARD_DETAIL:       30 * 60 * 1000,  // 30 min — may change after confirmed alert
  USER_CARDS:        30 * 1000,       // 30 sec — user may update on another device
  ALERTS:            0,               // 0 — handled via Supabase Realtime, not polling
  SUBSCRIPTION:      60 * 1000,       // 60 sec — must be current for gate checks
  CONVERSATIONS:     5 * 60 * 1000,   // 5 min — no real-time requirement
} as const

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime:            5 * 60 * 1000, // 5 min default
        gcTime:               30 * 60 * 1000, // 30 min — keep in cache after unmount
        retry:                2,
        refetchOnWindowFocus: false,          // don't re-fetch on tab switch
        refetchOnReconnect:   true,           // do re-fetch when network returns (EC-002)
      },
      mutations: {
        retry: 1,
      },
    },
  })
}

let browserQueryClient: QueryClient | undefined = undefined

export function getQueryClient() {
  if (typeof window === 'undefined') {
    // Server: always make a new query client
    return makeQueryClient()
  }
  // Browser: reuse the same client across renders
  if (!browserQueryClient) browserQueryClient = makeQueryClient()
  return browserQueryClient
}
