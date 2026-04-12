/**
 * KAN-32 — Context builder: RAG from Supabase rewards DB.
 *
 * Pulls earn_rates and transfer_partners relevant to the classified intent
 * and cards mentioned, formats them as a structured string to inject into
 * the Claude prompt as verified ground-truth data.
 *
 * Error contract (EC-005 / EC-015):
 *   - DB unreachable → returns { context: DB_FALLBACK_DISCLAIMER, dbAvailable: false }
 *   - Card not in DB  → included as an explicit gap note in the context string
 */

import { supabase } from './supabase';
import type { ClassifiedIntent, EarnRate, TransferPartner, UserCard } from '../types';

const DB_FALLBACK_DISCLAIMER =
  '⚠️ *Note: our live rewards database is temporarily unavailable. ' +
  'The answer below is based on Claude\'s training data only — ' +
  'please verify numbers on your card issuer\'s site before acting.*\n\n';

export interface BuiltContext {
  contextBlock: string; // injected verbatim into the Claude prompt
  dbAvailable: boolean;
}

// ── helpers ────────────────────────────────────────────────────────────────

function formatEarnRates(rows: EarnRate[]): string {
  if (rows.length === 0) return '';
  const lines = rows.map(
    (r) =>
      `  • ${r.card_slug.toUpperCase()} — ${r.category}: ${r.rate} ${r.unit}${r.notes ? ` (${r.notes})` : ''}`
  );
  return `EARN RATES (verified):\n${lines.join('\n')}`;
}

function formatTransferPartners(rows: TransferPartner[]): string {
  if (rows.length === 0) return '';
  const lines = rows.map(
    (r) =>
      `  • ${r.card_slug.toUpperCase()} → ${r.partner_program} [${r.partner_type}]: ` +
      `${r.ratio_from} pts = ${r.ratio_to} pts` +
      (r.min_transfer ? ` | min transfer: ${r.min_transfer}` : '') +
      (r.notes ? ` | ${r.notes}` : '')
  );
  return `TRANSFER PARTNERS (verified):\n${lines.join('\n')}`;
}

function formatUserCards(cards: UserCard[]): string {
  if (cards.length === 0) return '';
  const lines = cards.map(
    (c) => `  • ${c.card_slug.toUpperCase()}: ${c.points_balance.toLocaleString()} pts`
  );
  return `USER'S DECLARED CARD BALANCES:\n${lines.join('\n')}`;
}

// ── main export ───────────────────────────────────────────────────────────

export async function buildContext(
  classified: ClassifiedIntent,
  userCards: UserCard[]
): Promise<BuiltContext> {
  // If DB is unavailable, return minimal context so Claude can
  // still answer from training data with a disclaimer
  if (!supabase) {
    return {
      contextBlock:
        '⚠️ Live card data unavailable right now. This answer is based on general knowledge — verify rates with your bank before acting.\n\n',
      dbAvailable: false,
    }
  }

  const slugs = classified.cards_mentioned;

  // Attempt DB fetch; if anything throws we fall back gracefully (EC-005).
  try {
    const [earnRatesResult, transferPartnersResult] = await Promise.all([
      slugs.length > 0
        ? supabase.from('earn_rates').select('*').in('card_slug', slugs)
        : Promise.resolve({ data: [], error: null }),
      supabase
        .from('transfer_partners')
        .select('*')
        .in('card_slug', slugs.length > 0 ? slugs : ['__none__']),
    ]);

    if (earnRatesResult.error || transferPartnersResult.error) {
      throw earnRatesResult.error ?? transferPartnersResult.error;
    }

    const earnRates = (earnRatesResult.data ?? []) as EarnRate[];
    const transferPartners = (transferPartnersResult.data ?? []) as TransferPartner[];

    // EC-015: note cards that were mentioned but not found in the DB
    const foundCardSlugs = new Set([
      ...earnRates.map((r) => r.card_slug),
      ...transferPartners.map((r) => r.card_slug),
    ]);
    const missingCards = slugs.filter((s) => !foundCardSlugs.has(s));
    const missingNote =
      missingCards.length > 0
        ? `\nNOTE: The following card(s) were not found in our database and will rely on training data only: ${missingCards.map((s) => s.toUpperCase()).join(', ')}.`
        : '';

    const sections = [
      formatUserCards(userCards),
      formatEarnRates(earnRates),
      formatTransferPartners(transferPartners),
      missingNote,
    ]
      .filter(Boolean)
      .join('\n\n');

    const contextBlock =
      sections.length > 0
        ? `--- VERIFIED DATA FROM REWARDS DATABASE ---\n${sections}\n--- END VERIFIED DATA ---\n\n`
        : '';

    return { contextBlock, dbAvailable: true };
  } catch {
    return { contextBlock: DB_FALLBACK_DISCLAIMER, dbAvailable: false };
  }
}
