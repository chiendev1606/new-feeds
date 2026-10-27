---
title: "Backend dùng PostgreSQL chạy bằng Docker"
description: "Thay in-memory DB bằng Postgres 17 + Adminer qua docker compose. Truy vấn SQL thuần bằng pg, API giữ nguyên."
status: completed
priority: P2
effort: 3h
tags: [backend, database, infra]
blockedBy: []
blocks: []
created: 2026-10-27
---

# Backend dùng PostgreSQL chạy bằng Docker

## Quyết định (người dùng chọn)
- Dùng PostgreSQL 17 kèm Adminer. Không dùng ORM; truy vấn SQL thuần bằng thư viện `pg`.
- Bỏ chế độ in-memory, chỉ còn một đường truy cập dữ liệu. Unit test thuần không cần Docker; integration test dùng database `newsfeed_test`.

## Phases

| # | Phase | Status |
|---|---|---|
| 1 | [Postgres + Docker + repository](./phase-01-postgres-docker-and-repository.md) | Completed |

## Các bước
1. Viết `docker-compose.yml` (postgres + adminer, có healthcheck và volume) và `server/db/init/*.sql` để tạo database test.
2. Viết `server/db/schema.sql` gồm các bảng: users, posts (index trên `(created_at DESC, id DESC)`), media (`bytea` cho ảnh upload), reactions (khoá chính `(post_id, user_id)`), idempotency_keys (khoá chính `(viewer_id, key)`), feed_state.
3. Thay `in-memory-database.ts` bằng `feed-repository.ts` (async). Thêm `database-pool.ts`, `seed-database.ts`, và tự khởi tạo DB khi server start.
4. Chuyển services và routes sang async. Thông tin của nhiều bài được lấy gộp trong một truy vấn (tránh N+1). Tạo bài và lưu idempotency key trong cùng một transaction.
5. Thêm script: `db:up`, `db:down`, `db:reset`, `db:backup`, `predev`. Cấu hình Vitest chạy tuần tự, kèm global setup kiểm tra kết nối DB.
6. Cập nhật README, `server/README.md` và learning guide.

## Tiêu chí hoàn thành
- `npm run typecheck`, `npm run test` và `npm run build` đều pass.
- Smoke test trên Chrome không có lỗi console.
- Adminer xem được các bảng; restart server thì dữ liệu vẫn còn.
