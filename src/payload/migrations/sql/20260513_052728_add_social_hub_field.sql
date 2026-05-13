-- Adds the `socialHub` group's `enabled` field to site_settings.
--
-- Companion to the new SocialHub component (a floating cluster of brand
-- icons in the bottom-left corner that fans out the platform URLs already
-- stored in `social_links_*`). This migration only adds the master
-- on/off toggle — the per-platform URLs already exist on this table
-- (social_links_whatsapp, social_links_facebook, etc.) and don't need
-- new columns.
--
-- Column naming follows Payload's nested-group convention, same pattern
-- the existing signature_ui_* and social_links_* columns use:
--   group `socialHub` + field `enabled` → social_hub_enabled
--
-- Default true: the component ships enabled; admin can flip it off from
-- /admin without a code change.
--
-- `IF NOT EXISTS` keeps this idempotent — re-applying it (or hand-adding
-- the column during recovery) is harmless.

ALTER TABLE site_settings
  ADD COLUMN IF NOT EXISTS social_hub_enabled boolean DEFAULT true;
