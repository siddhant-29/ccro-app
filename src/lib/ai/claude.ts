/**
 * KAN-30 — Main Claude response generator.
 *
 * Accepts a structured RewardsContext, formats it into a <verified_data>
 * block, and sends to Claude with the CC advisor system prompt.
 * Prompt caching applied to the stable system prompt.
 * Responses > 4096 chars are split at paragraph boundaries.
 */

import Anthropic from '@anthropic-ai/sdk'
import { CC_ADVISOR_SYSTEM_PROMPT } from './system-prompt'
import type { ClassifiedIntent } from '../types'
import type { RewardsContext, CardDetails, EarnRate, TransferPartner } from '@/types'

const TG_LIMIT = 4096

let _client: Anthropic | null = null
function getClient(): Anthropic {
  if (!_client) _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  return _client
}

/**
 * Split a long string into chunks that respect the Telegram 4096-char limit.
 * Splits at paragraph boundaries (double newline) where possible.
 */
export function splitForTelegram(text: string): string[] {
  if (text.length <= TG_LIMIT) return [text]

  const chunks: string[] = []
  let remaining = text

  while (remaining.length > TG_LIMIT) {
    const slice = remaining.slice(0, TG_LIMIT)
    const lastParagraph = slice.lastIndexOf('\n\n')
    const cutAt = lastParagraph > 0 ? lastParagraph + 2 : TG_LIMIT
    chunks.push(remaining.slice(0, cutAt).trimEnd())
    remaining = remaining.slice(cutAt).trimStart()
  }

  if (remaining.length > 0) chunks.push(remaining)
  return chunks
}

/** Format a RewardsContext into a <verified_data> XML block for the prompt. */
export function formatRewardsContext(context: RewardsContext): string {
  const parts: string[] = []

  if (context.user_portfolio.length > 0) {
    const balances = context.user_portfolio
      .map(c =>
        `  ${c.card_name} (${c.card_id}): ${c.current_points_balance.toLocaleString()} pts` +
        ` [updated ${c.balance_last_updated.split('T')[0]}]`
      )
      .join('\n')
    parts.push(`USER PORTFOLIO:\n${balances}`)
  }

  if (context.card_details && context.card_details.length > 0) {
    const details = context.card_details
      .map((d: CardDetails) => {
        const lounge = (n: number | null, label: string) => {
          if (n == null) return null
          return `${label}: ${n >= 9999 ? 'Unlimited' : `${n}/yr`}`
        }
        const lines: string[] = [
          `  ${d.card_id.toUpperCase()} — ${d.card_name}`,
        ]
        const attrs: string[] = []
        if (d.card_type)           attrs.push(`card type: ${d.card_type}`)
        if (d.card_network)        attrs.push(`network: ${d.card_network}`)
        if (d.availability_status) attrs.push(`status: ${d.availability_status}`)
        if (attrs.length) lines.push(`    ${attrs.join(' | ')}`)

        const perks: (string | null)[] = [
          d.forex_markup_pct != null ? `Forex markup: ${d.forex_markup_pct}%` : null,
          lounge(d.lounge_dom_per_year,  'Domestic lounge'),
          lounge(d.lounge_intl_per_year, 'Intl lounge'),
          `UPI: ${d.upi_supported ? 'Yes' : 'No'}`,
        ]
        const perkLine = perks.filter(Boolean).join(' | ')
        if (perkLine) lines.push(`    ${perkLine}`)

        if (d.welcome_benefit_desc) lines.push(`    Welcome benefit: ${d.welcome_benefit_desc}`)
        if (d.renewal_benefit_desc) lines.push(`    Renewal benefit: ${d.renewal_benefit_desc}`)

        const fees: string[] = []
        if (d.annual_fee_amount != null) fees.push(`Annual fee: ₹${d.annual_fee_amount.toLocaleString()}`)
        if (d.joining_fee_amount != null) fees.push(`Joining fee: ₹${d.joining_fee_amount.toLocaleString()}`)
        if (d.fee_waiver_threshold != null) fees.push(`Fee waiver at: ₹${d.fee_waiver_threshold.toLocaleString()} spend`)
        if (fees.length) lines.push(`    ${fees.join(' | ')}`)

        return lines.join('\n')
      })
      .join('\n')
    parts.push(`CARD DETAILS:\n${details}`)
  }

  if (context.earn_rates && context.earn_rates.length > 0) {
    const rates = context.earn_rates
      .map((r: EarnRate) =>
        `  ${r.card_id.toUpperCase()} | ${r.category}: ${r.points_per_200} pts per ₹200` +
        (r.effective_reward_pct ? ` (${r.effective_reward_pct}% reward)` : '') +
        (r.monthly_cap_points ? ` | monthly cap: ${r.monthly_cap_points}` : '') +
        (r.excluded ? ' [EXCLUDED]' : '') +
        (r.notes ? ` | ${r.notes}` : '')
      )
      .join('\n')
    parts.push(`EARN RATES:\n${rates}`)
  }

  if (context.transfer_partners && context.transfer_partners.length > 0) {
    const partners = context.transfer_partners
      .map((p: TransferPartner) =>
        `  ${p.card_id.toUpperCase()} → ${p.partner_name} [${p.partner_type}]` +
        `: ${p.transfer_ratio_from} pts = ${p.transfer_ratio_to} pts` +
        (p.transfer_cap_annual ? ` | annual cap: ${p.transfer_cap_annual}` : '') +
        (p.partner_tier ? ` | ${p.partner_tier}` : '') +
        (p.processing_days ? ` | ${p.processing_days}d processing` : '')
      )
      .join('\n')
    parts.push(`TRANSFER PARTNERS:\n${partners}`)
  }

  if (context.missing_cards && context.missing_cards.length > 0) {
    parts.push(
      `NO DATA FOR: ${context.missing_cards.join(', ')} — answer from training data only for these cards.`
    )
  }

  if (context.tier_note) {
    parts.push(`NOTE: ${context.tier_note}`)
  }

  if (parts.length === 0) return ''

  return `<verified_data>\n${parts.join('\n\n')}\n</verified_data>\n\n`
}

export async function generateResponse(
  userMessage: string,
  classified: ClassifiedIntent,
  context: RewardsContext
): Promise<string[]> {
  const client = getClient()

  const verifiedBlock = formatRewardsContext(context)
  const intentHint =
    classified.intent !== 'general_education'
      ? `[Intent: ${classified.intent}]\n\n`
      : ''

  const userTurn = [verifiedBlock, intentHint, userMessage].filter(Boolean).join('')

  const response = await client.beta.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1500,
    betas: ['prompt-caching-2024-07-31'],
    system: [
      {
        type: 'text',
        text: CC_ADVISOR_SYSTEM_PROMPT,
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [{ role: 'user', content: userTurn }],
  })

  const text =
    response.content[0]?.type === 'text'
      ? response.content[0].text.trim()
      : "Sorry, I couldn't generate a response. Please try again."

  return splitForTelegram(text)
}
