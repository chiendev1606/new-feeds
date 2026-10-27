---
phase: 4
title: "Lesson 04–05: infinite scroll, optimistic reaction"
status: completed
priority: P1
effort: "2.5h"
dependencies: [3]
---

# Phase 4: Lesson 04–05

## Goal
Minh hoạ các tối ưu trong phần O: tải liên tục khi cuộn, bài mới, và optimistic update.

## Files to Create
- `src/shared/hooks/use-intersection-sentinel.ts`
  - Bọc IntersectionObserver, có tham số `rootMargin` (mặc định `"100% 0px"`, tức prefetch trước khoảng 1 viewport).
- `src/shared/hooks/use-feed-loader.ts`
  - `loadOlder()` và `loadNewer()`, không gửi request song song, xử lý lỗi.
  - Kích thước trang đầu tính theo `innerHeight`.
- `src/lessons/04-infinite-scroll/new-posts-banner.tsx`
  - Polling `direction=newer` mỗi 15 giây.
  - Có bài mới thì hiện banner `aria-live="polite"`. Bấm vào thì prepend rồi cuộn lên đầu.
- `src/lessons/04-infinite-scroll/lesson-04-infinite-scroll.tsx`: feed dùng sentinel, skeleton khi đang tải, nút "Thử lại" khi lỗi.
- `src/lessons/05-optimistic-reaction/reaction-reducer-with-rollback.ts`
  - Các action `reactionOptimisticApplied({ postId, reaction, requestSeq, previous })`, `reactionConfirmed`, `reactionRolledBack`.
  - Lưu `latestSeqByPostId`. Response cũ (seq nhỏ hơn seq mới nhất) bị bỏ qua.
  - Response từ server là nguồn chân lý.
- `src/lessons/05-optimistic-reaction/reaction-picker.tsx`
  - Nút Like, mở picker 6 reaction khi hover hoặc focus.
  - Dùng `<button>` thật, có `aria-pressed`.
- `src/lessons/05-optimistic-reaction/use-toggle-reaction.ts`: gửi request PUT hoặc DELETE.
- `src/lessons/05-optimistic-reaction/lesson-05-optimistic-reaction.tsx`
  - Có toast lỗi.
  - Có "event log" hiển thị theo thời gian: optimistic → confirmed hoặc rollback.
- `src/lessons/05-optimistic-reaction/reaction-reducer-with-rollback.test.ts`: test apply, rollback khôi phục đúng count, response tới không theo thứ tự.

## Verification
- `npm run test` pass.
- Thử tay: độ trễ 2000ms, lỗi 100% → count tăng ngay, rồi rollback và hiện toast.
- Bấm nhanh liên tục → trạng thái cuối khớp với lần bấm cuối.
