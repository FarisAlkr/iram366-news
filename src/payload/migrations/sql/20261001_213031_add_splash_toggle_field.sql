-- Adds the splash-screen on/off toggle to site_settings.
--
-- Column naming follows the existing Payload nested-group convention used by
-- the sibling fields (`signature_ui_enable_cursor_ink`,
-- `signature_ui_enable_eid_sheep`):
--   group `signatureUi` + field `enableSplash` → signature_ui_enable_splash
--
-- Default is `true`: the splash has always been shown, so existing sites keep
-- today's behavior until the admin switches it off.
--
-- `IF NOT EXISTS` keeps the migration idempotent, matching the other
-- site_settings migrations.

ALTER TABLE site_settings
  ADD COLUMN IF NOT EXISTS signature_ui_enable_splash boolean DEFAULT true;
