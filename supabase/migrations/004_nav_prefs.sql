-- ─────────────────────────────────────────────────────────────────────────────
-- Sidebar navigation preferences (per user)
--
-- One row per user. `tabs` is a jsonb map of nav key -> boolean visibility,
-- e.g. {"pipeline": false, "storage": false}. A missing key means VISIBLE, so
-- every tab defaults to shown (true) and newly added tabs appear automatically.
-- The Settings tab itself can never be hidden (enforced in the UI) so users
-- can always get back here.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS crm.nav_prefs (
  user_id    UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tabs       JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE crm.nav_prefs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "nav_prefs: own read" ON crm.nav_prefs;
CREATE POLICY "nav_prefs: own read"
  ON crm.nav_prefs FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "nav_prefs: own insert" ON crm.nav_prefs;
CREATE POLICY "nav_prefs: own insert"
  ON crm.nav_prefs FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "nav_prefs: own update" ON crm.nav_prefs;
CREATE POLICY "nav_prefs: own update"
  ON crm.nav_prefs FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

GRANT SELECT, INSERT, UPDATE ON crm.nav_prefs TO authenticated;
