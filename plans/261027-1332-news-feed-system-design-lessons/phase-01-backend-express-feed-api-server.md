---
phase: 1
title: "Backend: Express feed API server"
status: completed
priority: P1
effort: "3h"
dependencies: []
---

# Phase 1: Backend — Express feed API server

## Goal
Có một backend Node độc lập (`server/`, cổng 3001) triển khai đúng phần Interface (API) trong bài.

Backend có hai mục đích minh hoạ. Thứ nhất là các quyết định phía server mà frontend phụ thuộc vào: cursor mờ gắn với generation, payload chuẩn hoá, idempotency, identity lấy từ session, `Cache-Control: private`, lỗi 429/503 kèm `Retry-After`. Thứ hai là cho phép điều khiển độ trễ và lỗi để quan sát hành vi của frontend.

## Quyết định
- Express 5 + TypeScript, chạy bằng `tsx watch`.
- Dữ liệu lưu trong bộ nhớ (in-memory), seed tất định. Restart là về trạng thái ban đầu, dễ lặp lại thí nghiệm.
- Một `package.json` ở root, không dùng workspaces. Script `dev` chạy song song backend và Vite bằng `concurrently`.
- Vite proxy `/api` và `/media` sang `http://localhost:3001`, nên frontend không cần cấu hình CORS.
- Mọi request được log ra terminal (method, path, query, status, ms, idempotency key), để người học thấy được frontend đang gọi gì.

## Files to Create
`server/src/`:
- `server-entry.ts`: gọi `createApp()` rồi `listen(3001)`.
- `create-express-app.ts`: lắp ráp middleware và routes. Tách riêng để test có thể `listen(0)`.
- `config/runtime-simulation-config.ts`: `{ latencyMs, failRate, autoNewPostsEverySec }`, có thể thay đổi lúc runtime.

`server/src/middleware/`:
- `request-logger-middleware.ts`.
- `fake-session-middleware.ts`
  - Lấy viewer từ cookie `sid`; thiếu cookie thì gán `user-1`.
  - Comment giải thích: server không bao giờ nhận `userId` từ client.
- `simulated-latency-and-failure-middleware.ts`
  - Chờ `latencyMs` (±20% jitter).
  - Với xác suất `failRate`, trả 503 kèm `Retry-After: 1`.
  - Bỏ qua các route `/__mock`.
- `error-handler-middleware.ts`: trả lỗi theo dạng `{ error: { code, message } }`.

`server/src/data/`:
- `seed-data-generator.ts`
  - PRNG mulberry32.
  - Khoảng 30 user và 300 post, `createdAt` giảm dần.
  - Body tiếng Việt có mention, hashtag, link, emoji; entity ranges tính theo UTF-16.
  - 0–4 ảnh mỗi post.
- `in-memory-database.ts`
  - Các map `users`, `posts`, `media`, `reactions: Map<postId, Map<userId, ReactionType>>`, `uploadedMediaBytes`.
  - `feedGeneration` và `insertNewPosts(n)`.

`server/src/services/`:
- `feed-cursor-codec.ts`
  - Mã hoá base64url của `{ createdAt, id, generation }`.
  - Decode lỗi thì trả 400 `INVALID_CURSOR`.
- `feed-query-service.ts`
  - `getFeedPage({ viewerId, count, cursor, direction })`: sắp xếp ổn định theo `(createdAt desc, id desc)`.
  - `older` lấy các bài đứng sau cursor; `newer` lấy các bài đứng trước `newerCursor`.
  - Trả `{ feed, posts, users, media }` dạng chuẩn hoá.
  - `count` được giới hạn trong khoảng 1–50.
- `offset-feed-query-service.ts`: phân trang theo offset, chỉ dùng cho demo ở lesson 02.
- `engagement-summary-builder.ts`: tính count theo từng reaction và `viewerReaction` của viewer.
- `idempotency-store.ts`
  - Lưu `Map<viewerId:key, { status, body }>`.
  - Trùng key thì trả lại response cũ, kèm header `Idempotent-Replayed: true`.
- `media-svg-renderer.ts`: sinh SVG có màu theo id, giữ tỉ lệ theo media, kích thước theo `?w=`.

`server/src/routes/`:
- `feed-routes.ts`: `GET /api/feed`, `GET /api/feed-offset`. Response đặt `Cache-Control: private, no-store`.
- `post-routes.ts`: `GET /api/posts/:id`, `POST /api/posts` (bắt buộc header `Idempotency-Key`, validate body ≤ 5000 ký tự và các `mediaIds` phải tồn tại).
- `reaction-routes.ts`: `PUT` và `DELETE /api/posts/:id/reaction`. Validate `ReactionType`. Trả `{ engagementSummary, viewerReaction }`.
- `media-routes.ts`
  - `POST /api/media/uploads`: nhận `express.raw({ type: 'image/*', limit: '5mb' })` → `{ mediaId, width, height, src }`.
  - `GET /media/:id`: ảnh đã upload trả bytes gốc, ảnh seed trả SVG.
- `mock-control-routes.ts`: `GET` và `POST /__mock/config`, `POST /__mock/insert-new-posts?n=`, `POST /__mock/reset`.
- `server/src/services/new-post-simulator.ts`: timer gọi `insertNewPosts` theo config.

Dùng chung giữa server và client:
- `shared-contracts/feed-api-contracts.ts`: các type Post, User, Media, ReactionType, FeedPage, NormalizedFeedResponse, CreatePostRequest. Cả `server` lẫn `src` cùng import file này, để thấy "Interface" là hợp đồng giữa hai bên.

Tests (Vitest, gọi `fetch` thật vào `createApp().listen(0)`):
- `server/src/services/feed-cursor-codec.test.ts`.
- `server/src/services/feed-query-service.test.ts`
  - Lật hết các trang không có bài trùng hay bị sót.
  - Chèn bài mới giữa chừng thì cursor vẫn đúng.
- `server/src/routes/api-routes.integration.test.ts`
  - Đổi reaction thì count đúng.
  - `POST /api/posts` hai lần cùng key → chỉ có 1 post, request sau có header `Idempotent-Replayed`.
  - Cursor hỏng → 400.

## Tasks & Steps
1. Thêm dependencies: `express@5`, `@types/express`, `tsx`, `concurrently`. Thêm các script `dev:server`, `dev:web`, `dev`.
2. Viết contracts, data, services, middleware, routes theo thứ tự trên.
3. Viết test rồi chạy.
4. Thêm `server/README.md`: bảng endpoint, ví dụ `curl` và giải thích từng quyết định thiết kế.

## Verification
- `npm run test` pass.
- `npm run dev:server`, sau đó:
  - `curl -i localhost:3001/api/feed?count=3` trả 200, có `Cache-Control: private`, có `olderCursor`.
  - `curl -X POST localhost:3001/__mock/config -d '{"failRate":1}' -H 'content-type: application/json'`, rồi gọi `/api/feed` → 503 kèm `Retry-After`.
- Tắt server sau khi kiểm tra.
