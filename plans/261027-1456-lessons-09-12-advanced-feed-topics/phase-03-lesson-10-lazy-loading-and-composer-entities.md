---
phase: 3
title: "Lesson 10: lazy-load code, JS tiers, composer entity"
status: pending
priority: P2
effort: "3h"
dependencies: [1]
---

# Phase 3: Lesson 10 — lazy-load code, JS tiers, composer entity

## Goal
Minh hoạ việc chỉ tải đúng phần JS đang cần:
- Code tương tác (reaction menu, hover card) tải lười.
- Renderer theo loại bài, giống ý tưởng Relay `@match`.
- Các cách prefetch: khi hover, focus, lúc trình duyệt rảnh, và theo dữ liệu trang đầu.

Đồng thời hoàn thiện composer: mention và hashtag thành entity thật, chuẩn hoá NFC, chặn paste HTML.

## Files
**Primitive tải lười:**
- `src/shared/lazy/lazy-with-preload.ts`:
  - `lazyWithPreload(factory)` trả component `React.lazy` kèm hàm `preload()`, dùng chung một Promise.
  - `preloadOnIdle(fn)` dùng `requestIdleCallback`, nếu trình duyệt không có thì dùng `setTimeout`.
  - Có test.

**Reaction menu tải lười:**
- `src/lessons/05-optimistic-reaction/reaction-menu.tsx` (mới): tách phần bảng 6 cảm xúc từ `reaction-picker.tsx` ra.
- `reaction-picker.tsx` render menu qua `lazyWithPreload`, gọi `preload()` khi `pointerenter`/`focus` vào nút ▾.
  - Hành vi và a11y của lesson 05/07 giữ nguyên.
  - `Suspense` fallback là một khung trống có kích thước cố định, để không nhảy layout.

**Hover card tác giả:**
- `src/lessons/10-lazy-loading/author-hover-card.tsx`: tải lười; hiện tên, handle và `relationshipToViewer` (Bạn bè / Đang theo dõi).
- `src/shared/post-rendering/feed-post-article.tsx`: tên tác giả bọc trong `AuthorName`. Mở card khi hover (sau 300ms) hoặc focus; Esc để đóng.

**Renderer theo loại bài:**
- `src/lessons/10-lazy-loading/post-renderer-registry.ts`:
  - `getPostKind(post)` phân loại `'photo' | 'link' | 'text'`.
  - Registry ánh xạ loại bài sang `lazyWithPreload(() => import('./renderers/…'))`.
  - `preloadRenderersFor(posts)` được gọi ngay khi trang đầu về, để tải code song song với dữ liệu (tránh waterfall tải dữ liệu xong mới tải code).
- `src/lessons/10-lazy-loading/renderers/{photo-post-renderer,link-post-renderer,text-post-renderer}.tsx`: phần thân bài theo từng loại, dùng lại `PostBodyText` và `PostMediaGrid`.

**Composer:**
- `src/lessons/10-lazy-loading/composer-entity-parser.ts`, `parseComposerText(text, usersByHandle)`:
  - Chuẩn hoá NFC trước.
  - Tìm `#tag` (chữ Unicode) và `@handle` khớp với user đã biết.
  - Trả về `{ text, entities }` theo offset UTF-16.
  - Có test: emoji, tiếng Việt có dấu, @handle không tồn tại, link http.
- `src/lessons/10-lazy-loading/entity-aware-composer.tsx`:
  - Dùng textarea, bên dưới có preview các entity bằng `PostBodyText`.
  - `onPaste`: chỉ lấy `text/plain`, bỏ ký tự điều khiển và zero-width, có log minh hoạ.
  - Nút 😊 mở `emoji-picker.tsx`, tải lười.
  - Khi gửi, dùng `createPost` với các entity đã parse và idempotency key; dùng lại `composer-draft-reducer`.
- `src/lessons/10-lazy-loading/emoji-picker.tsx`.

**Trang lesson:**
- `src/lessons/10-lazy-loading/lesson-10-lazy-loading.tsx`:
  - Feed dùng renderer registry.
  - Bảng "JS tiers": Tier 1 shell, Tier 2 renderer của các bài đầu tiên, Tier 3 menu/hover/emoji.
  - Bảng các chunk đã tải, đọc từ `performance.getEntriesByType('resource')` lọc `.js`, có thời điểm tải.

## Verification
- Unit test: parser và `lazyWithPreload`.
- CDP:
  - Trước khi hover, không có request tới chunk `reaction-menu`; sau `pointerenter` thì có.
  - Đăng bài "Chào @<handle> #frontend" thì response và DB có 2 entity.
  - Paste `text/html` (giả lập bằng `ClipboardEvent` có `DataTransfer`) thì chỉ còn chữ.
- Chạy lại script CDP của lesson 05/07.
