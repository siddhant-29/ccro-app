import { QueryClient } from '@tanstack/react-query'

export const CACHE_TTL = {
  CARD_CATALOGUE:  60 * 60 * 1000,
  CARD_DETAIL:     30 * 60 * 1000,
  USER_CARDS:      30 * 1000,
  ALERTS:          0,
  SUBSCRIPTION:    60 * 1000,
  CONVERSATIONS:   5 * 60 * 1000,
} as const

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime:            5 * 60 * 1000,
        gcTime:               30 * 60 * 1000,
        retry:                2,
        refetchOnWindowFocus: false,
        refetchOnReconnect:   true,
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
    return makeQueryClient()
  }
  if (!browserQueryClient) browserQueryClient = makeQueryClient()
  return browserQueryClient
}
