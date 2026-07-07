-- ─────────────────────────────────────────────────────────────────────────────
-- Scheduled email sending
--
-- Adds a "send at" time + status to email_drafts, then wires up pg_cron + pg_net
-- to invoke the `process-scheduled-emails` edge function once a minute. The edge
-- function claims any draft whose scheduled_at has passed and sends it.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Schema ───────────────────────────────────────────────────────────────────
ALTER TABLE crm.email_drafts
  ADD COLUMN IF NOT EXISTS status       TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'scheduled', 'sending', 'sent', 'failed')),
  ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_error   TEXT;

-- Fast lookup of the drafts the worker needs each tick.
CREATE INDEX IF NOT EXISTS email_drafts_due_idx
  ON crm.email_drafts (scheduled_at)
  WHERE status = 'scheduled';

-- (RLS is unchanged — the existing "owner full access" policy already lets a user
--  set status/scheduled_at on their own drafts. The worker uses the service role,
--  which bypasses RLS.)

-- 2. Extensions ───────────────────────────────────────────────────────────────
-- pg_cron creates the `cron` schema; pg_net creates the `net` schema. Do NOT pin
-- them to another schema. (You can also enable both from the Supabase Dashboard →
-- Database → Extensions instead of here.)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 3. Secrets ──────────────────────────────────────────────────────────────────
-- The cron job needs the project URL and a shared secret. Store them in Vault
-- (never hardcode secrets in SQL). Run these ONCE, filling in your real values:
--
--   select vault.create_secret('https://ojpqcbgcbmugwsbzoost.supabase.co', 'project_url');
--   select vault.create_secret('<A_LONG_RANDOM_STRING>',                   'cron_secret');
--
-- The same cron_secret must be set as the CRON_SECRET env var on the edge
-- function:  supabase secrets set CRON_SECRET=<A_LONG_RANDOM_STRING>

-- 4. Cron job ─────────────────────────────────────────────────────────────────
-- Every hour (top of the hour): POST to the worker with the shared cron secret.
-- pg_net fires the request asynchronously, so the job returns immediately.
select cron.schedule(
  'process-scheduled-emails',
  '* * * * *',
  $$
  select net.http_post(
    url     := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
               || '/functions/v1/process-scheduled-emails',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    body    := '{}'::jsonb
  );
  $$
);

-- To remove the schedule later:  select cron.unschedule('process-scheduled-emails');
