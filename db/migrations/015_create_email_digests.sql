-- Migration 012: Email digests table (Issue #1176)
-- Stores pending/sent/failed email digest jobs for the email digest worker.

BEGIN;

CREATE TABLE IF NOT EXISTS email_digests (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL,
  user_email    VARCHAR(255) NOT NULL,
  digest_type   VARCHAR(10) NOT NULL CHECK (digest_type IN ('weekly', 'monthly')),
  status        VARCHAR(10) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'sent', 'failed')),
  tree_count    INT NOT NULL DEFAULT 0,
  total_co2_kg  REAL NOT NULL DEFAULT 0,
  new_updates   INT NOT NULL DEFAULT 0,
  top_species   VARCHAR(100) DEFAULT 'Unknown',
  error_count   INT NOT NULL DEFAULT 0,
  last_error    TEXT,
  last_error_at TIMESTAMPTZ,
  generated_at  TIMESTAMPTZ DEFAULT now(),
  sent_at       TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

-- Index for the worker's primary query: fetch pending digests oldest-first
CREATE INDEX IF NOT EXISTS idx_email_digests_pending
  ON email_digests(generated_at)
  WHERE status = 'pending';

-- Index for status lookups and cleanup
CREATE INDEX IF NOT EXISTS idx_email_digests_status
  ON email_digests(status);

-- Unique constraint to prevent duplicate digests per user per period
CREATE UNIQUE INDEX IF NOT EXISTS idx_email_digests_unique_per_user
  ON email_digests(user_id, digest_type, date_trunc('week', generated_at))
  WHERE status IN ('pending', 'processing', 'sent');

-- Migration 015: Monthly forest health newsletter (Issue #1703)
-- Adds newsletter CMS tables and links monthly digests to a newsletter issue.

CREATE TABLE IF NOT EXISTS newsletters (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title         VARCHAR(255) NOT NULL,
  subject       VARCHAR(255) NOT NULL,
  preheader     VARCHAR(255),
  -- Curated sections: platform news, featured stories, species spotlights, conservation tips
  sections      JSONB NOT NULL DEFAULT '{}'::jsonb,
  status        VARCHAR(10) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'sending', 'sent', 'cancelled')),
  scheduled_at  TIMESTAMPTZ,
  sent_at       TIMESTAMPTZ,
  created_by    UUID,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

-- Index for the scheduler's primary query: fetch due newsletters oldest-first
CREATE INDEX IF NOT EXISTS idx_newsletters_scheduled
  ON newsletters(scheduled_at)
  WHERE status = 'scheduled';

-- Index for status lookups in the admin panel
CREATE INDEX IF NOT EXISTS idx_newsletters_status
  ON newsletters(status);

CREATE TABLE IF NOT EXISTS newsletter_subscriptions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL,
  user_email     VARCHAR(255) NOT NULL,
  opted_in       BOOLEAN NOT NULL DEFAULT true,
  opted_in_at    TIMESTAMPTZ DEFAULT now(),
  opted_out_at   TIMESTAMPTZ,
  created_at     TIMESTAMPTZ DEFAULT now(),
  updated_at     TIMESTAMPTZ DEFAULT now()
);

-- One subscription record per sponsor
CREATE UNIQUE INDEX IF NOT EXISTS idx_newsletter_subscriptions_user
  ON newsletter_subscriptions(user_id);

-- Index for the worker's recipient query: opted-in subscribers only
CREATE INDEX IF NOT EXISTS idx_newsletter_subscriptions_opted_in
  ON newsletter_subscriptions(opted_in)
  WHERE opted_in = true;

-- Link monthly digests to the newsletter issue they were sent from
ALTER TABLE email_digests
  ADD COLUMN IF NOT EXISTS newsletter_id UUID REFERENCES newsletters(id) ON DELETE SET NULL;

-- Index for per-newsletter send tracking
CREATE INDEX IF NOT EXISTS idx_email_digests_newsletter
  ON email_digests(newsletter_id)
  WHERE newsletter_id IS NOT NULL;

COMMIT;
