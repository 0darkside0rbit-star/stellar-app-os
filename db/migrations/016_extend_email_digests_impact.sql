BEGIN;

ALTER TABLE email_digests
  ADD COLUMN IF NOT EXISTS photo_urls JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS community_highlights JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS newsletter_id UUID,
  ADD COLUMN IF NOT EXISTS personalised_tree_updates JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS opt_in_newsletter BOOLEAN NOT NULL DEFAULT true;

COMMIT;