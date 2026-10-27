---
phase: 5
title: "Lesson 12: resilience và offline"
status: pending
priority: P2
effort: "3h"
dependencies: [1]
---

# Phase 5: Lesson 12 — resilience và offline

## Goal
Minh hoạ phần "Networking, resilience, offline" của bài:
- Làm mới session một lần khi gặp 401.
- Xử lý 404 tuỳ endpoint.
- Outbox cho thao tác ghi khi offline.
- Service Worker cho việc đọc khi offline, kèm Background Sync ở mức hỗ trợ thêm.

## Files
**Làm mới session:**
- `src/shared/api/http-client.ts`:
  - Gặp 401 với code `SESSION_EXPIRED` thì gọi `refreshSession()` **đúng một lần**, dùng single-flight để nhiều request cùng lúc chỉ refresh một lần, rồi retry request gốc.
  - Refresh lỗi thì ném `ApiError` 401 `REAUTH_REQUIRED`.
  - Không áp cho chính request refresh.
- Test trong `http-client.test.ts`: 3 request đồng thời cùng nhận 401 thì có 1 lần refresh và 3 lần retry thành công.

**Xử lý 404 tuỳ endpoint:**
- `src/lessons/12-resilience-offline/handle-not-found.ts`:
  - React vào bài đã bị xoá thì 404 → dispatch `postRemoved`, toast "Bài viết không còn tồn tại".
  - GET chi tiết bài trả 404 thì hiện trạng thái "đã xoá".
  - GET feed trả 404 thì coi là lỗi bình thường.

**Outbox offline:**
- `src/shared/offline/indexed-db-store.ts`: wrapper IndexedDB tối giản dựa trên Promise (`get`, `put`, `delete`, `getAll`); tên DB tách theo viewerId.
- `src/shared/offline/post-outbox.ts`:
  - Mỗi mục `{ idempotencyKey, payload, createdAt, attempts, lastError }`.
  - `enqueue`, `flush` (gửi tuần tự cùng key, xoá khi 2xx hoặc gặp lỗi 4xx không thể retry), `list`.
  - Có cờ chống flush hai lần cùng lúc.
  - Ghi chú: ảnh không vào outbox (bài viết nói ảnh cần vòng đời upload riêng).
- `post-outbox.test.ts`: dùng store in-memory thay IndexedDB qua interface.
  - Retry giữ nguyên key.
  - Thành công thì xoá mục.
  - Gặp 4xx thì giữ mục kèm lỗi.

**Theo dõi trạng thái mạng:**
- `src/shared/offline/use-online-status.ts`: theo dõi `online`/`offline`.

**Service Worker:**
- `public/sw.js` (JS thuần, không qua bundler), cache có version `newsfeed-v1-*`:
  - `/media/*`: cache-first.
  - `GET /api/feed`: stale-while-revalidate. Response từ cache có header `X-From-SW-Cache: 1` để UI hiện "dữ liệu cũ".
  - Request điều hướng: network-first, rơi về `/` đã cache (ở dev không cache module của Vite).
  - Request không phải GET: luôn qua mạng.
  - Sự kiện `sync` (tag `flush-outbox`): `postMessage` tới các client để chúng flush.
  - Nhận message `clear-caches`.
- `src/lessons/12-resilience-offline/service-worker-controls.tsx`: các nút Đăng ký / Gỡ đăng ký + xoá cache, hiện trạng thái `navigator.serviceWorker.controller`. Chỉ hoạt động khi trình duyệt hỗ trợ.

**Trang lesson:**
- `src/lessons/12-resilience-offline/lesson-12-resilience-offline.tsx`:
  - Banner online/offline.
  - Composer chữ: khi offline (hoặc lỗi mạng), bài vào outbox và hiện như một bài tạm "⏳ chờ mạng". Có mạng lại thì flush, rồi thay bài tạm bằng bài thật.
  - Khi online lại: đăng ký Background Sync nếu trình duyệt hỗ trợ, đồng thời vẫn có vòng lặp flush trong tab (đây mới là cách đảm bảo đúng).
  - Danh sách outbox.
  - Các nút "Hết hạn session" (`/__mock/expire-session`) và "Xoá bài đầu tiên ở server" (`/__mock/delete-post`).
  - Log refresh và retry.

## Verification
- Unit test: outbox, single-flight refresh.
- CDP:
  - `Network.emulateNetworkConditions offline=true`, đăng bài: outbox có 1 mục. Bật mạng lại: outbox rỗng và DB có đúng 1 bài với text đó.
  - Hết hạn session rồi react: log có đúng 1 lần `POST /api/session/refresh`, reaction thành công.
  - Xoá bài ở server rồi react vào bài đó: bài biến khỏi feed, có toast.
  - Đăng ký SW, tải lại trang, rồi offline và tải lại: feed vẫn hiện từ cache, có banner "dữ liệu cũ". Sau đó gỡ đăng ký SW.
