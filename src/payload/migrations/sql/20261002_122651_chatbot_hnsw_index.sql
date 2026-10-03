-- Replaces the chatbot's ivfflat index with HNSW.
--
-- article_embeddings_cosine_idx was created by scripts/chatbot-setup.mjs as
-- ivfflat with lists = 50 on an (almost) empty table. ivfflat clusters are
-- trained from the rows present at build time and queries scan only one
-- cluster (probes = 1), so with poor centroids most articles are never
-- found: asking the chatbot for an article's exact title did not return
-- that article (verified on production 2026-10-02).
--
-- HNSW needs no training data, stays accurate as rows are added, and is
-- well within budget at this table size (1536-dim, ~1k rows). Requires
-- pgvector >= 0.5 — the installed extension advertises "ivfflat and hnsw".
--
-- Guarded: the chatbot tables only exist where chatbot-setup has been run.

DO $$
BEGIN
  IF to_regclass('public.article_embeddings') IS NULL THEN
    RAISE NOTICE 'article_embeddings not found — chatbot not set up, skipping';
  ELSE
    DROP INDEX IF EXISTS article_embeddings_cosine_idx;
    CREATE INDEX IF NOT EXISTS article_embeddings_hnsw_idx
      ON article_embeddings USING hnsw (embedding vector_cosine_ops);
  END IF;
END $$;
