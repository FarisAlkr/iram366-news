-- Enforce at the database level that only one admin user can exist.
-- The Payload hook in src/payload/collections/Users.ts is the friendly
-- application-layer guard; this index is the durable backstop that
-- survives bulk imports, raw SQL, and hook bypasses.
--
-- Created idempotently on first DB boot (postgres-entrypoint runs files
-- in /docker-entrypoint-initdb.d once, when the data dir is empty).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'users_single_admin'
  ) THEN
    EXECUTE 'CREATE UNIQUE INDEX users_single_admin ON users ((1)) WHERE role = ''admin''';
  END IF;
EXCEPTION
  -- The users table may not exist yet on the very first boot before Payload
  -- creates the schema. The index is recreated on next boot/migration.
  WHEN undefined_table THEN
    RAISE NOTICE 'users table not found yet — single-admin index will be created on next boot';
END $$;
