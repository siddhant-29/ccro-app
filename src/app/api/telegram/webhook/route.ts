/**
 * KAN-29 — Telegram webhook handler: POST /api/telegram/webhook
 * KAN-33 — Full redemption-path pipeline:
 * KAN-52 — Persist conversations + active card tracking
 *
 *   incoming message
 *     → command router (/start, /help, /cards)
 *     → classifyIntent()
 *     → load persistent conversation history
 *     → active card fallback (if no card mentioned)
 *     → load user portfolio from Supabase
 *     → buildContext()   ← RAG from rewards DB (KAN-32)
 *     → askAdvisor()     ← Claude API with verified_data + history + userCardSummary
 *     → split if > 4096 chars → sendChunks()
 *     → saveConversationTurn() + setActiveCard()
 */

import { NextRequest, NextResponse } from 'next/server'
import type { TelegramUpdate } from '@/lib/types'
import { sendTyping, sendChunks, sendMessage } from '@/lib/telegram/bot'
import { handleStart, handleHelp, handleCards } from '@/lib/telegram/commands'
import { classifyIntent } from '@/lib/ai/intent-classifier'
import { buildContext } from '@/lib/db/context-builder'
import { formatRewardsContext, splitForTelegram } from '@/lib/ai/claude'
import { askAdvisor } from '@/lib/cc-advisor'
import { supabaseAdmin } from '@/lib/supabase'

// Human-readable display names for card slugs (covers both bot schema slugs and canonical card_ids)
const CARD_NAMES: Record<string, string> = {
  'axis_magnus': 'Axis Magnus (Axis Bank)',
  'magnus': 'Axis Magnus (Axis Bank)',
  'hdfc_infinia': 'HDFC Infinia (HDFC Bank)',
  'infinia': 'HDFC Infinia (HDFC Bank)',
  'hdfc_diners_black': 'HDFC Diners Club Black (HDFC Bank)',
  'amex_platinum_travel': 'Amex Platinum Travel (American Express)',
  'amex_platinum': 'Amex Platinum Travel (American Express)',
  'amex_gold': 'Amex Gold (American Express)',
  'icici_emeralde': 'ICICI Emeralde Private Metal (ICICI Bank)',
  'axis_reserve': 'Axis Reserve (Axis Bank)',
  'reserve': 'Axis Reserve (Axis Bank)',
  'sbi_elite': 'SBI Card Elite (SBI Card)',
  'elite': 'SBI Card Elite (SBI Card)',
}

// ── Conversation persistence ───────────────────────────────────────────────

async function loadConversationHistory(
  telegramUserId: string
): Promise<Array<{ role: 'user' | 'assistant'; content: string }>> {
  if (!supabaseAdmin) return []
  const { data } = await supabaseAdmin
    .from('telegram_conversations')
    .select('role, content')
    .eq('telegram_user_id', telegramUserId)
    .order('created_at', { ascending: true })
    .limit(20)
  return (data ?? []) as Array<{ role: 'user' | 'assistant'; content: string }>
}

async function saveConversationTurn(
  telegramUserId: string,
  userMessage: string,
  assistantReply: string
): Promise<void> {
  if (!supabaseAdmin) return
  await supabaseAdmin.from('telegram_conversations').insert([
    { telegram_user_id: telegramUserId, role: 'user', content: userMessage },
    { telegram_user_id: telegramUserId, role: 'assistant', content: assistantReply },
  ])
}

// ── Active card tracking ───────────────────────────────────────────────────

async function getActiveCard(telegramUserId: string): Promise<string | null> {
  if (!supabaseAdmin) return null
  const { data } = await supabaseAdmin
    .from('telegram_portfolios')
    .select('active_card_id')
    .eq('telegram_user_id', telegramUserId)
    .not('active_card_id', 'is', null)
    .limit(1)
    .single()
  return data?.active_card_id ?? null
}

