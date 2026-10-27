---
phase: 5
title: "Lesson 06–07: composer upload, perf/a11y/ảnh/i18n"
status: completed
priority: P1
effort: "3h"
dependencies: [4]
---

# Phase 5: Lesson 06–07

## Goal
Composer với luồng upload ảnh rồi mới tạo post. Post card "production-grade" gom các tối ưu về render.

## Files to Create
Lesson 06:
- `src/lessons/06-composer-upload/composer-draft-reducer.ts`
  - State gồm `{ body, uploads: [{ localId, file, previewUrl, status, mediaId }], submitState, idempotencyKey }`.
  - Idempotency key được sinh lúc submit, giữ nguyên khi retry, reset sau khi thành công.
- `src/lessons/06-composer-upload/composer.tsx`
  - `<textarea>` có giải thích vì sao không tự viết `contenteditable`.
  - Chọn ảnh rồi upload song song, có thanh trạng thái. Preview dùng `URL.createObjectURL` và được revoke khi gỡ.
  - Chưa upload xong thì không cho submit.
- `src/lessons/06-composer-upload/lesson-06-composer-upload.tsx`
  - Post mới được chèn optimistic lên đầu feed với id tạm, sau đó thay bằng id thật.
  - Có nút "Gửi lại với cùng key" để chứng minh server không tạo trùng.
- `src/lessons/06-composer-upload/composer-draft-reducer.test.ts`.

Lesson 07 (shared, vì lesson 08 tái dùng):
- `src/shared/post-rendering/render-post-body-with-entities.tsx`
  - Cắt text theo UTF-16 offset, render mention/hashtag/link thành phần tử React (escape mặc định).
  - URL chỉ cho phép `http`, `https`, `mailto`. Link có `rel="noopener noreferrer"`.
- `src/shared/post-rendering/render-post-body-with-entities.test.tsx`: test offset có emoji, URL `javascript:` bị chặn.
- `src/shared/post-rendering/format-relative-time.ts`: dùng `Intl.RelativeTimeFormat`, kèm hook refresh mỗi 60 giây.
- `src/shared/post-rendering/format-compact-count.ts`: `Intl.NumberFormat` với notation compact (103K).
- `src/shared/post-rendering/responsive-post-image.tsx`
  - `srcset` theo `w`, `sizes`, `loading="lazy"`, `decoding="async"`.
  - `aspect-ratio` từ width/height, màu nền placeholder, `alt`.
- `src/shared/post-rendering/expandable-post-text.tsx`: "Xem thêm" bằng `line-clamp`, `dir="auto"`.
- `src/shared/post-rendering/feed-post-article.tsx`
  - `role="article"`, `aria-posinset`, `aria-setsize` (bằng -1 nếu chưa biết), `aria-labelledby`.
  - Ghép body, ảnh, reaction picker, thời gian.
- `src/lessons/07-perf-a11y-images/lesson-07-perf-a11y-images.tsx`
  - `role="feed"`, `aria-busy`, `aria-label`, skip link.
  - Bên cạnh có checklist "mở DevTools để kiểm tra" (Network lazy, CLS, accessibility tree).

## Verification
- `npm run test` pass.
- Thử tay: Network tab chỉ tải ảnh gần viewport. Layout không nhảy khi ảnh tải xong.
- Thử tay: Retry cùng một idempotency key → feed không có bài trùng.
