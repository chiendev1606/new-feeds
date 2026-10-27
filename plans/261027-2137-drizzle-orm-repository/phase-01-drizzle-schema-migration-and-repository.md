---
phase: 1
title: "Schema + migration + repository"
status: completed
priority: P2
effort: "2h"
dependencies: []
---

# Phase 1: Schema + migration + repository

## Goal
Thay `server/db/schema.sql` và SQL viết tay bằng Drizzle.

## Files
- Tạo mới:
  - `server/src/data/database-schema.ts`
  - `drizzle.config.ts`
  - `server/db/migrations/*` (do drizzle-kit sinh ra)
- Sửa:
  - `server/src/data/{database-pool,feed-repository,seed-database}.ts`
  - `server/src/app-context.ts`
  - `server/src/routes/post-routes.ts`
  - `server/src/services/{idempotency-store,engagement-summary-builder,feed-query-service}.ts`
  - `server/src/test-support/test-database.ts`
  - `server/src/server-entry.ts`
  - `server/src/cli/reset-database-cli.ts`
  - `package.json`
  - README
- Xoá: `server/db/schema.sql`

## Steps
1. Backup DB (`npm run db:backup`).
2. Viết schema Drizzle, rồi chạy `drizzle-kit generate` để sinh migration đầu tiên.
3. Reset schema `public` của dev DB và test DB, vì các bảng cũ được tạo bằng `schema.sql` chứ không qua migration. Sau đó server chạy migration và seed lại.
4. Viết lại repository, seed và transaction bằng Drizzle.

## Verification
- Typecheck, test và build đều pass.
- Smoke test trên Chrome thật (CDP).
