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

export { splitForTelegram }

export interface AdvisorResponse {
  chunks: string[]       // split for Telegram 4096-char limit
  intent: string
  dbAvailable: boolean
}

/**
 * Run the full CC advisor pipeline for a given Telegram user message.
 *
 * @param userMessage  Raw text from the user
 * @param telegramUserId  String telegram user ID (used to load saved card balances)
 */
export async function runAdvisor(
  userMessage: string,
  telegramUserId: string
): Promise<AdvisorResponse> {
  // 1. Classify intent + extract entities
  const classified = await classifyIntent(userMessage)

  // 2. Load user's stored card balances from Supabase
  const { data } = await supabaseAdmin
    .from('user_cards')
    .select('*')
    .eq('telegram_user_id', telegramUserId)

  const userCards = (data ?? []) as UserCard[]

  // 3. RAG: pull verified data from rewards DB
  const { contextBlock, dbAvailable } = await buildContext(classified, userCards)

  // 4. Generate Claude response
  const chunks = await generateResponse(userMessage, classified, contextBlock, userCards)

  return { chunks, intent: classified.intent, dbAvailable }
}
