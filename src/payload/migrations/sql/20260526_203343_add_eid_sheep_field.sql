-- Adds the seasonal Eid al-Adha falling-sheep toggle to site_settings.
--
-- Column naming follows the existing Payload nested-group convention used by
-- the sibling fields (`signature_ui_enable_cursor_ink`,
-- `signature_ui_enable_footer_camel`):
--   group `signatureUi` + field `enableEidSheep` → signature_ui_enable_eid_sheep
--
-- Default is `false` (off) — this is a seasonal effect, not an always-on
-- signature touch, so the admin opts in for the Eid window and turns it off
-- again afterward.
--
-- `IF NOT EXISTS` keeps the migration idempotent, matching the pattern of the
-- 2026-05-12 signatureUi migration after the production incident.

ALTER TABLE site_settings
  ADD COLUMN IF NOT EXISTS signature_ui_enable_eid_sheep boolean DEFAULT false;
