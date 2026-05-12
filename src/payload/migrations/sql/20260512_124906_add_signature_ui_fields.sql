-- Adds the `signatureUi` group fields to site_settings.
--
-- Companion to the SiteSettings.ts change cherry-picked from the original
-- PR #6 work (the calligraphy-ink cursor and the footer camel). PR #6 added
-- these fields in code and shipped without a matching schema migration,
-- which broke production on 2026-05-11 18:55 UTC — every page that called
-- getSiteSettings() returned 500 because the queried columns didn't exist.
-- This migration applies them through the SQL runner introduced in PR #10.
--
-- Column naming follows Payload's nested-group convention, verified against
-- the existing site_settings columns (`announcement_show`,
-- `social_links_whatsapp`, `homepage_hero_mode`, etc.):
--   group `signatureUi` + field `enableCursorInk`  → signature_ui_enable_cursor_ink
--   group `signatureUi` + field `enableFooterCamel` → signature_ui_enable_footer_camel
--
-- Defaults match the `defaultValue: true` declared on each checkbox in
-- SiteSettings.ts. No NOT NULL constraint, mirroring the existing boolean
-- columns on this table (`announcement_show`, `announcement_dismissible`).
--
-- `IF NOT EXISTS` makes this idempotent — if a column was hand-added at any
-- point during the incident recovery, the migration skips it instead of
-- crashing.

ALTER TABLE site_settings
  ADD COLUMN IF NOT EXISTS signature_ui_enable_cursor_ink boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS signature_ui_enable_footer_camel boolean DEFAULT true;
