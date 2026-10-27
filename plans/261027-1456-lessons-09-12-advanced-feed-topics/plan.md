---
title: "Lesson 09–12: feed list nâng cao, lazy-load, telemetry, resilience/offline"
description: "Thêm 4 lesson phủ nốt các mục còn thiếu của bài News Feed (GreatFrontEnd), kèm bảng đối chiếu độ bao phủ trong learning guide."
status: pending
priority: P2
effort: 15h
tags: [feature, frontend, backend, api, docs]
blockedBy: []
blocks: []
created: 2026-10-27
---

# Lesson 09–12: feed list nâng cao, lazy-load, telemetry, resilience/offline

## Overview
Plan này phủ nốt các mục ❌ và 🟡 trong report `plans/reports/brainstorm-261027-2057-article-coverage-audit.md`. Ở đó người dùng đã chọn viết code cho cả 4 nhóm. Codebase hiện tại là nền:
- Frontend: React 18 + TS. Store tự viết; đã có `useFeedLoader` (tự quản sentinel), `ReactionFeedStoreProvider`, `FeedPostArticle`, `usePostView`, `LatestIntentQueue`.
- Backend: Express 5 + PostgreSQL + Drizzle ORM. Migration do `npm run db:generate` sinh.

## Kết quả cần có
| Lesson | Nội dung |
|---|---|
| 09 Feed list nâng cao | Giữ vị trí scroll khi rời feed rồi quay lại (neo theo id bài + độ lệch). Feed cũ: nhắc tải lại dựa trên `lastFetchedAt`. Đồng bộ reaction giữa các tab bằng `BroadcastChannel`. Gộp các GET trùng nhau đang bay. Giữ focus khi virtualize, phím Page Up/Down theo WAI-ARIA feed pattern |
| 10 Lazy-load code & JS tiers | Reaction menu và hover card tác giả tải lười, có prefetch khi hover, focus hoặc lúc trình duyệt rảnh. Renderer theo loại bài (mô phỏng Relay `@match`/`@module`), prefetch theo trang đầu. Composer tự sinh entity ranges cho #hashtag/@mention (model nội bộ khác wire format, chuẩn hoá NFC). Chặn paste HTML. Emoji picker tải lười |
| 11 Đo lường & telemetry | LCP, CLS, INP (gần đúng) và long task đo bằng `PerformanceObserver`, so với budget. Đếm lượt hiển thị (≥50% trong 1 giây, không đếm trùng, kèm dwell time), gửi theo lô bằng `sendBeacon` khi `visibilitychange`/`pagehide` tới `POST /api/telemetry`, lưu DB. `Intl.ListFormat` ("An, Bình và 3 người khác") |
| 12 Resilience & offline | Session hết hạn: gặp 401 thì làm mới token một lần (gộp các request cùng lúc) rồi retry. Xử lý 404 tuỳ endpoint (bài đã bị xoá). Outbox ghi offline trong IndexedDB, tách theo tài khoản, gửi lại khi có mạng với cùng idempotency key. Service Worker: ảnh cache-first, feed stale-while-revalidate, thao tác ghi luôn qua mạng; Background Sync chỉ là hỗ trợ thêm |

## Ràng buộc
- Giữ stack và cách tổ chức lesson. Mỗi lesson một thư mục `src/lessons/0X-*`. Logic dùng chung đặt ở `src/shared`.
- Thay đổi hợp đồng API chỉ được **thêm**, không phá: thêm field tuỳ chọn và endpoint mới. Lesson 01–08 phải chạy như cũ.
- Thay đổi schema DB đi qua `npm run db:generate` (migration 0001). Phải `npm run db:backup` trước khi áp.
- Service Worker chỉ đăng ký trong lesson 12, có nút gỡ đăng ký kèm xoá cache. Ở dev, request điều hướng dùng network-first để không phá Vite HMR. Guide ghi rõ bản production thì app shell dùng cache-first.
- Comment tiếng Việt, theo đúng pattern hiện có.

## Ngoài phạm vi
- Comments, live update qua SSE/WebSocket, so sánh các cách hiển thị icon, Web Worker và `scheduler.postTask`, Sentry/feature flag, SSR thật, AVIF/BlurHash. Các mục này chỉ giải thích trong guide.
- Upload ảnh khi offline. Bài viết nói ảnh cần một vòng đời upload riêng; lesson 12 chỉ đưa bài chữ vào outbox, và guide giải thích vì sao.

