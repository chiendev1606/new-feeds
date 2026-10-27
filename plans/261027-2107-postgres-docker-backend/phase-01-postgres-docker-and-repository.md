---
phase: 1
title: "Postgres + Docker + repository"
status: completed
priority: P2
effort: "3h"
dependencies: []
---

# Phase 1: Postgres + Docker + repository

## Goal
Thay in-memory DB bằng PostgreSQL chạy trong Docker. API giữ nguyên.

## Files
- Tạo mới: `docker-compose.yml`, `server/db/schema.sql`, `server/db/init/01-create-test-database.sql`, `server/src/data/{database-pool,feed-repository,seed-database}.ts`, `server/src/server-bootstrap.ts`, `server/src/cli/reset-database-cli.ts`, `server/src/test-support/test-database.ts`, `vitest.config.ts`.
- Sửa: toàn bộ `server/src/routes/*`, `server/src/services/*` (chuyển sang async), `fake-session-middleware.ts`, `error-handler-middleware.ts`, `package.json` (scripts `db:*`, `predev`).
- Xoá: `server/src/data/in-memory-database.ts`.

## Verification
- `npm run typecheck`, `npm run test` (73 test) và `npm run build` đều pass.
- Restart server thì dữ liệu vẫn còn; Adminer trả HTTP 200; `npm run db:backup` tạo được file dump.
