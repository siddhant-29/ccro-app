// ═══════════════════════════════════════════════════════════
// CCRO — Subscription Configuration
// KAN-86: FREE_FOR_ALL flag controls all tier enforcement
//
// Phase 1: FREE_FOR_ALL=true  → everyone gets Max access
// Phase 3: FREE_FOR_ALL=false → enforce tiers, Razorpay active
//
// Flipping the env var is the ONLY change needed to enforce.
// Zero code changes required at monetisation time.
// ═══════════════════════════════════════════════════════════

import type { SubscriptionTier, LimitCheckResult } from '@/types'
import { supabaseAdmin } from '@/lib/supabase'

// ─────────────────────────────────────────────────────────
// Feature flags per tier
// ─────────────────────────────────────────────────────────

export const SUBSCRIPTION_CONFIG = {
  FREE_FOR_ALL: process.env.FREE_FOR_ALL === 'true',

  tiers: {
    basic: {
      queries_per_day: 10,
      max_cards: 3,
      conversation_history_turns: 10,
      alert_delay_hours: 48,
      multi_card_orchestration: false,
      card_comparison: false,
      full_transfer_partners: false,   // only top 3 partners shown
      portfolio_optimiser: false,
      milestone_tracking: 'basic' as const,
      export: false as false,
      family_portfolios: false,
      human_consultation: false,
      api_access: false,
    },
    pro: {
      queries_per_day: 100,
      max_cards: Infinity,
      conversation_history_turns: Infinity,
      alert_delay_hours: 0,
      multi_card_orchestration: true,
      card_comparison: true,
      full_transfer_partners: true,
      portfolio_optimiser: true,
      milestone_tracking: 'full' as const,
      export: 'pdf' as 'pdf',
      family_portfolios: false,
      human_consultation: false,
      api_access: false,
    },
    max: {
      queries_per_day: Infinity,
      max_cards: Infinity,
      conversation_history_turns: Infinity,
      alert_delay_hours: 0,
      multi_card_orchestration: true,
      card_comparison: true,
      full_transfer_partners: true,
      portfolio_optimiser: true,
      milestone_tracking: 'full_with_forecasting' as const,
      export: 'pdf_csv' as 'pdf_csv',
      family_portfolios: true,
      human_consultation: true,
      api_access: true,
    },
  },

  pricing: {
    pro:  { monthly_inr: 299,  annual_inr: 2990 },
    max:  { monthly_inr: 599,  annual_inr: 5990 },
  },

  razorpay: {
    pro_monthly_plan_id:  process.env.RAZORPAY_PRO_MONTHLY_PLAN_ID  ?? '',
    pro_annual_plan_id:   process.env.RAZORPAY_PRO_ANNUAL_PLAN_ID   ?? '',
    max_monthly_plan_id:  process.env.RAZORPAY_MAX_MONTHLY_PLAN_ID  ?? '',
    max_annual_plan_id:   process.env.RAZORPAY_MAX_ANNUAL_PLAN_ID   ?? '',
  },
} as const

// ─────────────────────────────────────────────────────────
// Tier resolution
// ─────────────────────────────────────────────────────────

/**
 * Get the effective tier for a user.
 * Returns 'max' immediately if FREE_FOR_ALL is true.
 * Returns 'basic' if no active subscription found.
 */
export async function getUserTier(userId: string): Promise<SubscriptionTier> {
  if (SUBSCRIPTION_CONFIG.FREE_FOR_ALL) return 'max'

  const { data, error } = await supabaseAdmin
    .from('subscriptions')
    .select('tier, status, current_period_end, trial_end')
    .eq('user_id', userId)
    .single()

  if (error || !data) return 'basic'

  // Check trial
  if (data.status === 'trialing' && data.trial_end) {
    if (new Date(data.trial_end) > new Date()) {
      return data.tier as SubscriptionTier
    }
    return 'basic'
  }

  // Check active subscription
  if (data.status !== 'active') return 'basic'
  if (data.current_period_end && new Date(data.current_period_end) < new Date()) {
    return 'basic' // expired — lazy evaluation, no cron needed
  }

  return data.tier as SubscriptionTier
}

// ─────────────────────────────────────────────────────────
// Limit checks
// ─────────────────────────────────────────────────────────

type CheckableFeature = 'queries_per_day' | 'max_cards' | 'multi_card_orchestration'
  | 'card_comparison' | 'full_transfer_partners' | 'portfolio_optimiser'

/**
 * Check if a user is allowed to use a feature.
 * Always returns { allowed: true } when FREE_FOR_ALL=true.
 */
export async function checkSubscriptionLimit(
  userId: string,
  feature: CheckableFeature
): Promise<LimitCheckResult> {
  if (SUBSCRIPTION_CONFIG.FREE_FOR_ALL) return { allowed: true }

  const tier = await getUserTier(userId)
  const config = SUBSCRIPTION_CONFIG.tiers[tier]
  const value = config[feature as keyof typeof config]

  // Boolean feature flag
  if (value === false) {
    const alternatives: Record<string, string> = {
      multi_card_orchestration: 'I can look at one card at a time on the free plan. Which card would you like to focus on?',
      card_comparison:          'I can answer detailed questions about any one card. Which card would you like to explore?',
      portfolio_optimiser:      'I can review one card at a time. Which card are you considering?',
      full_transfer_partners:   'I\'m showing the top 3 transfer partners. Upgrade to Pro to see all partners and caps.',
    }
    return {
      allowed: false,
      reason: alternatives[feature] ?? `${feature} is available on Pro and above.`,
      upgrade_url: '/upgrade',
    }
  }

  // Daily query limit
  if (feature === 'queries_per_day') {
    const limit = value as number
    if (limit === Infinity) return { allowed: true }

    const today = new Date().toISOString().split('T')[0]
    const { data } = await supabaseAdmin
      .from('user_usage')
      .select('queries_count')
      .eq('user_id', userId)
      .eq('date', today)
      .single()

    const used = data?.queries_count ?? 0
    if (used >= limit) {
      return {
        allowed: false,
        reason: `You've used your ${limit} free queries for today. Resets at midnight. Upgrade to Pro for ${SUBSCRIPTION_CONFIG.tiers.pro.queries_per_day} queries/day.`,
        limit,
        upgrade_url: '/upgrade',
      }
    }
    return { allowed: true, limit }
  }

  // Card count limit
  if (feature === 'max_cards') {
    const limit = value as number
    if (limit === Infinity) return { allowed: true }

    const { count } = await supabaseAdmin
      .from('user_cards')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)

    if ((count ?? 0) >= limit) {
      return {
        allowed: false,
        reason: `The free plan allows up to ${limit} cards. Upgrade to Pro to add unlimited cards.`,
        limit,
        upgrade_url: '/upgrade',
      }
    }
    return { allowed: true, limit }
  }

  return { allowed: true }
}

// ─────────────────────────────────────────────────────────
// Intent → feature mapping
// Used by /api/chat to gate intents by tier
// ─────────────────────────────────────────────────────────

export const INTENT_FEATURE_MAP: Record<string, CheckableFeature | null> = {
  redemption_path:          null,                       // Basic
  general_education:        null,                       // Basic
  milestone_check:          null,                       // Basic
  devaluation_impact:       null,                       // Basic (with delay)
  card_comparison:          'card_comparison',          // Pro
  category_optimizer:       'card_comparison',          // Pro
  multi_card_orchestration: 'multi_card_orchestration', // Pro
  portfolio_optimiser:      'portfolio_optimiser',      // Pro
}
