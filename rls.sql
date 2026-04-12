-- ═══════════════════════════════════════════════════════════
-- CCRO — Row Level Security (RLS) Policies
-- Run this AFTER migrations.sql in Supabase → SQL Editor
-- KAN-16: Enable RLS on all tables
-- ═══════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────
-- card_rewards — public read, service role writes
-- ─────────────────────────────────────────────────────────
ALTER TABLE card_rewards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read card catalogue"
  ON card_rewards FOR SELECT
  USING (true);

-- No INSERT/UPDATE/DELETE for authenticated users
-- Only service role (admin panel) can write

-- ─────────────────────────────────────────────────────────
-- earn_rates — public read, service role writes
-- ─────────────────────────────────────────────────────────
ALTER TABLE earn_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read earn rates"
  ON earn_rates FOR SELECT
  USING (true);

-- ─────────────────────────────────────────────────────────
-- transfer_partners — public read, service role writes
-- ─────────────────────────────────────────────────────────
ALTER TABLE transfer_partners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read transfer partners"
  ON transfer_partners FOR SELECT
  USING (true);

-- ─────────────────────────────────────────────────────────
-- change_alerts — authenticated users read confirmed only
-- ─────────────────────────────────────────────────────────
ALTER TABLE change_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read confirmed alerts"
  ON change_alerts FOR SELECT
  TO authenticated
  USING (status = 'confirmed');

-- Service role can read all (pending + confirmed + rejected)
-- Service role writes all alert state changes

-- ─────────────────────────────────────────────────────────
-- page_hashes — service role only (scraper infra)
-- ─────────────────────────────────────────────────────────
ALTER TABLE page_hashes ENABLE ROW LEVEL SECURITY;
-- No policies = no access for authenticated users
-- Service role always bypasses RLS

-- ─────────────────────────────────────────────────────────
-- user_cards — users read/write own rows only
-- ─────────────────────────────────────────────────────────
ALTER TABLE user_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own cards"
  ON user_cards FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own cards"
  ON user_cards FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own cards"
  ON user_cards FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own cards"
  ON user_cards FOR DELETE
  USING (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────
-- conversations — users read/write own rows only
-- ─────────────────────────────────────────────────────────
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own conversations"
  ON conversations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own conversations"
  ON conversations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own conversations"
  ON conversations FOR DELETE
  USING (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────
-- user_usage — users read own, service role writes
-- ─────────────────────────────────────────────────────────
ALTER TABLE user_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own usage"
  ON user_usage FOR SELECT
  USING (auth.uid() = user_id);

-- increment_query_count function uses SECURITY DEFINER
-- so it runs as service role — no INSERT policy needed for users

-- ─────────────────────────────────────────────────────────
-- subscriptions — users read own, NO user writes ever
-- Service role webhook handler is the only writer
-- ─────────────────────────────────────────────────────────
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own subscription"
  ON subscriptions FOR SELECT
  USING (auth.uid() = user_id);

-- CRITICAL: No INSERT/UPDATE/DELETE policy for authenticated role
-- This is the subscription spoofing prevention (EC-013 pattern)
-- Only service role (webhook handler) can write subscriptions

-- ─────────────────────────────────────────────────────────
-- subscription_events — no user access (audit trail)
-- ─────────────────────────────────────────────────────────
ALTER TABLE subscription_events ENABLE ROW LEVEL SECURITY;
-- Service role only — billing audit trail

-- ─────────────────────────────────────────────────────────
-- alert_reads — users read/write own rows
-- ─────────────────────────────────────────────────────────
ALTER TABLE alert_reads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own alert reads"
  ON alert_reads FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can mark alerts as read"
  ON alert_reads FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────
-- processed_webhook_events — service role only
-- ─────────────────────────────────────────────────────────
ALTER TABLE processed_webhook_events ENABLE ROW LEVEL SECURITY;
-- Service role only — webhook idempotency table

-- ─────────────────────────────────────────────────────────
-- Scraper / analytics tables — service role only
-- ─────────────────────────────────────────────────────────
ALTER TABLE raw_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE newsroom_headlines ENABLE ROW LEVEL SECURITY;
ALTER TABLE technofino_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE missing_card_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_events ENABLE ROW LEVEL SECURITY;

-- analytics_events — service role writes, no user reads
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;

-- ═══════════════════════════════════════════════════════════
-- VERIFICATION QUERY
-- Run this after applying RLS to confirm setup
-- Should return one row per table with rls_enabled = true
-- ═══════════════════════════════════════════════════════════
/*
SELECT
  schemaname,
  tablename,
  rowsecurity AS rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
*/
