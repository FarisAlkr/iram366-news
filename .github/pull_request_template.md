## Summary

<!-- one-line description of what this PR does and why -->

## Type of change

- [ ] Bug fix
- [ ] Feature
- [ ] Refactor
- [ ] Chore

## Schema changes

<!--
Pick one. If unsure, default to "modifies the schema" — an extra empty
migration is cheap; a missing one caused the 2026-05-11 outage.
-->

- [ ] This PR modifies Payload collections or globals — I generated a migration with `npm run migrate:create -- <name>` and committed it under `src/payload/migrations/`
- [ ] This PR does not touch the database schema
- [ ] This PR touches collection/global files but does NOT require a migration (e.g. admin label or description change only) — add `[skip-migration-check]` somewhere in this PR title, body, or a commit message to bypass the CI guard

## Test plan

<!--
How a reviewer can verify this works. Bulleted checklist preferred.
For UI changes, include browser steps; for backend, include curl / API
calls; for deploys, link to the workflow run.
-->

- [ ]
