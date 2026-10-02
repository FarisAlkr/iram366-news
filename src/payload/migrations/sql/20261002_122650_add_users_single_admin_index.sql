-- Creates the users_single_admin partial unique index: at most one row in
-- `users` may have role = 'admin'.
--
-- deploy/postgres-init/10-single-admin.sql was meant to create it, but
-- initdb scripts run only once, on an empty data volume — before Payload
-- has created the `users` table — so it hit undefined_table and never ran
-- again. The index is absent from the 2026-05-11 production baseline dump;
-- only the app-level Users.beforeValidate hook was enforcing the rule.
--
-- Guarded so it can never fail a deploy: if more than one admin already
-- exists it skips with a WARNING — demote the extra admin, then run the
-- CREATE INDEX below by hand. IF NOT EXISTS keeps it idempotent.

DO $$
BEGIN
  IF to_regclass('public.users') IS NULL THEN
    RAISE NOTICE 'users table not found — skipping users_single_admin';
  ELSIF (SELECT count(*) FROM users WHERE role = 'admin') > 1 THEN
    RAISE WARNING 'users_single_admin NOT created: more than one admin exists';
  ELSE
    CREATE UNIQUE INDEX IF NOT EXISTS users_single_admin ON users ((1)) WHERE role = 'admin';
  END IF;
END $$;
