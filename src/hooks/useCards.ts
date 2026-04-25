'use client'

// ─────────────────────────────────────────────────────────
// CCRO — useCards Hook
// Fetches user's registered cards with React Query caching
// KAN-40: Correct cache TTL (30 seconds for user cards)
// ─────────────────────────────────────────────────────────

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createBrowserClient } from '@/lib/supabase'
import { CACHE_TTL } from '@/lib/query-client'
import type { UserCard } from '@/types'

const QUERY_KEY = ['user-cards']

export function useCards(userId: string | undefined) {
  return useQuery({
    queryKey: [...QUERY_KEY, userId],
    queryFn: async (): Promise<UserCard[]> => {
      if (!userId) return []

      // Client created inside queryFn — never runs during prerender
      const supabase = createBrowserClient()
      const { data, error } = await supabase
        .from('user_cards')
        .select(`
          *,
          card_rewards (
            card_name,
            issuer,
            tier,
            affiliate_url
          )
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: true })

      if (error) throw error
      return (data ?? []) as UserCard[]
    },
    enabled: !!userId,
    staleTime: CACHE_TTL.USER_CARDS,
  })
}

export function useUpdateCardBalance() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      cardId,
      userId,
      balance,
    }: {
      cardId: string
      userId: string
      balance: number
    }) => {
      const supabase = createBrowserClient()
      const { error } = await supabase
        .from('user_cards')
        .update({
          current_points_balance: balance,
          balance_last_updated: new Date().toISOString(),
        })
        .eq('user_id', userId)
        .eq('card_id', cardId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY })
    },
  })
}

export function useAddCard() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      userId,
      cardId,
      balance,
    }: {
      userId: string
      cardId: string
      balance: number
    }) => {
      const supabase = createBrowserClient()
      const { error } = await supabase
        .from('user_cards')
        .insert({
          user_id: userId,
          card_id: cardId,
          current_points_balance: balance,
        })

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY })
    },
  })
}

export function useRemoveCard() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      userId,
      cardId,
    }: {
      userId: string
      cardId: string
    }) => {
      const supabase = createBrowserClient()
      const { error } = await supabase
        .from('user_cards')
        .delete()
        .eq('user_id', userId)
        .eq('card_id', cardId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY })
    },
  })
}
