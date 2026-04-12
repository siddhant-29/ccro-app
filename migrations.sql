-- ═══════════════════════════════════════════════════════════
-- CCRO — Complete Database Schema
-- Run this entire file in Supabase → SQL Editor → Run
-- KAN-15: DB schema migrations
-- ═══════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────
-- TABLE 1: card_rewards
-- Master list of all premium credit cards we track
-- ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS card_rewards (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id         TEXT NOT NULL UNIQUE,        -- e.g. 'axis_magnus'
  card_name       TEXT NOT NULL,               -- e.g. 'Axis Magnus'
  issuer          TEXT NOT NULL,               -- e.g. 'Axis Bank'
  tier            TEXT NOT NULL,               -- 'premium' | 'super_premium' | 'ultra_premium'
  annual_fee_inr  INTEGER,
  joining_fee_inr INTEGER,
  affiliate_url   TEXT,                        -- card application link
  is_active       BOOLEAN DEFAULT true,
  last_verified   TIMESTAMPTZ DEFAULT now(),
  source_url      TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- ─────────────────────────────────────────────────────────
-- TABLE 2: earn_rates
-- Per-category earn rates per card (versioned — old rates kept)
-- ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS earn_rates (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id               TEXT NOT NULL REFERENCES card_rewards(card_id),
  category              TEXT NOT NULL,          -- 'dining', 'travel', 'insurance', 'fuel' etc.
  merchant_portal       TEXT,                   -- 'smartbuy', 'grabdeals', 'ishop' etc.
  points_per_200        DECIMAL(10, 4),         -- points earned per ₹200 spent
  effective_reward_pct  DECIMAL(6, 4),          -- effective % reward value
  monthly_cap_points    INTEGER,                -- null = no cap
  annual_cap_points     INTEGER,
  excluded              BOOLEAN DEFAULT false,  -- true = earns 0 points
  notes                 TEXT,
  effective_from        DATE NOT NULL,
  effective_to          DATE,                   -- null = currently active
  verified              BOOLEAN DEFAULT false,
  source_url            TEXT,
  created_at            TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_earn_rates_card_active
  ON earn_rates(card_id, effective_to)
  WHERE effective_to IS NULL;

-- ─────────────────────────────────────────────────────────
-- TABLE 3: transfer_partners
-- Airline and hotel transfer partners per card (versioned)
-- ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS transfer_partners (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id               TEXT NOT NULL REFERENCES card_rewards(card_id),
  partner_name          TEXT NOT NULL,          -- 'Marriott Bonvoy', 'InterMiles' etc.
  partner_type          TEXT NOT NULL,          -- 'airline' | 'hotel'
  partner_program       TEXT,                   -- 'Marriott Bonvoy', 'Flying Returns' etc.
  transfer_ratio_from   INTEGER NOT NULL,       -- card points (e.g. 5 EDGE)
  transfer_ratio_to     INTEGER NOT NULL,       -- partner points (e.g. 2 Bonvoy)
  transfer_cap_annual   INTEGER,               -- null = unlimited
  transfer_cap_lifetime INTEGER,
  partner_tier          TEXT,                   -- 'Group A', 'Group B' (Magnus-specific)
  min_transfer_units    INTEGER DEFAULT 1000,
  processing_days       INTEGER DEFAULT 3,
  effective_from        DATE NOT NULL,
  effective_to          DATE,
  verified              BOOLEAN DEFAULT false,
  source_url            TEXT,
  created_at            TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_transfer_partners_card_active
  ON transfer_partners(card_id, effective_to)
  WHERE effective_to IS NULL;

-- ─────────────────────────────────────────────────────────
-- TABLE 4: change_alerts
-- Scraper-detected and admin-confirmed reward changes
-- ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS change_alerts (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id        TEXT NOT NULL REFERENCES card_rewards(card_id),
  change_type    TEXT NOT NULL,                -- 'devaluation' | 'reward_change' | 'partner_announcement' | 'new_benefit' | 'fee_change'
  severity       TEXT NOT NULL,               -- 'critical' | 'high' | 'medium' | 'low'
  summary        TEXT NOT NULL,
  old_value      JSONB,
  new_value      JSONB,
  effective_date DATE,
  raw_content    TEXT,
  source_url     TEXT,
  source_type    TEXT,                        -- 'tc_pdf' | 'product_page' | 'newsroom' | 'technofino' | 'twitter' | 'bank_email'
  status         TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'confirmed' | 'rejected'
  confirmed_at   TIMESTAMPTZ,
  detected_at    TIMESTAMPTZ DEFAULT now(),
  created_at     TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_change_alerts_status ON change_alerts(status);
CREATE INDEX IF NOT EXISTS idx_change_alerts_card ON change_alerts(card_id, status);

-- ─────────────────────────────────────────────────────────
-- TABLE 5: page_hashes
-- SHA-256 hashes of bank pages for change detection
-- ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS page_hashes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id       TEXT NOT NULL REFERENCES card_rewards(card_id),
  page_type     TEXT NOT NULL,               -- 'product_page' | 'tc_pdf' | 'newsroom'
  url           TEXT NOT NULL,
  hash          TEXT NOT NULL,
  last_checked  TIMESTAMPTZ DEFAULT now(),
  last_changed  TIMESTAMPTZ,
  UNIQUE(card_id, page_type)
);

-- ─────────────────────────────────────────────────────────
-- TABLE 6: user_cards
-- Each user's registered cards and point balances
-- ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_cards (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  card_id                TEXT NOT NULL REFERENCES card_rewards(card_id),
  current_points_balance INTEGER NOT NULL DEFAULT 0,
  balance_last_updated   TIMESTAMPTZ DEFAULT now(),
  created_at             TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, card_id)                   -- user can't add same card twice
);

CREATE INDEX IF NOT EXISTS idx_user_cards_user ON user_cards(user_id);

-- ─────────────────────────────────────────────────────────
-- TABLE 7: conversations
-- Chat history per user (encrypted at application layer)
-- ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS conversations (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role         TEXT NOT NULL,               -- 'user' | 'assistant'
  content      JSONB NOT NULL,              -- { iv, data, tag } (AES-256-GCM encrypted)
  intent       TEXT,                        -- classified intent for analytics
  created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_conversations_user_time
  ON conversations(user_id, created_at DESC);

-- ─────────────────────────────────────────────────────────
-- TABLE 8: user_usage
-- Daily query count per user (for subscription limits)
-- ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_usage (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date          DATE NOT NULL DEFAULT CURRENT_DATE,
  queries_count INTEGER NOT NULL DEFAULT 0,
  UNIQUE(user_id, date)
);

CREATE INDEX IF NOT EXISTS idx_user_usage_user_date ON user_usage(user_id, date);

-- Atomic increment function (handles two-tab concurrency — EC-013)
CREATE OR REPLACE FUNCTION increment_query_count(p_user_id UUID)
RETURNS void AS $$
BEGIN
  INSERT INTO user_usage (user_id, date, queries_count)
  VALUES (p_user_id, CURRENT_DATE, 1)
  ON CONFLICT (user_id, date)
  DO UPDATE SET queries_count = user_usage.queries_count + 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─────────────────────────────────────────────────────────
-- TABLE 9: subscriptions
-- Billing state per user (written only by webhook handler)
-- ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS subscriptions (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tier                     TEXT NOT NULL DEFAULT 'basic',   -- 'basic' | 'pro' | 'max'
  status                   TEXT NOT NULL DEFAULT 'active',  -- 'active' | 'cancelled' | 'past_due' | 'trialing'
  razorpay_subscription_id TEXT,
  razorpay_customer_id     TEXT,
  current_period_start     TIMESTAMPTZ,
  current_period_end       TIMESTAMPTZ,
  cancel_at_period_end     BOOLEAN DEFAULT false,
  trial_end                TIMESTAMPTZ,
  created_at               TIMESTAMPTZ DEFAULT now(),
  updated_at               TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id)
);

-- ─────────────────────────────────────────────────────────
-- TABLE 10: subscription_events
-- Audit log of every billing state change
-- ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS subscription_events (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL,
  event_type        TEXT NOT NULL,    -- 'created' | 'upgraded' | 'downgraded' | 'cancelled' | 'renewed' | 'payment_failed'
  from_tier         TEXT,
  to_tier           TEXT,
  razorpay_event_id TEXT,
  metadata          JSONB,
  created_at        TIMESTAMPTZ DEFAULT now()
);

-- ─────────────────────────────────────────────────────────
-- TABLE 11: alert_reads
-- Tracks which alerts each user has read
-- ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS alert_reads (
  user_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  alert_id UUID NOT NULL REFERENCES change_alerts(id) ON DELETE CASCADE,
  read_at  TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, alert_id)
);

-- ─────────────────────────────────────────────────────────
-- TABLE 12: processed_webhook_events
-- Idempotency table — prevents Razorpay webhook replay
-- ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS processed_webhook_events (
  razorpay_event_id TEXT PRIMARY KEY,
  processed_at      TIMESTAMPTZ DEFAULT now()
);

-- ─────────────────────────────────────────────────────────
-- ADDITIONAL TABLES (scrapers + analytics)
-- ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS raw_snapshots (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id     TEXT,
  source_type TEXT,
  source_url  TEXT,
  content     TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS newsroom_headlines (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bank        TEXT NOT NULL,
  headline    TEXT NOT NULL,
  url         TEXT,
  published   DATE,
  processed   BOOLEAN DEFAULT false,
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE(bank, headline)
);

CREATE TABLE IF NOT EXISTS technofino_threads (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_title TEXT NOT NULL,
  thread_url  TEXT,
  posted_at   TIMESTAMPTZ,
  processed   BOOLEAN DEFAULT false,
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE(thread_url)
);

CREATE TABLE IF NOT EXISTS missing_card_requests (
  card_id      TEXT PRIMARY KEY,
  query_count  INTEGER DEFAULT 1,
  last_seen    TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS analytics_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID,
  event_type  TEXT NOT NULL,   -- 'affiliate_click' | 'upgrade_view' | 'query_limit_hit' etc.
  card_id     TEXT,
  metadata    JSONB,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS security_events (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID,
  event_type       TEXT NOT NULL,   -- 'prompt_injection_attempt' | 'webhook_signature_mismatch'
  pattern_hash     TEXT,            -- hash of detected pattern (NOT raw content)
  ip_address       TEXT,
  created_at       TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS compliance_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type  TEXT NOT NULL,   -- 'user_deletion' | 'data_export'
  user_id     UUID,
  metadata    JSONB,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- ═══════════════════════════════════════════════════════════
-- DONE — Run the RLS file next (rls.sql)
-- ═══════════════════════════════════════════════════════════
