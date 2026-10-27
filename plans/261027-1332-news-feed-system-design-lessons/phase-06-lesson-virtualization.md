---
phase: 6
title: "Lesson 08: virtualization"
status: completed
priority: P2
effort: "1.5h"
dependencies: [4]
---

# Phase 6: Lesson 08 — virtualization

## Goal
Tự viết windowing cho list có chiều cao thay đổi, để thấy cơ chế mà các thư viện thường che đi.

## Files to Create
- `src/lessons/08-virtualization/compute-visible-range.ts`
  - Hàm thuần: nhận `heights[]`, `estimatedHeight`, `scrollTop`, `viewportHeight`, `overscan`.
  - Trả `{ startIndex, endIndex, topSpacer, bottomSpacer }`.
- `src/lessons/08-virtualization/compute-visible-range.test.ts`.
- `src/lessons/08-virtualization/use-measured-item-heights.ts`: dùng `ResizeObserver` cập nhật cache chiều cao theo post id.
- `src/lessons/08-virtualization/virtualized-feed-list.tsx`
  - Cấu trúc: spacer trên, các item hiển thị, spacer dưới.
  - Neo scroll khi item phía trên đổi chiều cao.
  - Sentinel infinite scroll đặt cuối list.
- `src/lessons/08-virtualization/lesson-08-virtualization.tsx`
  - Toggle bật/tắt virtualization.
  - Có bộ đếm "số `article` trong DOM" (MutationObserver hoặc đếm qua `querySelectorAll`).
  - Ghi chú các đánh đổi: Ctrl+F không tìm thấy post ngoài DOM, focus bị mất khi item bị unmount, và phương án `content-visibility: auto`.

## Verification
- `npm run test` pass.
- Thử tay: tải hơn 100 post, bộ đếm DOM giữ khoảng 10–15. Cuộn không giật, không nhảy.
