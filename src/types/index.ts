// ═══════════════════════════════════════════════════════════
// CCRO — Shared TypeScript Types
// KAN-29: All data shapes defined, no `any` types allowed
// ═══════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────
// Rewards database types
// ─────────────────────────────────────────────────────────

export interface CardReward {
  id: string
  card_id: string
  card_name: string
  issuer: string
  tier: 'premium' | 'super_premium' | 'ultra_premium'
  annual_fee_inr: number | null
  joining_fee_inr: number | null
  affiliate_url: string | null
  is_active: boolean
  last_verified: string
  source_url: string | null
}

export interface EarnRate {
  id: string
  card_id: string
  category: string
  merchant_portal: string | null
  points_per_200: number
  effective_reward_pct: number
  monthly_cap_points: number | null
  annual_cap_points: number | null
  excluded: boolean
  notes: string | null
  effective_from: string
  effective_to: string | null
  verified: boolean
  source_url: string | null
}

export interface TransferPartner {
  id: string
  card_id: string
  partner_name: string
  partner_type: 'airline' | 'hotel'
  partner_program: string | null
  transfer_ratio_from: number  // card points (e.g. 5 EDGE)
  transfer_ratio_to: number    // partner points (e.g. 2 Bonvoy)
  transfer_cap_annual: number | null
  transfer_cap_lifetime: number | null
  partner_tier: string | null  // 'Group A' | 'Group B' (Magnus)
  min_transfer_units: number
  processing_days: number
  effective_from: string
  effective_to: string | null
  verified: boolean
  source_url: string | null
}

// ─────────────────────────────────────────────────────────
// User data types
// ─────────────────────────────────────────────────────────

export interface UserCard {
  id: string
  user_id: string
  card_id: string
  current_points_balance: number
  balance_last_updated: string
  created_at: string
  // Joined from card_rewards
  card_rewards?: Pick<CardReward, 'card_name' | 'issuer' | 'tier' | 'affiliate_url'>
}

export interface UserProfile {
  id: string
  email: string
  preference: 'travel_hotels' | 'flights' | 'cash_value' | 'not_sure' | null
  created_at: string
}

// ─────────────────────────────────────────────────────────
// Conversation types
// ─────────────────────────────────────────────────────────

export interface ConversationTurn {
  id: string
  user_id: string
  role: 'user' | 'assistant'
  content: EncryptedContent | DecryptedContent
  intent: IntentType | null
  created_at: string
}

export interface EncryptedContent {
  iv: string
  data: string
  tag: string
}

export interface DecryptedContent {
  text: string
}

// ─────────────────────────────────────────────────────────
// Intent classification types
// ─────────────────────────────────────────────────────────

export type IntentType =
  | 'redemption_path'
  | 'card_comparison'
  | 'milestone_check'
  | 'category_optimizer'
  | 'multi_card_orchestration'
  | 'devaluation_impact'
  | 'portfolio_optimiser'
  | 'general_education'

export interface ClassifiedIntent {
  intent: IntentType
  cards_mentioned: string[]
  amount_mentioned: number | null
  destination_mentioned: string | null
}

// ─────────────────────────────────────────────────────────
// Devaluation alerts
// ─────────────────────────────────────────────────────────

export type AlertSeverity = 'critical' | 'high' | 'medium' | 'low'
export type AlertStatus = 'pending' | 'confirmed' | 'rejected'
export type AlertChangeType =
  | 'devaluation'
  | 'reward_change'
  | 'partner_announcement'
  | 'program_discontinuation'
  | 'new_benefit'
  | 'fee_change'

export interface ChangeAlert {
  id: string
  card_id: string
  change_type: AlertChangeType
  severity: AlertSeverity
  summary: string
  old_value: Record<string, unknown> | null
  new_value: Record<string, unknown> | null
  effective_date: string | null
  source_url: string | null
  source_type: string | null
  status: AlertStatus
  confirmed_at: string | null
  detected_at: string
  // Joined
  card_rewards?: Pick<CardReward, 'card_name' | 'issuer'>
  // Client-side read state
  is_read?: boolean
}

// ─────────────────────────────────────────────────────────
// Subscription types
// ─────────────────────────────────────────────────────────

export type SubscriptionTier = 'basic' | 'pro' | 'max'
export type SubscriptionStatus = 'active' | 'cancelled' | 'past_due' | 'trialing'

export interface Subscription {
  id: string
  user_id: string
  tier: SubscriptionTier
  status: SubscriptionStatus
  razorpay_subscription_id: string | null
  current_period_start: string | null
  current_period_end: string | null
  cancel_at_period_end: boolean
  trial_end: string | null
  created_at: string
}

export interface SubscriptionUsage {
  queries_today: number
  queries_limit: number  // Infinity for Pro/Max
  cards_count: number
  cards_limit: number    // Infinity for Pro/Max
}

export interface SubscriptionStatusResponse {
  tier: SubscriptionTier
  status: SubscriptionStatus
  is_active: boolean
  current_period_end: string | null
  usage: SubscriptionUsage
}

// ─────────────────────────────────────────────────────────
// API response wrappers
// ─────────────────────────────────────────────────────────

export type ApiSuccess<T> = { data: T; error: null }
export type ApiError = { data: null; error: string; upgrade_required?: boolean; upgrade_url?: string }
export type ApiResponse<T> = ApiSuccess<T> | ApiError

export type PaginatedResponse<T> = {
  items: T[]
  total: number
  cursor: string | null
}

// ─────────────────────────────────────────────────────────
// Chat API types
// ─────────────────────────────────────────────────────────

export type ChatErrorType =
  | 'session_expired'
  | 'rate_limit'
  | 'daily_limit'
  | 'feature_gate'
  | 'timeout'
  | 'db_unavailable'
  | 'unknown'

export interface ChatError {
  type: ChatErrorType
  message: string
  suggestion?: string    // what they CAN do on current tier
  upgrade_url?: string
  retry_after_seconds?: number
}

export interface ChatStreamChunk {
  type: 'token' | 'done' | 'error'
  content?: string
  error?: ChatError
}

// ─────────────────────────────────────────────────────────
// Subscription check result
// ─────────────────────────────────────────────────────────

export interface LimitCheckResult {
  allowed: boolean
  reason?: string
  limit?: number
  upgrade_url?: string
}

// ─────────────────────────────────────────────────────────
// Context builder types (what gets injected into Claude)
// ─────────────────────────────────────────────────────────

export interface CardDetails {
  card_id: string
  card_name: string
  issuer: string | null
  tier: string | null
  card_type: string | null
  card_network: string | null
  annual_fee_inr: number | null
  annual_fee_amount: number | null
  joining_fee_inr: number | null
  joining_fee_amount: number | null
  forex_markup_pct: number | null
  lounge_dom_per_year: number | null
  lounge_intl_per_year: number | null
  upi_supported: boolean
  availability_status: string | null
  welcome_benefit_desc: string | null
  renewal_benefit_desc: string | null
  fee_waiver_threshold: number | null
  country_code: string | null
  currency: string | null
  verified: boolean | null
}

export interface RewardsContext {
  user_portfolio: Array<{
    card_id: string
    card_name: string
    current_points_balance: number
    balance_last_updated: string
  }>
  card_details?: CardDetails[]
  earn_rates?: EarnRate[]
  transfer_partners?: TransferPartner[]
  all_cards_earn_rates?: EarnRate[]        // multi-card orchestration
  all_transfer_partners?: TransferPartner[] // multi-card orchestration
  missing_cards?: string[]                 // cards asked about but not in DB
  tier_note?: string                       // shown to Basic users
  data_notice: string
}
