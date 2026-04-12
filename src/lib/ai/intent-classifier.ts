/**
 * KAN-31 — Intent classifier with JSON fallback handling (EC-014).
 *
 * Classifies user messages into one of 7 intents and extracts entities.
 * Uses Claude with a strict JSON-output prompt. If the model returns
 * malformed JSON or an unexpected intent, falls back gracefully to
 * { intent: 'general_education', ... }.
 */

import Anthropic from '@anthropic-ai/sdk';
import type { ClassifiedIntent, Intent } from '../types';

const VALID_INTENTS: Intent[] = [
  'redemption_path',
  'card_comparison',
  'milestone_check',
  'category_optimizer',
  'multi_card_orchestration',
  'devaluation_impact',
  'general_education',
];

const FALLBACK: ClassifiedIntent = {
  intent: 'general_education',
  cards_mentioned: [],
  amount_mentioned: null,
  destination_mentioned: null,
};

// Singleton to reuse connections
let _client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!_client) _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return _client;
}

const CLASSIFIER_SYSTEM = `You are an intent classifier for a credit card rewards chatbot.

Respond ONLY with a single valid JSON object — no markdown, no explanation, no extra text.

Schema:
{
  "intent": "<one of the INTENT values below>",
  "cards_mentioned": ["<lowercase slug>"],
  "amount_mentioned": <number or null>,
  "destination_mentioned": "<string or null>"
}

INTENT values and when to use them:
• redemption_path      — user wants to know the best way to redeem points for a specific goal
• card_comparison      — user is comparing two or more cards
• milestone_check      — user asks whether they have enough points for a specific target
• category_optimizer   — user wants to know which card earns most in a category
• multi_card_orchestration — user wants to combine points across multiple cards
• devaluation_impact   — user asks about a recent or upcoming programme change
• general_education    — anything else (concepts, how-to, general questions)

CARD SLUG MAPPINGS (normalise to these exact strings):
• magnus / hdfc magnus / magnus metal → "magnus"
• infinia / hdfc infinia               → "infinia"
• amex platinum / platinum             → "amex_platinum"
• amex gold / gold                     → "amex_gold"
• axis reserve / reserve               → "axis_reserve"
• sbi elite / elite                    → "sbi_elite"

If you cannot parse the intent with confidence, use "general_education".`.trim();

export async function classifyIntent(userMessage: string): Promise<ClassifiedIntent> {
  const client = getClient();

  try {
    // Use prompt caching on the stable classifier system prompt.
    const response = await client.beta.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 256,
      betas: ['prompt-caching-2024-07-31'],
      system: [
        {
          type: 'text',
          text: CLASSIFIER_SYSTEM,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [{ role: 'user', content: userMessage }],
    });

    const raw = response.content[0]?.type === 'text' ? response.content[0].text.trim() : '';

    // Strip markdown code fences if the model wrapped the JSON anyway
    const jsonStr = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();

    const parsed = JSON.parse(jsonStr) as Partial<ClassifiedIntent>;

    // Validate intent
    const intent: Intent = VALID_INTENTS.includes(parsed.intent as Intent)
      ? (parsed.intent as Intent)
      : 'general_education';

    return {
      intent,
      cards_mentioned: Array.isArray(parsed.cards_mentioned) ? parsed.cards_mentioned : [],
      amount_mentioned:
        typeof parsed.amount_mentioned === 'number' ? parsed.amount_mentioned : null,
      destination_mentioned:
        typeof parsed.destination_mentioned === 'string' ? parsed.destination_mentioned : null,
    };
  } catch {
    // EC-014: malformed JSON or API error — fall back gracefully
    return { ...FALLBACK };
  }
}
