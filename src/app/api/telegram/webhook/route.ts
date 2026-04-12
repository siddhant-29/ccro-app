/**
 * KAN-29 — Telegram webhook handler: POST /api/telegram/webhook
 * KAN-33 — Full redemption-path pipeline wired end-to-end:
 *
 *   incoming message
 *     → command router (/start, /help, /cards)
 *     → send typing indicator
 *     → classifyIntent()
 *     → fetch user cards from Supabase
 *     → buildContext()   ← RAG from rewards DB (KAN-32)
 *     → generateResponse() ← Claude API (KAN-30)
 *     → split if > 4 096 chars (KAN-30)
 *     → sendChunks()
 */

import { NextRequest, NextResponse } from 'next/server';
import type { TelegramUpdate } from '@/lib/types';
import { sendTyping, sendChunks, sendMessage } from '@/lib/telegram/bot';
import { handleStart, handleHelp, handleCards } from '@/lib/telegram/commands';
import { classifyIntent } from '@/lib/ai/intent-classifier';
import { buildContext } from '@/lib/db/context-builder';
import { generateResponse } from '@/lib/ai/claude';
import { supabase } from '@/lib/db/supabase';
import type { UserCard } from '@/lib/types';

// Telegram sends POST updates; GET is used for health checks.
export async function GET() {
  return NextResponse.json({ ok: true, service: 'ccro-telegram-webhook' });
}

export async function POST(req: NextRequest) {
  // Parse update
  let update: TelegramUpdate;
  try {
    update = (await req.json()) as TelegramUpdate;
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid JSON' }, { status: 400 });
  }

  const message = update.message;

  // Ignore updates without a message or text (e.g. stickers, joins)
  if (!message?.text) {
    return NextResponse.json({ ok: true });
  }

  const chatId = message.chat.id;
  const userId = String(message.from.id);
  const text = message.text.trim();

  try {
    // ── Command routing ──────────────────────────────────────────────────

    if (text.startsWith('/start')) {
      await handleStart(chatId);
      return NextResponse.json({ ok: true });
    }

    if (text.startsWith('/help')) {
      await handleHelp(chatId);
      return NextResponse.json({ ok: true });
    }

    if (text.startsWith('/cards')) {
      await handleCards(chatId, userId, text);
      return NextResponse.json({ ok: true });
    }

    // ── Full AI pipeline ─────────────────────────────────────────────────

    // 1. Show typing indicator immediately (fire-and-forget is fine here)
    void sendTyping(chatId);

    // 2. Classify intent
    const classified = await classifyIntent(text);

    // 3. Load user's stored card balances
    const { data: userCardsData } = await supabase
      .from('user_cards')
      .select('*')
      .eq('telegram_user_id', userId);
    const userCards = (userCardsData ?? []) as UserCard[];

    // 4. Build RAG context from Supabase rewards DB
    const { contextBlock } = await buildContext(classified, userCards);

    // 5. Generate Claude response
    const chunks = await generateResponse(text, classified, contextBlock, userCards);

    // 6. Send response (split across messages if needed)
    await sendChunks(chatId, chunks);
  } catch (err) {
    console.error('[webhook] unhandled error:', err);
    // Best-effort error message to the user — never let the webhook return a 500
    // because Telegram would retry indefinitely.
    await sendMessage(
      chatId,
      "Sorry, something went wrong on my end. Please try again in a moment."
    ).catch(() => {});
  }

  // Always return 200 to Telegram to acknowledge the update.
  return NextResponse.json({ ok: true });
}
