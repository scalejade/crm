-- ─────────────────────────────────────────────────────────────────────────────
-- App branding (company name + logo)
--
-- A single global row holds the workspace's company name and logo. It's shown in
-- the sidebar, the mobile nav, and the (unauthenticated) login screen, so the row
-- is PUBLICLY READABLE. Authenticated users can update it from Settings.
-- The logo is stored inline as a base64 data URL, so no storage bucket is needed
-- and the login page can render it without a session.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS crm.branding (
  -- Singleton: the CHECK + default pin every row to id = true.
  id           BOOLEAN PRIMARY KEY DEFAULT true CHECK (id),
  company_name TEXT NOT NULL DEFAULT 'CRM',
  logo_url     TEXT,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed the default row.
INSERT INTO crm.branding (id, company_name) VALUES (true, 'CRM')
  ON CONFLICT (id) DO NOTHING;

ALTER TABLE crm.branding ENABLE ROW LEVEL SECURITY;

-- Anyone (including the login screen) may read branding.
DROP POLICY IF EXISTS "branding: public read" ON crm.branding;
CREATE POLICY "branding: public read"
  ON crm.branding FOR SELECT
  USING (true);

-- Signed-in users may update it.
DROP POLICY IF EXISTS "branding: authenticated update" ON crm.branding;
CREATE POLICY "branding: authenticated update"
  ON crm.branding FOR UPDATE TO authenticated
  USING (true) WITH CHECK (true);

-- Grants (RLS still applies on top of these).
GRANT USAGE ON SCHEMA crm TO anon;
GRANT SELECT ON crm.branding TO anon;
GRANT SELECT, UPDATE ON crm.branding TO authenticated;
