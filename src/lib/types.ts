// ── Intent classifier types ────────────────────────────────────────────────

export type Intent =
  | 'redemption_path'
  | 'card_comparison'
  | 'milestone_check'
  | 'category_optimizer'
  | 'multi_card_orchestration'
  | 'devaluation_impact'
  | 'general_education';

export interface ClassifiedIntent {
  intent: Intent;
  cards_mentioned: string[]; // normalised slugs e.g. ["magnus", "infinia"]
  amount_mentioned: number | null;
  destination_mentioned: string | null;
}

// ── Supabase row shapes ────────────────────────────────────────────────────

export interface EarnRate {
  id: number;
  card_slug: string;
  category: string;
  rate: number;
  unit: string; // e.g. "pts per ₹100" or "miles per ₹100"
  notes: string | null;
  verified: boolean;
}

export interface TransferPartner {
  id: number;
  card_slug: string;
  partner_program: string;
  partner_type: string; // "airline" | "hotel" | "other"
  ratio_from: number;
  ratio_to: number;
  min_transfer: number | null;
  notes: string | null;
  verified: boolean;
}

export interface UserCard {
  id: number;
  telegram_user_id: string;
  card_slug: string;
  points_balance: number;
  updated_at: string;
}

// ── Telegram update types (minimal — only what we use) ────────────────────

export interface TelegramUser {
  id: number;
  username?: string;
  first_name?: string;
}

export interface TelegramMessage {
  message_id: number;
  from: TelegramUser;
  chat: { id: number };
  text?: string;
}

export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
}
