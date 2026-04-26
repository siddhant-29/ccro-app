/**
 * KAN-32 — Context builder: RAG from Supabase rewards DB.
 *
 * Returns a structured RewardsContext that callers format for Claude.
 * Queries by card_id, ordered by card + category for stable output.
 */

import { supabaseAdmin } from '@/lib/supabase'
import type { ClassifiedIntent, CardDetails, EarnRate, TransferPartner, RewardsContext } from '@/types'

export const DATA_NOTICE =
  'Data sourced from CCRO rewards database. Verify current rates at your bank\'s website before acting.'

// ── main export ────────────────────────────────────────────────────────────

export async function buildContext(
  intent: ClassifiedIntent,
  userPortfolio: Array<{
    card_id: string
    card_name: string
    current_points_balance: number
    balance_last_updated: string
  }>,
  options: { tier?: 'basic' | 'pro' | 'max'; userCountry?: string } = {}
): Promise<RewardsContext> {
  const { tier = 'max', userCountry = 'IN' } = options
  const partnerLimit = tier === 'basic' ? 3 : undefined

  const context: RewardsContext = {
    user_portfolio: userPortfolio,
    data_notice: DATA_NOTICE,
  }

  if (!supabaseAdmin) {
    context.tier_note = 'Live card data unavailable.'
    return context
  }

  // Collect ALL card IDs — from intent AND portfolio
  const allCardIds = Array.from(new Set([
    ...intent.cards_mentioned,
    ...userPortfolio.map(c => c.card_id),
  ]))

  console.log('[context-builder] intent:', intent.intent)
  console.log('[context-builder] cardIds:', allCardIds)

  if (allCardIds.length === 0) {
    console.log('[context-builder] no card IDs found')
    return context
  }

  try {
    const [cardDetails, earnRates, partners] = await Promise.all([
      fetchCardDetails(allCardIds),
      fetchEarnRates(allCardIds, userCountry),
      fetchTransferPartners(allCardIds, userCountry, partnerLimit),
    ])

    console.log('[context-builder] card details fetched:', cardDetails.length)
    console.log('[context-builder] earn rates fetched:', earnRates.length)
    console.log('[context-builder] partners fetched:', partners.length)

    context.card_details = cardDetails
    context.earn_rates = earnRates
    context.transfer_partners = partners

    // For multi-card intents, also store under all_cards keys
    if (
      intent.intent === 'multi_card_orchestration' ||
      intent.intent === 'card_comparison'
    ) {
      context.all_cards_earn_rates = earnRates
      context.all_transfer_partners = partners
    }

    // Track missing cards
    const missingCards: string[] = []
    for (const cardId of allCardIds) {
      const hasData =
        earnRates.some(r => r.card_id === cardId) ||
        partners.some(p => p.card_id === cardId)
      if (!hasData) missingCards.push(cardId)
    }
    if (missingCards.length > 0) {
      context.missing_cards = missingCards
      console.log('[context-builder] missing cards:', missingCards)
    }

    // Tier note for Basic users
    if (partnerLimit && partners.length >= partnerLimit) {
      context.tier_note = 'Showing top 3 transfer partners. Upgrade to Pro to see all.'
    }
  } catch (err) {
    console.error('[context-builder] DB error:', err)
    context.tier_note = 'Live card data unavailable. Verify rates with your bank.'
  }

  return context
}

// ── private helpers ────────────────────────────────────────────────────────

async function fetchCardDetails(cardIds: string[]): Promise<CardDetails[]> {
  const { data, error } = await supabaseAdmin!
    .from('card_rewards')
    .select(
      'card_id, card_name, issuer, tier, card_type, card_network, ' +
      'annual_fee_inr, annual_fee_amount, joining_fee_inr, joining_fee_amount, ' +
      'forex_markup_pct, lounge_dom_per_year, lounge_intl_per_year, ' +
      'upi_supported, availability_status, ' +
      'welcome_benefit_desc, renewal_benefit_desc, ' +
      'fee_waiver_threshold, country_code, currency, verified'
    )
    .in('card_id', cardIds)

  if (error) {
    console.error('[context-builder] card_rewards error:', error)
    throw error
  }
  return (data ?? []) as unknown as CardDetails[]
}

async function fetchEarnRates(cardIds: string[], countryCode: string): Promise<EarnRate[]> {
  const { data, error } = await supabaseAdmin!
    .from('earn_rates')
    .select('*')
    .in('card_id', cardIds)
    .eq('country_code', countryCode)
    .eq('availability_status', 'active')
    .is('effective_to', null)
    .order('card_id')
    .order('category')

  if (error) {
    console.error('[context-builder] earn_rates error:', error)
    throw error
  }
  return (data ?? []) as EarnRate[]
}

async function fetchTransferPartners(
  cardIds: string[],
  countryCode: string,
  limit?: number
): Promise<TransferPartner[]> {
  let query = supabaseAdmin!
    .from('transfer_partners')
    .select('*')
    .in('card_id', cardIds)
    .eq('country_code', countryCode)
    .eq('availability_status', 'active')
    .is('effective_to', null)
    .order('card_id')
    .order('partner_tier')
    .order('partner_name')

  if (limit) query = query.limit(limit)

  const { data, error } = await query
  if (error) {
    console.error('[context-builder] transfer_partners error:', error)
    throw error
  }
  return (data ?? []) as TransferPartner[]
}
