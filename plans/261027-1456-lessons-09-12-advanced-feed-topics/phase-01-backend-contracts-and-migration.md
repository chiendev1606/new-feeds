---
phase: 1
title: "Backend + hợp đồng API cho 09–12"
status: completed
priority: P1
effort: "3h"
dependencies: []
---

# Phase 1: Backend + hợp đồng API cho 09–12

## Goal
Thêm phần server và hợp đồng API mà 4 lesson cần. Mọi thay đổi chỉ là **thêm** (field tuỳ chọn, endpoint mới); lesson 01–08 không đổi.

## Files
**Sửa `shared-contracts/feed-api-contracts.ts`:**
- Thêm `User.relationshipToViewer?: { isFriend: boolean; isFollowing: boolean; isSelf: boolean }`.
- Thêm `EngagementSummary.sampleReactorIds?: string[]` (tối đa 2 người, dùng cho `Intl.ListFormat`).
- Thêm `ReactionResponse.confirmedAt: string` (ISO, dùng để đồng bộ giữa các tab).
- Thêm type `TelemetryEvent` (`impression` | `dwell` | `web-vital`), `TelemetryBatchRequest`, `TelemetrySummaryResponse`, `SessionInfo`.

**Sửa `server/src/data/database-schema.ts`, sinh migration 0001:**
- Bảng `follows(follower_id, followee_id)`, khoá chính kép; seed khoảng 10 quan hệ cho `user-1`.
- Bảng `telemetry_events(id serial, viewer_id, type, post_id null, value_ms null, name null, created_at)`, index trên `(type, created_at)`.

**Sửa `server/src/data/feed-repository.ts`:**
- `getUsersByIds(ids, viewerId?)` điền `relationshipToViewer` (một query join `follows`).
- `getReactionStats` trả thêm `sampleReactorIds`. Dùng `array_agg(user_id ORDER BY user_id) FILTER (...)` hoặc một query riêng, vẫn theo lô.
- Thêm `insertTelemetryEvents(viewerId, events)` (một câu INSERT nhiều dòng) và `getTelemetrySummary()` (top bài theo lượt hiển thị, giá trị p75 của từng web vital).
- `deletePost(id)`, chỉ dùng cho mock.

**Sửa `server/src/services/feed-query-service.ts`:** users của reactor mẫu phải có trong `users` của response chuẩn hoá.

**Route mới:**
- `server/src/routes/telemetry-routes.ts`:
  - `POST /api/telemetry`: nhận cả `application/json` lẫn body `text/plain` (vì `sendBeacon` gửi dạng đó); validate, tối đa 200 sự kiện mỗi lô; trả 204; log `📊 impressions=…` ra terminal.
  - `GET /api/telemetry/summary`.
- `server/src/routes/session-routes.ts`:
  - `GET /api/session/me` trả `{ viewerId }`.
  - `POST /api/session/refresh` cấp lại session, xoá trạng thái hết hạn.

**Sửa `server/src/middleware/fake-session-middleware.ts`:** viewer nằm trong `context.expiredSessions` thì `/api/*` trả 401 `SESSION_EXPIRED`. `/api/session/refresh` được miễn kiểm tra này.

**Sửa `server/src/routes/mock-control-routes.ts`:** thêm `POST /__mock/expire-session` và `POST /__mock/delete-post/:id`.

**Sửa `server/src/routes/post-routes.ts`:** body text phải đã ở dạng NFC (`text === text.normalize('NFC')`), nếu không trả 400 `TEXT_NOT_NFC`. Lý do: entity range tính trên text đã chuẩn hoá.

**Sửa `server/src/app-context.ts`:** thêm `expiredSessions: Set<string>`.

**Sửa `src/shared/api/feed-api.ts`:** thêm `fetchPost(id)`, `sendTelemetry(batch)` (dùng fetch kèm `keepalive`; riêng beacon thì gọi ở lesson 11), `getTelemetrySummary()`, `getSession()`, `refreshSession()`.

**Sửa `src/shared/api/mock-control-api.ts`:** thêm `expireSession()` và `deletePost(id)`.

**Sửa `src/lessons/lesson-registry.ts`:** thêm 4 lesson (component tạm "Sắp có").

**Sửa `src/shared/ui/lesson-layout.tsx`:** nút "Lesson sau" dựa trên `LESSONS.length` thay vì số 8 viết cứng.

## Steps
1. Chạy `npm run db:backup`, rồi sửa schema và chạy `npm run db:generate` để có `0001_*.sql`. Đọc lại file SQL vừa sinh.
2. Sửa contract, repository, routes và middleware.
3. Viết test:
   - `server/src/routes/api-routes.integration.test.ts`: telemetry nhận được cả JSON lẫn text/plain; summary; 401 rồi refresh rồi 200; text chưa NFC trả 400; reactor mẫu có trong `users`; `relationshipToViewer` được điền.
   - Seed đủ quan hệ `follows`.

## Verification
- `npm run typecheck && npm run test`.
- Restart server thì migration 0001 tự áp.
- `curl` các endpoint mới.
- Chạy lại script CDP smoke test của lesson 01–08 để chắc không vỡ gì.