## Phases
| # | Phase | Status | Effort | Phụ thuộc |
|---|-------|--------|--------|-----------|
| 1 | [Backend + hợp đồng API cho 09–12](./phase-01-backend-contracts-and-migration.md) | Pending | 3h | — |
| 2 | [Lesson 09: feed list nâng cao](./phase-02-lesson-09-advanced-feed-list.md) | Pending | 3h | 1 |
| 3 | [Lesson 10: lazy-load code, JS tiers, composer entity](./phase-03-lesson-10-lazy-loading-and-composer-entities.md) | Pending | 3h | 1 |
| 4 | [Lesson 11: đo lường và telemetry](./phase-04-lesson-11-metrics-and-telemetry.md) | Pending | 2.5h | 1 |
| 5 | [Lesson 12: resilience và offline](./phase-05-lesson-12-resilience-and-offline.md) | Pending | 3h | 1 |
| 6 | [Guide độ bao phủ + kiểm chứng tổng](./phase-06-coverage-guide-and-verification.md) | Pending | 0.5h | 2, 3, 4, 5 |

Phase 2–5 độc lập với nhau, chỉ phụ thuộc phase 1. Chúng có chạm chung vài file (`lesson-registry.ts`, `feed-post-article.tsx`, `http-client.ts`), nên nếu chạy song song thì mỗi phase chỉ được sửa đúng những phần đã ghi trong file phase của nó.

## Tiêu chí hoàn thành
- [ ] `npm run typecheck`, `npm run test` và `npm run build` đều pass. Có test mới cho: gộp request trùng, tính anchor khi scroll, parser entity, bộ đếm lượt hiển thị, outbox, làm mới token khi gặp 401, và API telemetry.
- [ ] Smoke test trên Chrome thật (CDP), không lỗi console, cho từng lesson:
  - 09: mở chi tiết bài rồi quay lại thì về đúng bài đang đọc (lệch không quá 5px). Hai tab đồng bộ reaction trong vòng 1 giây. Hai component cùng đọc một bài chỉ tạo 1 request.
  - 10: chunk của reaction menu chỉ tải khi hover. Bài đăng có #tag hoặc @mention được server lưu thành entity.
  - 11: terminal backend in các lô lượt hiển thị; bảng `telemetry_events` có dữ liệu; panel hiện số đo LCP/CLS/INP.
  - 12: bật offline rồi đăng bài thì bài vào outbox; có mạng lại thì gửi đúng một lần (DB có đúng 1 bài). Hết hạn session thì 1 lần refresh, request vẫn thành công. Khi Service Worker đang bật và offline, feed vẫn hiện dữ liệu đã cache.
- [ ] Lesson 01–08 không bị ảnh hưởng: chạy lại các script CDP cũ vẫn đạt.
- [ ] `docs/learning-guide.md` có bảng liệt kê **mọi** mục trong bài, mỗi mục ghi lesson/file hoặc "chỉ lý thuyết".

## Rủi ro
| Rủi ro | Giảm thiểu |
|---|---|
| Service Worker cache code cũ khi dev | Chỉ chặn `/api/feed`, `/media/*` và request điều hướng (network-first). Có nút gỡ đăng ký và xoá cache. Đặt version trong tên cache |
| INP qua `PerformanceObserver` chỉ gần đúng (không có `web-vitals`) | Ghi rõ là ước lượng (lấy tương tác chậm nhất). Guide khuyên dùng thư viện `web-vitals` trong production |
| Thêm field mới vào `EngagementSummary`/`User` làm vỡ test cũ | Field là tuỳ chọn; dùng các hàm `createEmpty*` có sẵn |
| BroadcastChannel nhận patch cũ hơn state hiện tại | Patch mang `confirmedAt` do server trả; client bỏ qua patch cũ hơn bản đang có |
| 4 lesson cùng sửa `feed-post-article.tsx` | Phase 3 sở hữu phần reaction menu và hover card; phase 4 chỉ thêm dòng `ListFormat`. Không phase nào sửa phần của phase khác |

<!-- slug: lessons-09-12-advanced-feed-topics -->
