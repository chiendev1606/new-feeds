---
phase: 2
title: "Lesson 09: feed list nâng cao"
status: pending
priority: P2
effort: "3h"
dependencies: [1]
---

# Phase 2: Lesson 09 — feed list nâng cao

## Goal
Minh hoạ các mục trong phần "Feed list" của bài mà lesson 04/08 chưa có:
- Giữ vị trí scroll khi quay lại.
- Feed cũ (stale).
- Đồng bộ giữa các tab.
- Gộp request trùng.
- Giữ focus khi virtualize, và phím tắt theo WAI-ARIA feed pattern.

## Files
**Request dedup:**
- `src/shared/api/http-client.ts`: thêm cơ chế gộp. Các GET cùng URL đang bay dùng chung một Promise; xong thì xoá khỏi map. Chỉ áp cho GET không có `signal` riêng, hoặc có tuỳ chọn `dedupe: true`.
- Test cho phần này trong `http-client.test.ts`.

**Logic scroll restoration:**
- `src/lessons/09-advanced-feed-list/scroll-anchor.ts` (hàm thuần):
  - `captureScrollAnchor(itemRects, scrollY)` trả `{ postId, offsetPx }`, với postId là bài đầu tiên có đáy nằm dưới mép trên viewport.
  - `computeRestoreScrollTop(anchor, itemTopById)`.
- `scroll-anchor.test.ts`.

**State dùng lại khi quay lại feed:**
- `src/lessons/09-advanced-feed-list/use-scroll-restoration.ts`: lưu anchor vào ref của lesson (SPA: store còn sống) và `sessionStorage` (khi tải lại trang), kèm `generation` để bỏ anchor đã cũ. Khôi phục sau khi list đã render, dùng `useLayoutEffect`.

**Điều hướng trong lesson:**
- `src/lessons/09-advanced-feed-list/post-detail-view.tsx`: route con `#/lesson-09/post/:id`. Nhiều component trong trang cùng gọi `fetchPost(id)` để chứng minh dedup: Network chỉ có 1 request.
- `src/lessons/lesson-registry.ts`: `findLessonByHash` khớp tiền tố `lesson-09/`.

**Feed cũ:**
- `src/lessons/09-advanced-feed-list/use-stale-feed-prompt.ts`: khi `visibilitychange`/`focus` mà `now - lastFetchedAt > staleAfterMs` thì hiện "Feed đã cũ — Tải lại". Ngưỡng chỉnh được trong lesson (demo 30 giây; ghi chú production là vài giờ). Bấm tải lại thì chạy `loadPages('initial')` và xoá anchor.

**Đồng bộ giữa các tab:**
- `src/shared/sync/cross-tab-reaction-sync.ts`:
  - Một `BroadcastChannel('newsfeed')` tách theo viewerId.
  - Phát `{ type: 'reaction', postId, engagementSummary, viewerReaction, confirmedAt }` sau khi server xác nhận.
  - Nhận thì dispatch `entitiesMerged` nếu `confirmedAt` mới hơn bản đang có.
- Hook `useCrossTabReactionSync()`.
- `use-toggle-reaction.ts` gọi `publish` sau `reactionConfirmed`. Chỉ thêm đúng một dòng, không đổi hành vi.

**Focus + phím tắt:**
- `src/lessons/08-virtualization/virtualized-feed-list.tsx`:
  - Thêm tuỳ chọn `pinnedIndex`: bài đang có focus luôn được render dù đã ra ngoài vùng hiển thị, để không mất focus.
  - Thêm handler Page Down/Page Up trên `role="feed"` để focus article kế tiếp hoặc trước đó và cuộn tới (`scrollIntoView` tôn trọng reduced-motion).
  - Lesson 08 vẫn chạy như cũ.

**Trang lesson:**
- `src/lessons/09-advanced-feed-list/lesson-09-advanced-feed-list.tsx`:
  - Feed virtualized; bấm vào thời gian của bài thì mở trang chi tiết.
  - Panel hiện anchor đang lưu, tuổi của feed, và log BroadcastChannel.
  - Nút "Mở tab mới".

## Verification
- Unit test: dedup và scroll anchor.
- CDP:
  - Cuộn tới khoảng bài thứ 20, mở chi tiết, bấm Back: bài neo nằm cùng vị trí, lệch không quá 5px.
  - Mở 2 target cùng lúc, react ở tab A, tab B cập nhật trong vòng 1 giây.
  - Trang chi tiết: đếm request `/api/posts/:id` bằng `Network.requestWillBeSent` phải bằng 1.
  - Nhấn Page Down để focus bài kế tiếp, kể cả khi đã cuộn xa thì `document.activeElement` vẫn là article.
- Chạy lại script CDP của lesson 08.
