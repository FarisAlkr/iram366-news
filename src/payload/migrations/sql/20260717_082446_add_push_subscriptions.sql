-- Audience push notifications — Stage 0 backend.
--
-- Adds the `push-subscriptions` Payload collection and the `pushSentAt`
-- send-once guard on articles. Column/enum/index names reproduce exactly what
-- Payload's postgres adapter would generate (native enums `enum_<table>_<field>`,
-- an integer id + sequence, `<table>_<field>_idx` indexes), because in
-- production the schema is applied by this SQL — not by `push` — and must match
-- the drizzle schema Payload builds from the collection config. See the
-- 2026-05-11 incident for what a divergence costs.
--
-- Idempotent throughout (IF NOT EXISTS + guarded DO blocks) so a hand-applied
-- partial re-run is safe.

-- 1. Enum types for the `platform` and `topic` select fields.
DO $$ BEGIN
  CREATE TYPE public.enum_push_subscriptions_platform AS ENUM ('web', 'ios', 'android');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.enum_push_subscriptions_topic AS ENUM ('all', 'breaking');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. The collection table. The PK is inline (not a separate ADD CONSTRAINT) so
--    table + primary key are created atomically under CREATE TABLE IF NOT
--    EXISTS — a partial re-run can't leave the table without its PK, and
--    Postgres auto-names the constraint `push_subscriptions_pkey`, matching
--    Payload's convention.
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
    id integer PRIMARY KEY NOT NULL,
    endpoint character varying NOT NULL,
    p256dh character varying,
    auth character varying,
    platform public.enum_push_subscriptions_platform DEFAULT 'web'::public.enum_push_subscriptions_platform NOT NULL,
    topic public.enum_push_subscriptions_topic DEFAULT 'all'::public.enum_push_subscriptions_topic NOT NULL,
    user_agent character varying,
    last_seen_at timestamp(3) with time zone,
    disabled_at timestamp(3) with time zone,
    updated_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    created_at timestamp(3) with time zone DEFAULT now() NOT NULL
);

CREATE SEQUENCE IF NOT EXISTS public.push_subscriptions_id_seq
    AS integer START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
ALTER SEQUENCE public.push_subscriptions_id_seq OWNED BY public.push_subscriptions.id;
ALTER TABLE ONLY public.push_subscriptions
    ALTER COLUMN id SET DEFAULT nextval('public.push_subscriptions_id_seq'::regclass);

-- 3. Indexes (unique endpoint + the index:true fields + Payload's timestamp idx).
CREATE UNIQUE INDEX IF NOT EXISTS push_subscriptions_endpoint_idx
    ON public.push_subscriptions USING btree (endpoint);
CREATE INDEX IF NOT EXISTS push_subscriptions_platform_idx
    ON public.push_subscriptions USING btree (platform);
CREATE INDEX IF NOT EXISTS push_subscriptions_topic_idx
    ON public.push_subscriptions USING btree (topic);
CREATE INDEX IF NOT EXISTS push_subscriptions_disabled_at_idx
    ON public.push_subscriptions USING btree (disabled_at);
CREATE INDEX IF NOT EXISTS push_subscriptions_created_at_idx
    ON public.push_subscriptions USING btree (created_at);
CREATE INDEX IF NOT EXISTS push_subscriptions_updated_at_idx
    ON public.push_subscriptions USING btree (updated_at);

-- 4. Register the collection with Payload's locked-documents relationship table
--    (every collection gets a <slug>_id column + index + cascade FK here).
ALTER TABLE public.payload_locked_documents_rels
    ADD COLUMN IF NOT EXISTS push_subscriptions_id integer;
CREATE INDEX IF NOT EXISTS payload_locked_documents_rels_push_subscriptions_id_idx
    ON public.payload_locked_documents_rels USING btree (push_subscriptions_id);
DO $$ BEGIN
  ALTER TABLE ONLY public.payload_locked_documents_rels
    ADD CONSTRAINT payload_locked_documents_rels_push_subscriptions_fk
    FOREIGN KEY (push_subscriptions_id)
    REFERENCES public.push_subscriptions(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 5. Send-once guard on articles. Written by the push-notify hook via raw SQL.
--    The versions table (_articles_v) needs the mirrored version_ column too,
--    per the article-field rule in CLAUDE.md §9.
ALTER TABLE public.articles
    ADD COLUMN IF NOT EXISTS push_sent_at timestamp(3) with time zone;
ALTER TABLE public._articles_v
    ADD COLUMN IF NOT EXISTS version_push_sent_at timestamp(3) with time zone;
