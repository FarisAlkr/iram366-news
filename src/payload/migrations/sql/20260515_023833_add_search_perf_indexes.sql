-- Adds two performance indexes flagged in the pre-launch audit:
--
--   F-1.4-4: articles.views has no index → the homepage's `sort: '-views'`
--            ("most-read" sidebar) and the admin "top articles" stats query
--            both seq-scan the entire published set and sort in memory on
--            every ISR regeneration. Fine at the current 73 rows;
--            grows linearly with article count.
--
--   F-1.4-5: articles.title and articles.excerpt have no trigram index →
--            the /search endpoint compiles to ILIKE '%q%' which cannot
--            use a btree. With the Arabic-letter-variant OR, every search
--            does 4 sequential scans. At 5k articles this saturates a
--            connection for hundreds of ms per query.
--
-- Both are additive and idempotent. No schema change at the data level,
-- so the previously-running app version stays compatible during the
-- atomic migrate→swap window in the deploy workflow.
--
-- The views index is partial — restricted to the (status='published' AND
-- deleted_at IS NULL) subset that the homepage actually sorts. Saves
-- index size and keeps it tight as draft/archived content grows.
--
-- pg_trgm ships with Postgres core but isn't installed by default; the
-- pgvector image has it available. `CREATE EXTENSION IF NOT EXISTS` is
-- a no-op when the extension is already present, so this is safe to
-- re-run.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS articles_views_desc_idx
  ON articles (views DESC)
  WHERE status = 'published' AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS articles_title_trgm_idx
  ON articles USING gin (title gin_trgm_ops);

CREATE INDEX IF NOT EXISTS articles_excerpt_trgm_idx
  ON articles USING gin (excerpt gin_trgm_ops);
