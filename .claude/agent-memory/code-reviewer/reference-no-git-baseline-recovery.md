---
name: reference-no-git-baseline-recovery
description: Project has no git; recover pre-change code from Claude session transcripts and old DDL from backups/*.sql pg_dumps
metadata:
  type: reference
---

This repo is not a git repo, so there is no diff baseline for reviews.

- Pre-change source: parse `~/.claude/projects/-Users-chienquoc-Documents-fe-system-design-new-feeds/*.jsonl` for `Write`/`Edit` tool_use inputs on the file path, and take the last version written before the change.
- Old DB schema: `backups/newsfeed-*.sql` (from `npm run db:backup`, `pg_dump --clean`) holds the real DDL.
- Behavioral probes: create throwaway DBs in the compose Postgres (`docker compose exec -T postgres psql -U newsfeed -d newsfeed -c "CREATE DATABASE ..."`), run probe scripts as `.mts` with `npx tsx` from the repo root (a plain `.ts` file in the scratchpad compiles as CJS, so top-level await fails), then drop the DBs.
- drizzle-kit drift check: give it a config whose `out` is a relative path to a copy of the migrations folder. drizzle-kit prefixes `./`, so absolute paths break. Do not import `drizzle-kit` in a config placed outside the repo.

Related: [[reference-headless-browser-verification]]
