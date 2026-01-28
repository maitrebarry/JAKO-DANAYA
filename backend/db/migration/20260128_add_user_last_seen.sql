-- Migration: add last_login_at and last_seen_at to utilisateur
-- Target DB: MySQL 8+
-- Purpose: track user activity for connected/disconnected stats

ALTER TABLE utilisateur
  ADD COLUMN IF NOT EXISTS last_login_at DATETIME NULL,
  ADD COLUMN IF NOT EXISTS last_seen_at DATETIME NULL;

-- Optional backfill for existing rows (set last_seen_at to last_login_at if present)
UPDATE utilisateur
SET last_seen_at = COALESCE(last_seen_at, last_login_at)
WHERE last_seen_at IS NULL;
