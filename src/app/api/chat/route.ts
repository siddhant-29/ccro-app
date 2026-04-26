export const dynamic = 'force-dynamic'

// KAN-56–65: EP7 AI Chat — streaming pipeline

import { cookies } from 'next/headers'
import Anthropic from '@anthropic-ai/sdk'
import { createRouteHandlerClient, supabaseAdmin } from '@/lib/supabase'
import { classifyIntent } from '@/lib/ai/intent-classifier'
import { buildContext } from '@/lib/context-builder'
import { formatRewardsContext } from '@/lib/ai/claude'
import { checkSubscriptionLimit, INTENT_FEATURE_MAP, SUBSCRIPTION_CONFIG } from '@/lib/subscription-config'
import { CC_ADVISOR_SYSTEM_PROMPT } from '@/lib/ai/system-prompt'

let _anthropic: Anthropic | null = null
function getClient(): Anthropic {
  if (!_anthropic) _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  return _anthropic
}

const encoder = new TextEncoder()

function sse(data: object): Uint8Array {
  return encoder.encode(`data: ${JSON.stringify(data)}\n\n`)
}

function sseHeaders() {
  return {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  }
}

function sanitise(input: string): string {
  return input
    .replace(/\0/g, '')
    .replace(/<\/?(?:system|instructions?)[^>]*>/gi, '')
    .trim()
    .slice(0, 2000)
}

const GATE_MESSAGES: Record<string, string> = {
  card_comparison:          'I can answer detailed questions about any one of your registered cards. Which card would you like to explore?',
  category_optimizer:       'I can answer spend questions for your registered cards. Which of your cards are you asking about?',
  multi_card_orchestration: 'I can look at one card at a time on the free plan. Which card would you like to focus on?',
  portfolio_optimiser:      'I can review one card at a time on the free plan. Which card are you considering?',
}

function gateStream(message: string): Response {
  return new Response(
    new ReadableStream({
      start(c) {
        c.enqueue(sse({ type: 'token', content: message }))
        c.enqueue(sse({ type: 'done' }))
        c.close()
      },
    }),
    { headers: sseHeaders() }
  )
}

type RawUserCard = {
  card_id: string
  current_points_balance: number
  balance_last_updated: string
  card_rewards: { card_name: string }[] | { card_name: string } | null
}

