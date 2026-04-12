/**
 * CC Advisor — top-level orchestrator.
 *
 * Ties together intent classification, context building, and response
 * generation into a single call for use from route handlers.
 */

import { classifyIntent } from './ai/intent-classifier'
import { buildContext } from './db/context-builder'
import { generateResponse, splitForTelegram } from './ai/claude'
import { supabaseAdmin } from './supabase'
import type { UserCard } from './types'

// Re-export so callers can import the prompt without reaching into ai/
export { CC_ADVISOR_SYSTEM_PROMPT } from './ai/system-prompt'
export { splitForTelegram }

export interface AdvisorResponse {
  chunks: string[]
  intent: string
  dbAvailable: boolean
}

/** Map the bot's UserCard row to the portfolio shape buildContext expects. */
function toPortfolioEntry(c: UserCard) {
  return {
    card_id: c.card_slug,
    card_name: c.card_slug
      .split('_')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' '),
    current_points_balance: c.points_balance,
    balance_last_updated: c.updated_at,
  }
}

/**
 * Run the full CC advisor pipeline for a given Telegram user message.
 */
export async function runAdvisor(
  userMessage: string,
  telegramUserId: string
): Promise<AdvisorResponse> {
  // 1. Classify intent
  const classified = await classifyIntent(userMessage)

  // 2. Load user's stored card balances
  const { data } = await supabaseAdmin
    .from('user_cards')
    .select('*')
    .eq('telegram_user_id', telegramUserId)

  const userCards = (data ?? []) as UserCard[]
  const userPortfolio = userCards.map(toPortfolioEntry)

  // 3. RAG: pull verified data from rewards DB
  const context = await buildContext(classified, userPortfolio)
  const dbAvailable = !context.tier_note?.includes('unavailable')

  // 4. Generate Claude response
  const chunks = await generateResponse(userMessage, classified, context)

  return { chunks, intent: classified.intent, dbAvailable }
}
