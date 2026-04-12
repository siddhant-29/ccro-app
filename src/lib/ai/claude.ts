/**
 * KAN-30 — Main Claude response generator.
 *
 * Takes the user's raw message, the classified intent, the RAG context block
 * from the context builder, and the user's stored card balances, then returns
 * a complete answer string.
 *
 * Prompt caching is applied to the stable system prompt (cache_control: ephemeral).
 * Responses > 4 096 chars are split into chunks at the nearest paragraph break.
 */

import Anthropic from '@anthropic-ai/sdk';
import { SYSTEM_PROMPT } from './system-prompt';
import type { ClassifiedIntent, UserCard } from '../types';

// Telegram's hard message length limit
const TG_LIMIT = 4096;

let _client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!_client) _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return _client;
}

/**
 * Split a long string into chunks that respect the Telegram 4 096-char limit.
 * Splits at paragraph boundaries (double newline) where possible.
 */
export function splitForTelegram(text: string): string[] {
  if (text.length <= TG_LIMIT) return [text];

  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > TG_LIMIT) {
    // Try to split at the last paragraph break before the limit
    const slice = remaining.slice(0, TG_LIMIT);
    const lastParagraph = slice.lastIndexOf('\n\n');
    const cutAt = lastParagraph > 0 ? lastParagraph + 2 : TG_LIMIT;

    chunks.push(remaining.slice(0, cutAt).trimEnd());
    remaining = remaining.slice(cutAt).trimStart();
  }

  if (remaining.length > 0) chunks.push(remaining);
  return chunks;
}

/** Assembles the full user-turn content, prepending context + card balances. */
function buildUserTurn(
  userMessage: string,
  contextBlock: string,
  userCards: UserCard[]
): string {
  const parts: string[] = [];

  if (contextBlock) parts.push(contextBlock);

  if (userCards.length > 0) {
    const balances = userCards
      .map((c) => `${c.card_slug.toUpperCase()}: ${c.points_balance.toLocaleString()} pts`)
      .join(', ');
    parts.push(`My card balances: ${balances}`);
  }

  parts.push(userMessage);
  return parts.join('\n\n');
}

export async function generateResponse(
  userMessage: string,
  classified: ClassifiedIntent,
  contextBlock: string,
  userCards: UserCard[]
): Promise<string[]> {
  const client = getClient();

  const userTurn = buildUserTurn(userMessage, contextBlock, userCards);

  // Add intent hint as a brief internal note so Claude can weight its answer correctly
  const intentHint =
    classified.intent !== 'general_education'
      ? `[Intent detected: ${classified.intent}]\n\n`
      : '';

  const response = await client.beta.promptCaching.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1500,
    system: [
      {
        type: 'text',
        text: SYSTEM_PROMPT,
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [
      {
        role: 'user',
        content: intentHint + userTurn,
      },
    ],
  });

  const text =
    response.content[0]?.type === 'text'
      ? response.content[0].text.trim()
      : "Sorry, I couldn't generate a response. Please try again.";

  return splitForTelegram(text);
}
