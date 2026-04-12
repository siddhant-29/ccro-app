/**
 * KAN-29 — Telegram webhook handler: POST /api/telegram/webhook
 * KAN-33 — Full redemption-path pipeline:
 *
 *   incoming message
 *     → command router (/start, /help, /cards)
 *     → classifyIntent()
 *     → load user portfolio from Supabase
 *     → buildContext()   ← RAG from rewards DB (KAN-32)
 *     → generateResponse() ← Claude API with verified_data block (KAN-30)
 *     → split if > 4096 chars → sendChunks()
 */

import { NextRequest, NextResponse } from 'next/server'
import type { TelegramUpdate } from '@/lib/types'
import { sendTyping, sendChunks, sendMessage } from '@/lib/telegram/bot'
import { handleStart, handleHelp, handleCards } from '@/lib/telegram/commands'
import { classifyIntent } from '@/lib/ai/intent-classifier'
import { buildContext } from '@/lib/db/context-builder'
import { generateResponse } from '@/lib/ai/claude'
import { supabase } from '@/lib/db/supabase'
import type { UserCard } from '@/lib/types'

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

    // 2. Load user's stored card balances and map to portfolio shape
    const { data: userCardsData } = await supabase
      .from('user_cards')
      .select('*')
      .eq('telegram_user_id', userId)

    const userCards = (userCardsData ?? []) as UserCard[]
    const userPortfolio = userCards.map(c => ({
      card_id: c.card_slug,
      card_name: c.card_slug
        .split('_')
        .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' '),
      current_points_balance: c.points_balance,
      balance_last_updated: c.updated_at,
    }))

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

    // 4. Generate Claude response (context formatted as <verified_data> block)
    const chunks = await generateResponse(text, classified, context)

    // 5. Send (split at 4096 chars if needed)
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
