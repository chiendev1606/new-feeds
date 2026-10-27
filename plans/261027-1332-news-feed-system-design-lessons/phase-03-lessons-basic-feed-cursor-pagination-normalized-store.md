---
phase: 3
title: "Lesson 01–03: feed cơ bản, cursor pagination, normalized store"
status: completed
priority: P1
effort: "2.5h"
dependencies: [2]
---

# Phase 3: Lesson 01–03

## Goal
Ba lesson nền, tương ứng R + A, I (pagination) và D (data model).

## Files to Create
- `src/lessons/01-basic-feed/lesson-01-basic-feed.tsx`
  - Fetch trang đầu một lần rồi render bằng `post-card-basic`.
  - Comment chỉ rõ 4 layer (View / Store bằng `useState` / Data access / Server) và các Requirements trong bài.
- `src/lessons/02-cursor-pagination/lesson-02-cursor-pagination.tsx`
  - Hai cột song song: offset và cursor, mỗi cột có nút "Tải thêm".
  - Nút "Chèn 3 bài mới lên đầu" gọi `__mock/insert-new-posts`.
  - Bài trùng id trong cột offset được highlight đỏ, kèm bộ đếm trùng.
- `src/lessons/02-cursor-pagination/find-duplicate-post-ids.ts` và test đi kèm.
- `src/lessons/03-normalized-store/feed-store-reducer.ts`
  - State gồm `{ postsById, usersById, mediaById, feed: { postIds, olderCursor, newerCursor, hasOlder, hasNewer, generation, lastFetchedAt } }`.
  - Actions: `feedPageReceived(direction)`, `entitiesMerged`.
  - Merge entity theo id, khử trùng `postIds`.
- `src/lessons/03-normalized-store/feed-store-context.tsx`
  - Provider cùng các hook `useFeedStore`, `usePost(id)`, `useUser(id)`.
  - Các lesson sau sẽ tái dùng file này.
- `src/lessons/03-normalized-store/lesson-03-normalized-store.tsx`
  - Render feed từ store. Bên cạnh có panel "Store inspector" hiện JSON của store.
  - Có demo: đổi tên một user ở một chỗ thì mọi post của user đó cập nhật theo.
- `src/lessons/03-normalized-store/feed-store-reducer.test.ts`: test merge, khử trùng, và thứ tự khi `direction=newer` (prepend).

## Verification
- `npm run test` pass.
- Thử tay lesson 02: bộ đếm trùng của cột offset lớn hơn 0, cột cursor luôn bằng 0.
