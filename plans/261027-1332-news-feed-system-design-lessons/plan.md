---
title: "News Feed system design — 8 lesson học theo RADIO"
description: "Project React + TS + Vite gồm 8 lesson tăng dần, kèm backend Express minh hoạ, theo bài News Feed (Facebook) của GreatFrontEnd."
status: completed
priority: P2
effort: 16h
tags: [feature, frontend, backend, api, docs]
blockedBy: []
blocks: []
created: 2026-10-27
---

# News Feed system design — 8 lesson học theo RADIO

## Overview
Dựng project học từ thư mục trống, theo bài https://www.greatfrontend.com/questions/system-design/news-feed-facebook?format=system-design.

Mỗi lesson xây thêm đúng một khái niệm lên lesson trước. Comment trong code viết bằng tiếng Việt và trỏ về mục RADIO tương ứng. Backend Express độc lập (`server/`, cổng 3001) triển khai đúng phần API trong bài. Backend có độ trễ và lỗi giả điều khiển được, và in log mọi request ra terminal để người học quan sát.

Nguồn quyết định: `plans/reports/brainstorm-261027-2029-news-feed-learning-lessons.md`.

## Quyết định chính
- Stack: React 18 + TypeScript (strict) + Vite + Vitest. Không dùng thư viện state/query/router.
- Điều hướng bằng hash (`#/lesson-04`) để không cần router.
- Store tự viết bằng `useReducer`. Lesson 03 trở đi dùng store chuẩn hoá theo id.
- Code dùng chung đặt trong `src/shared/`. Mỗi lesson chỉ chứa phần khác biệt, để diff giữa các lesson dễ đọc.
- Backend: Express 5 + TypeScript (`tsx watch`). Dữ liệu in-memory, seed tất định. Vite proxy `/api`, `/media`, `/__mock` sang cổng 3001. `npm run dev` chạy cả hai bằng `concurrently`.
- Types API đặt ở `shared-contracts/`, dùng chung cho server và client (đây chính là hợp đồng "Interface").
- Ảnh seed là SVG do server tự sinh; ảnh upload lưu bytes trong bộ nhớ. Không cần mạng ngoài.
- Điều khiển mô phỏng (độ trễ, tỉ lệ lỗi, tự sinh bài mới, reset) qua `/__mock/*`.

## Kiến trúc
```
Browser (React SPA)
  View (lessons/*, shared/ui)  ──đọc──▶  Store (useReducer, normalized)
        │ dispatch                              ▲ merge normalized payload
        ▼                                       │
  Data access (shared/api: http-client, feed-api, retry, idempotency)
        │ fetch /api/*
        ▼
Vite dev server :5173 ── proxy ──▶ Express backend :3001 (server/)
        middleware: request-logger → fake-session → latency/failure → routes → error-handler
        routes: feed, posts, reactions, media, __mock
        services: feed-query (cursor), idempotency-store, engagement-summary, media-svg
        data: in-memory-database ← seed-data-generator
        shared-contracts/feed-api-contracts.ts  (dùng chung server + client)
```

## Phases
| # | Phase | Status | Effort | Phụ thuộc |
|---|-------|--------|--------|-----------|
| 1 | [Backend: Express feed API server](./phase-01-backend-express-feed-api-server.md) | Completed | 3h | — |
| 2 | [Frontend scaffold + shared layer](./phase-02-frontend-scaffold-and-shared-layer.md) | Completed | 2h | 1 |
| 3 | [Lesson 01–03: feed cơ bản, cursor pagination, normalized store](./phase-03-lessons-basic-feed-cursor-pagination-normalized-store.md) | Completed | 2.5h | 2 |
| 4 | [Lesson 04–05: infinite scroll, optimistic reaction](./phase-04-lessons-infinite-scroll-and-optimistic-reaction.md) | Completed | 2.5h | 3 |
| 5 | [Lesson 06–07: composer upload, perf/a11y/ảnh/i18n](./phase-05-lessons-composer-upload-and-perf-a11y-images.md) | Completed | 3h | 4 |
| 6 | [Lesson 08: virtualization](./phase-06-lesson-virtualization.md) | Completed | 1.5h | 4 |
| 7 | [Learning guide + README + kiểm thử tổng](./phase-07-learning-guide-readme-and-verification.md) | Completed | 1.5h | 1, 3, 4, 5, 6 |

## Success Criteria
- [x] `npm install && npm run dev` chạy cả backend (:3001) lẫn frontend (:5173). Cả 8 lesson đều chạy. Terminal backend in log mỗi request.
- [x] Integration test backend pass: phân trang bằng cursor không trùng hay sót bài khi có bài mới chèn vào; idempotency replay; cursor hỏng trả 400.
- [x] `npm run typecheck`, `npm run test` và `npm run build` đều pass.
- [x] Lesson 02: nút "chèn bài mới" làm offset pagination hiện bài trùng (được highlight), còn cursor pagination thì không bị.
- [x] Lesson 05: bật tỉ lệ lỗi 100% thì reaction hiện ngay, sau đó rollback và hiện toast lỗi.
- [x] Lesson 06: gửi lại cùng một idempotency key không tạo thêm post trùng.
- [x] Lesson 08: DevTools chỉ thấy khoảng 10 `article` trong DOM dù đã tải hơn 100 post.
- [x] `docs/learning-guide.md` nối được mọi mục RADIO với file code tương ứng.

## Rủi ro
- Lặp code giữa các lesson. Giảm thiểu: đưa phần chung vào `src/shared`; lesson chỉ import và mở rộng.
- Virtualization có chiều cao thay đổi (ảnh, "See more") dễ làm nhảy scroll. Giảm thiểu: giữ sẵn `aspect-ratio` cho ảnh, dùng `ResizeObserver` cập nhật cache chiều cao, và neo scroll theo post đầu tiên đang hiển thị.

## Ngoài phạm vi
Ranking, ads, auth thật, deploy, Service Worker/offline, live comment, rich-text editor library. Các phần này chỉ giải thích trong guide.

<!-- slug: news-feed-system-design-lessons -->

## Ghi chú hoàn thành (2026-10-27)
- Code review (`reports/code-review-261027-news-feed-lessons.md`) phát hiện 1 lỗi critical, 2 high, 4 medium. Đã sửa tất cả, cùng phần lớn lỗi low:
  - Lesson 08: cache chiều cao bị ghi 0 và gap bị cộng hai lần.
  - Lesson 05: server ghi reaction sai thứ tự → gửi tuần tự theo từng bài.
  - Lesson 06: khoá chỉnh sửa composer khi đang gửi.
  - Server: validate entity.
  - Lesson 02/03/08: guard chống tải trùng và xử lý lỗi.
- Đã kiểm chứng trên Chrome thật, có đối chiếu với DB.
- Backend đã chuyển sang PostgreSQL, xem plan `261027-2107-postgres-docker-backend`.
- Chưa làm: ESLint (review L16), phím Page Up/Down theo WAI-ARIA feed pattern (đã ghi trong comment).