async function setActiveCard(
  telegramUserId: string,
  cardId: string
): Promise<void> {
  if (!supabaseAdmin) return
  await supabaseAdmin
    .from('telegram_portfolios')
    .update({ active_card_id: cardId })
    .eq('telegram_user_id', telegramUserId)
    .eq('card_id', cardId)
}

// ── Route handlers ─────────────────────────────────────────────────────────

export async function GET() {
  return NextResponse.json({ ok: true, service: 'ccro-telegram-webhook' })
}

export async function POST(req: NextRequest) {
  let update: TelegramUpdate
  try {
    update = (await req.json()) as TelegramUpdate
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid JSON' }, { status: 400 })
  }

  const message = update.message
  if (!message?.text) return NextResponse.json({ ok: true })

  const chatId = message.chat.id
  const userId = String(message.from.id)
  const text = message.text.trim()

  try {
    // ── Command routing ────────────────────────────────────────────────────

    if (text.startsWith('/start')) {
      await handleStart(chatId)
      return NextResponse.json({ ok: true })
    }
    if (text.startsWith('/help')) {
      await handleHelp(chatId)
      return NextResponse.json({ ok: true })
    }
    if (text.startsWith('/cards')) {
      await handleCards(chatId, userId, text)
      return NextResponse.json({ ok: true })
    }

    // ── Full AI pipeline ───────────────────────────────────────────────────

    void sendTyping(chatId)

    // 1. Classify intent
    const classified = await classifyIntent(text)
    console.log('[webhook] intent:', classified.intent, 'cards:', classified.cards_mentioned)

    // 2. Load persistent conversation history
    const history = await loadConversationHistory(userId)

    // 3. Active card fallback — if no card mentioned, use the last focused card
    if (classified.cards_mentioned.length === 0) {
      const activeCard = await getActiveCard(userId)
      if (activeCard) {
        classified.cards_mentioned = [activeCard]
        console.log('[webhook] using active card:', activeCard)
      }
    }

    // 4. Load user's stored card balances
    const { data: userCardsData } = await supabaseAdmin
      .from('telegram_portfolios')
      .select('card_id, current_points_balance, balance_last_updated')
      .eq('telegram_user_id', userId)

    const userCards = (userCardsData ?? []) as Array<{
      card_id: string
      current_points_balance: number
      balance_last_updated: string
    }>

    const userPortfolio = userCards.map(c => ({
      card_id: c.card_id,
      card_name: CARD_NAMES[c.card_id] ??
        c.card_id.split('_').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
      current_points_balance: c.current_points_balance,
      balance_last_updated: c.balance_last_updated,
    }))

    // Build explicit card ownership summary so Claude always knows which cards the user holds
    const userCardSummary = userCards.length > 0
      ? userCards
          .map(c => {
            const name = CARD_NAMES[c.card_id] ?? c.card_id
            return `• ${name}: ${c.current_points_balance.toLocaleString()} pts`
          })
          .join('\n')
      : ''

    // 5. Build RAG context from Supabase rewards DB
    const context = await buildContext(classified, userPortfolio)
    console.log(
      '[webhook] context built — earn_rates:',
      context.earn_rates?.length ?? 0,
      'partners:',
      context.transfer_partners?.length ?? 0,
      'missing:',
      context.missing_cards ?? []
    )

    // 6. Format context and call Claude (history + card summary always included)
    const formattedContext = formatRewardsContext(context)
    const responseText = await askAdvisor(text, formattedContext, history, userCardSummary)

    // 7. Split at 4096 chars if needed and send
    const chunks = splitForTelegram(responseText)
    await sendChunks(chatId, chunks)

    // 8. Persist this turn and update active card (fire-and-forget, don't block reply)
    void saveConversationTurn(userId, text, responseText)
    if (classified.cards_mentioned.length === 1) {
      void setActiveCard(userId, classified.cards_mentioned[0])
    }
  } catch (err) {
    console.error('[webhook] unhandled error:', err)
    await sendMessage(
      chatId,
      'Sorry, something went wrong on my end. Please try again in a moment.'
    ).catch(() => {})
  }

  return NextResponse.json({ ok: true })
}
