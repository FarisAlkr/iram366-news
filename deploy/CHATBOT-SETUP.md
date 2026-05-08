# Chatbot — Activation Guide

The chatbot scaffolding is in the codebase but **disabled by default**. Nothing
runs until `NEXT_PUBLIC_CHATBOT_ENABLED=true` is set on the VPS.

When activated, visitors get a floating "💬" button in the bottom-left corner.
Clicking it opens a search bar; they describe an article in natural language
and the widget returns up to 3 matching article links, ranked by semantic
similarity. **No LLM-generated answer text** — just article links.

---

## What this feature costs

* **One-time embed of all existing articles**: ~$0.05 (negligible)
* **Per query**: ~$0.000001 (one embedding call, no LLM call)
* **Realistic monthly bill**: under $1/month even with thousands of queries

The cost is so low because we don't call a language model — only the embedding
endpoint, which is ~3 orders of magnitude cheaper.

---

## Pick a provider

| Provider | Model | Dimensions | Notes |
|---|---|---|---|
| **OpenAI** (default) | `text-embedding-3-small` | 1536 | Widely supported, good Arabic. Sign up at platform.openai.com. |
| **Voyage AI** | `voyage-3` | 1024 | Anthropic-recommended. Sign up at voyageai.com. |

Switching providers later means dropping and re-creating the
`article_embeddings` table (different vector dimensions). Pick one and stick
with it unless you have a reason to switch.

---

## Activation steps

1. **Get an API key** from the provider you picked.

2. **Add env vars** to `/opt/iram366/.env` on the VPS:

   ```env
   # turn the feature on
   NEXT_PUBLIC_CHATBOT_ENABLED=true

   # pick one (default is openai)
   EMBEDDINGS_PROVIDER=openai
   OPENAI_API_KEY=sk-...

   # OR
   # EMBEDDINGS_PROVIDER=voyage
   # VOYAGE_API_KEY=pa-...
   ```

3. **Deploy** the env-var change so the app picks it up:

   ```bash
   ssh iram "cd /opt/iram366 && docker compose up -d"
   ```

4. **Set up pgvector and the embeddings table**:

   ```bash
   ssh iram "cd /opt/iram366 && docker compose exec -T app node scripts/chatbot-setup.mjs"
   ```

   This installs the `vector` Postgres extension, creates the
   `article_embeddings` table with the right dimensions, and adds an ivfflat
   index for fast cosine-similarity search. Idempotent — safe to re-run.

5. **Backfill embeddings for all existing articles**:

   ```bash
   ssh iram "cd /opt/iram366 && docker compose exec -T app node scripts/chatbot-backfill.mjs"
   ```

   This walks every published article, embeds it, and stores the vector. With
   the default 500ms throttle, ~500 articles takes ~5 minutes. New/updated
   articles after this point are embedded automatically by the `afterChange`
   hook.

6. **Verify**: open the site, click the 💬 button bottom-left, ask something
   like "أخبار رهط الأخيرة". Article links should come back within 1–2s.

---

## Deactivation

Set `NEXT_PUBLIC_CHATBOT_ENABLED=false` (or remove it) and `docker compose up -d`.
The widget disappears, the API endpoint 404s, and the `afterChange` hook stops
embedding new articles. The embedding data stays in Postgres — re-activating
later picks up where it left off.

To purge the data entirely:

```bash
ssh iram "cd /opt/iram366 && docker compose exec -T db psql -U iram366 -d iram366 -c 'DROP TABLE article_embeddings;'"
```

---

## Switching providers

If you switch from OpenAI to Voyage (or vice versa):

```bash
# 1. drop the table (different dimensions)
ssh iram "cd /opt/iram366 && docker compose exec -T db psql -U iram366 -d iram366 -c 'DROP TABLE article_embeddings;'"

# 2. update .env (EMBEDDINGS_PROVIDER, API key) and redeploy
# 3. re-run setup + backfill
ssh iram "cd /opt/iram366 && docker compose exec -T app node scripts/chatbot-setup.mjs"
ssh iram "cd /opt/iram366 && docker compose exec -T app node scripts/chatbot-backfill.mjs"
```

---

## File map

| File | Purpose |
|---|---|
| `src/lib/chatbot/config.ts` | Feature-flag + provider config |
| `src/lib/chatbot/embeddings.ts` | OpenAI/Voyage embedding wrapper |
| `src/lib/chatbot/db.ts` | Postgres pool for vector queries |
| `src/lib/chatbot/search.ts` | Cosine-similarity vector search |
| `src/payload/hooks/embed-article.ts` | After-change hook — auto-embed on publish |
| `src/app/api/chat/route.ts` | `POST /api/chat` — public search endpoint |
| `src/components/Chatbot.tsx` | Floating widget UI |
| `scripts/chatbot-setup.mjs` | One-time pgvector + table setup |
| `scripts/chatbot-backfill.mjs` | Bulk-embed existing articles |

When the feature flag is off, all of these become no-ops — zero runtime impact.
