/**
 * KAN-29 — /start and /help command handlers.
 * KAN-34 — /cards command: register card portfolio in Supabase.
 */

import { sendMessage } from './bot';
import { supabase } from '../db/supabase';

// ── /start ────────────────────────────────────────────────────────────────

export async function handleStart(chatId: number): Promise<void> {
  await sendMessage(
    chatId,
    "Hi! I'm your CC rewards advisor. Ask me anything about your Magnus, Infinia, or Amex points."
  );
}

// ── /help ─────────────────────────────────────────────────────────────────

export async function handleHelp(chatId: number): Promise<void> {
  const text = [
    '*CC Rewards Advisor — supported queries:*',
    '',
    '🔁 *Redemption path* — "Best way to use 45K Magnus points for Bangkok?"',
    '⚖️ *Card comparison* — "Magnus vs Infinia for international travel"',
    '🎯 *Milestone check* — "Do I have enough Infinia points for a Maldives flight?"',
    '🛒 *Category optimizer* — "Which card earns most on dining?"',
    '🃏 *Multi-card strategy* — "Combine Magnus + Amex for a business class upgrade"',
    '📉 *Devaluation impact* — "How does the Bonvoy devaluation affect my Magnus points?"',
    '📚 *General education* — "What is a transfer partner?"',
    '',
    "Use */cards Magnus 45000 Infinia 12000* to save your current balances so I can give personalised advice.",
  ].join('\n');

  await sendMessage(chatId, text);
}

// ── /cards ────────────────────────────────────────────────────────────────

/**
 * KAN-34: Parse "/cards Magnus 45000 Infinia 12000", upsert into Supabase
 * user_cards, and confirm with the user.
 *
 * Format: /cards <CardName> <balance> [<CardName> <balance> ...]
 * Card name matching is case-insensitive.
 */

const CARD_SLUG_MAP: Record<string, string> = {
  magnus: 'axis_magnus',
  'hdfc magnus': 'axis_magnus',
  'axis magnus': 'axis_magnus',
  infinia: 'hdfc_infinia',
  'hdfc infinia': 'hdfc_infinia',
  diners: 'hdfc_diners_black',
  'diners black': 'hdfc_diners_black',
  dcb: 'hdfc_diners_black',
  'amex platinum': 'amex_platinum_travel',
  platinum: 'amex_platinum_travel',
  amex: 'amex_platinum_travel',
  'amex gold': 'amex_gold',
  gold: 'amex_gold',
  emeralde: 'icici_emeralde',
  'icici emeralde': 'icici_emeralde',
  'axis reserve': 'axis_reserve',
  reserve: 'axis_reserve',
  'sbi elite': 'sbi_elite',
  elite: 'sbi_elite',
};

function normaliseCardSlug(name: string): string | null {
  return CARD_SLUG_MAP[name.toLowerCase()] ?? null;
}

interface ParsedCard {
  slug: string;
  balance: number;
}

function parseCardsCommand(text: string): ParsedCard[] {
  // Strip the command prefix
  const body = text.replace(/^\/cards\s*/i, '').trim();
  const tokens = body.split(/\s+/);

  const cards: ParsedCard[] = [];
  let i = 0;

  while (i < tokens.length) {
    const token = tokens[i];
    const numericValue = parseInt(tokens[i + 1] ?? '', 10);

    if (!isNaN(numericValue)) {
      // Try single-word card name
      const slug = normaliseCardSlug(token);
      if (slug) {
        cards.push({ slug, balance: numericValue });
        i += 2;
        continue;
      }

      // Try two-word card name (e.g. "Amex Platinum 50000")
      if (i + 2 < tokens.length) {
        const twoWord = `${tokens[i]} ${tokens[i + 1]}`;
        const twoWordNum = parseInt(tokens[i + 2], 10);
        if (!isNaN(twoWordNum)) {
          const twoSlug = normaliseCardSlug(twoWord);
          if (twoSlug) {
            cards.push({ slug: twoSlug, balance: twoWordNum });
            i += 3;
            continue;
          }
        }
      }
    }

    i++;
  }

  return cards;
}

export async function handleCards(
  chatId: number,
  telegramUserId: string,
  text: string
): Promise<void> {
  const cards = parseCardsCommand(text);

  if (cards.length === 0) {
    await sendMessage(
      chatId,
      'Usage: */cards Magnus 45000 Infinia 12000*\n\nList each card name followed by your current points balance.'
    );
    return;
  }

  // Upsert all cards for this user
  const rows = cards.map((c) => ({
    telegram_user_id: telegramUserId,
    card_id: c.slug,
    current_points_balance: c.balance,
    balance_last_updated: new Date().toISOString(),
  }));

  const { error } = await supabase
    .from('telegram_portfolios')
    .upsert(rows, { onConflict: 'telegram_user_id,card_id' });

  if (error) {
    console.error('[handleCards] Supabase upsert error:', error);
    await sendMessage(chatId, "Sorry, I couldn't save your cards right now. Please try again.");
    return;
  }

  const summary = cards
    .map((c) => `${c.slug.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}: ${c.balance.toLocaleString()} pts`)
    .join(' · ');

  await sendMessage(chatId, `Got it! ${summary}. Now ask me anything!`);
}
