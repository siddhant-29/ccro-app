/**
 * KAN-29 — Telegram webhook handler: POST /api/telegram/webhook
 * KAN-33 — Full redemption-path pipeline:
 *
 *   incoming message
 *     → command router (/start, /help, /cards)
 *     → classifyIntent()
 *     → load user portfolio from Supabase
 *     → buildContext()   ← RAG from rewards DB (KAN-32)
 *     → askAdvisor()     ← Claude API with verified_data + userCardSummary
 *     → split if > 4096 chars → sendChunks()
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

    // 2. Load user's stored card balances
    const { data: userCardsData } = await supabaseAdmin
      .from('user_cards')
      .select('*')
      .eq('telegram_user_id', userId)

    const userCards = (userCardsData ?? []) as Array<{
      card_slug: string
      points_balance: number
      updated_at: string
    }>

    const userPortfolio = userCards.map(c => ({
      card_id: c.card_slug,
      card_name: CARD_NAMES[c.card_slug] ??
        c.card_slug.split('_').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
      current_points_balance: c.points_balance,
      balance_last_updated: c.updated_at,
    }))

    // Build explicit card ownership summary so Claude always knows which cards the user holds
    const userCardSummary = userCards.length > 0
      ? userCards
          .map(c => {
            const name = CARD_NAMES[c.card_slug] ?? c.card_slug
            return `• ${name}: ${c.points_balance.toLocaleString()} pts`
          })
          .join('\n')
      : ''

    // 3. Build RAG context from Supabase rewards DB
    const context = await buildContext(classified, userPortfolio)
    console.log(
      '[webhook] context built — earn_rates:',
      context.earn_rates?.length ?? 0,
      'partners:',
      context.transfer_partners?.length ?? 0,
      'missing:',
      context.missing_cards ?? []
    )

    // 4. Format context and call Claude (card summary always prepended)
    const formattedContext = formatRewardsContext(context)
    const responseText = await askAdvisor(text, formattedContext, [], userCardSummary)

    // 5. Split at 4096 chars if needed and send
    const chunks = splitForTelegram(responseText)
    await sendChunks(chatId, chunks)
  } catch (err) {
    console.error('[webhook] unhandled error:', err)
    await sendMessage(
      chatId,
      'Sorry, something went wrong on my end. Please try again in a moment.'
    ).catch(() => {})
  }

  return NextResponse.json({ ok: true })
}
