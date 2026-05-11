# Contributing to IRAM 366

## Ground rules

1. **Match existing style.** Read a few files before writing new ones.
2. **TypeScript strict.** No `any` without an inline `// reason` comment. `as unknown as` is preferred over `as any` when crossing a Payload-typed boundary.
3. **No `console.log`** in committed code. Use `logger.info/warn/error` from `@/lib/logger`.
4. **No silent catches.** A try/catch without a logger call is a bug.
5. **RTL-native.** Use logical CSS properties (`ms-*`, `me-*`, `ps-*`, `pe-*`) — never directional ones.
6. **Server components by default.** Add `'use client'` only when you need state, effects, or browser APIs.

## Before you push

```bash
npm run typecheck
npm run lint
npm test
```

CI will reject anything that fails these. Run `npm run format` to apply Prettier.

## Naming

| Kind             | Style                                       | Example                       |
| ---------------- | ------------------------------------------- | ----------------------------- |
| Files            | kebab-case (lib) or PascalCase (components) | `rate-limit.ts`, `Header.tsx` |
| React components | PascalCase                                  | `ArticleCard`                 |
| Hooks            | `use*`                                      | `useViewCounter`              |
| Types/Interfaces | PascalCase                                  | `Article`, `MediaSize`        |
| Enums            | `as const` objects                          | `ArticleStatus.Published`     |
| Constants        | UPPER_SNAKE_CASE                            | `MAX_QUERY_LEN`               |

## Comments

We default to **no comments**. Only write one when:

- The code embodies a non-obvious tradeoff (rate-limit eviction interval, cache TTL).
- A workaround compensates for a third-party quirk.
- A constraint isn't visible in the code (e.g. "Postgres TEXT contains is case-insensitive").

Don't write comments that re-state what the code does.

## Adding a Payload field

1. Edit the relevant file under `src/payload/collections/`.
2. Generate a migration: `docker compose exec app npm run migrate:create -- --name add-foo`.
3. Commit the migration file alongside the code change.
4. Re-run `npm run generate:types` if you query the new field with the local API.

## Adding an API route

- Always rate-limit (`enforce(req, RateLimits.X)`).
- Always validate input length and shape.
- Return shaped JSON: `{ error: '...' }` for failures, structured data on success.
- Log unexpected failures with `logger.error('<event>.failed', { err, ... })`.

## Commit style

Conventional Commits-ish. Examples:

```
feat(articles): add scheduled publish via publishedAt
fix(search): tolerate Arabic letter variants
chore(docker): drop docker-entrypoint.sh now that we use standalone
docs(runbook): clarify restore steps
```

## Code review checklist

- [ ] Types are tight (no `any`, no over-broad `unknown`)
- [ ] Errors are logged, not swallowed
- [ ] No new client component without justification
- [ ] User-facing strings in Arabic where applicable
- [ ] Migration committed if schema changed
- [ ] Tests for new pure functions
- [ ] README/RUNBOOK updated if ops surface changed