export async function POST(req: Request) {
  // 1. Auth
  const supabase = createRouteHandlerClient({ cookies })
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return Response.json(
      { error: { type: 'session_expired', message: 'Please sign in to continue.' } },
      { status: 401 }
    )
  }

  const isFreeForAll = SUBSCRIPTION_CONFIG.FREE_FOR_ALL
  console.log('[api/chat] FREE_FOR_ALL:', isFreeForAll, 'env:', process.env.FREE_FOR_ALL)

  // 2. Parse + validate
  let raw: string
  try {
    const body = await req.json() as { message?: unknown }
    raw = String(body?.message ?? '').trim()
  } catch {
    return Response.json({ error: { type: 'unknown', message: 'Invalid request.' } }, { status: 400 })
  }

  if (!raw) {
    return Response.json({ error: { type: 'unknown', message: 'Message is required.' } }, { status: 400 })
  }

  const sanitised = sanitise(raw)

  // 3. Daily query limit
  const queryCheck = await checkSubscriptionLimit(user.id, 'queries_per_day')
  if (!queryCheck.allowed) {
    return gateStream(queryCheck.reason ?? "You've reached your daily query limit. Upgrade to continue.")
  }

  // 4. Classify intent
  const classified = await classifyIntent(sanitised)

  // 5. Load user cards (needed before gate check to test card ownership)
  const { data: rawCards } = await supabaseAdmin
    .from('user_cards')
    .select('card_id, current_points_balance, balance_last_updated, card_rewards(card_name)')
    .eq('user_id', user.id)

  const userPortfolio = ((rawCards ?? []) as unknown as RawUserCard[]).map(c => ({
    card_id: c.card_id,
    card_name: (
      Array.isArray(c.card_rewards)
        ? c.card_rewards[0]?.card_name
        : (c.card_rewards as { card_name: string } | null)?.card_name
    ) ?? c.card_id,
    current_points_balance: c.current_points_balance,
    balance_last_updated: c.balance_last_updated,
  }))

  // 6. Feature gate — only applies when FREE_FOR_ALL is off,
  //    and only when the user is asking about cards they don't own.
  if (!isFreeForAll) {
    const requiredFeature = INTENT_FEATURE_MAP[classified.intent]
    if (requiredFeature) {
      const mentionedCards = classified.cards_mentioned
      const userCardIds = userPortfolio.map(c => c.card_id)
      const allMentionedAreOwned =
        mentionedCards.length === 0 ||
        mentionedCards.every(id => userCardIds.includes(id))

      if (!allMentionedAreOwned) {
        const featureCheck = await checkSubscriptionLimit(user.id, requiredFeature)
        if (!featureCheck.allowed) {
          const gateMsg =
            GATE_MESSAGES[classified.intent] ??
            featureCheck.reason ??
            'This feature requires a Pro subscription.'
          return gateStream(gateMsg)
        }
      }
    }
  }

  // 7. Build context
  const userCountry = (user.user_metadata?.country_code as string | undefined) ?? 'IN'
  const rewardsContext = await buildContext(classified, userPortfolio, { userCountry })
  const verifiedBlock = formatRewardsContext(rewardsContext)
  const intentHint = classified.intent !== 'general_education'
    ? `[Intent: ${classified.intent}]\n\n`
    : ''
  const userTurn = [verifiedBlock, intentHint, sanitised].filter(Boolean).join('')

  // 8-9. Stream from Claude
  const anthropic = getClient()
  let fullResponse = ''

  const readable = new ReadableStream({
    async start(controller) {
      const abort = new AbortController()
      const timeout = setTimeout(() => abort.abort(), 25000)

      try {
        const stream = anthropic.messages.stream(
          {
            model: 'claude-sonnet-4-6',
            max_tokens: 1500,
            system: CC_ADVISOR_SYSTEM_PROMPT,
            messages: [{ role: 'user', content: userTurn }],
          },
          { signal: abort.signal }
        )

        for await (const event of stream) {
          if (
            event.type === 'content_block_delta' &&
            event.delta.type === 'text_delta'
          ) {
            const token = event.delta.text
            fullResponse += token
            controller.enqueue(sse({ type: 'token', content: token }))
          }
        }

        clearTimeout(timeout)
        controller.enqueue(sse({ type: 'done' }))

        // 10. Fire-and-forget
        void persistTurn(user.id, sanitised, fullResponse, classified.intent)
      } catch (err) {
        clearTimeout(timeout)
        const isTimeout =
          abort.signal.aborted ||
          (err instanceof Error && err.name === 'AbortError')
        controller.enqueue(sse({
          type: 'error',
          error: {
            type: isTimeout ? 'timeout' : 'unknown',
            message: isTimeout
              ? 'The response took too long. Please try again.'
              : 'An error occurred. Please try again.',
          },
        }))
      } finally {
        controller.close()
      }
    },
  })

  return new Response(readable, { headers: sseHeaders() })
}

export async function GET() {
  const supabase = createRouteHandlerClient({ cookies })
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return Response.json({ messages: [] })

  const { data } = await supabaseAdmin
    .from('conversations')
    .select('role, content, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })
    .limit(40)

  type ConvRow = { role: string; content: { text?: string } | string | null; created_at: string }

  const messages = ((data ?? []) as ConvRow[]).map(row => ({
    role: row.role,
    content: typeof row.content === 'string'
      ? row.content
      : (row.content as { text?: string } | null)?.text ?? '',
    created_at: row.created_at,
  }))

  return Response.json({ messages })
}

async function persistTurn(
  userId: string,
  userMessage: string,
  assistantMessage: string,
  intent: string
) {
  try {
    await supabaseAdmin.from('conversations').insert([
      { user_id: userId, role: 'user', content: { text: userMessage }, intent },
      { user_id: userId, role: 'assistant', content: { text: assistantMessage }, intent },
    ])
  } catch {
    // Non-fatal
  }

  try {
    const today = new Date().toISOString().split('T')[0]
    const { data: existing } = await supabaseAdmin
      .from('user_usage')
      .select('queries_count')
      .eq('user_id', userId)
      .eq('date', today)
      .maybeSingle()

    if (existing) {
      await supabaseAdmin
        .from('user_usage')
        .update({ queries_count: (existing as { queries_count: number }).queries_count + 1 })
        .eq('user_id', userId)
        .eq('date', today)
    } else {
      await supabaseAdmin
        .from('user_usage')
        .insert({ user_id: userId, date: today, queries_count: 1 })
    }
  } catch {
    // Non-fatal
  }
}
