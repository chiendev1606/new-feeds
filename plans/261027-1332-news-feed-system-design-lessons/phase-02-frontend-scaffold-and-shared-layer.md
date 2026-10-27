---
phase: 2
title: "Frontend scaffold + shared layer"
status: completed
priority: P1
effort: "2h"
dependencies: [1]
---

# Phase 2: Frontend scaffold + shared layer

## Goal
Có app Vite chạy được, trang chọn lesson, cùng data-access và UI dùng chung. Mọi request đi qua proxy tới backend của phase 1.

## Files to Create
Root:
- `vite.config.ts`: plugin React, `server.proxy` cho `/api`, `/media`, `/__mock` → `http://localhost:3001`.
- `tsconfig.json`: strict, gồm `src`, `server`, `shared-contracts`.
- `index.html`.
- `package.json`: thêm `react`, `react-dom`, `vite`, `@vitejs/plugin-react`, `@types/react`, `@types/react-dom`. Phase 1 đã tạo file này.

`src/`:
- `main.tsx`, `app-lesson-picker.tsx`: đọc `location.hash`, render lesson qua `React.lazy` (minh hoạ code-split theo route).
- `shared/types/feed-entities.ts`: re-export từ `shared-contracts/feed-api-contracts.ts`, thêm các type chỉ dùng ở client (ví dụ `FeedState`).
- `shared/api/http-client.ts`
  - Hàm `request()`.
  - Retry có giới hạn, exponential backoff kèm jitter, tôn trọng `Retry-After`. Chỉ retry request GET hoặc request có idempotency key.
  - Throw `ApiError` (có status và code).
- `shared/api/feed-api.ts`: `fetchFeedPage`, `fetchFeedPageByOffset`, `setReaction`, `removeReaction`, `uploadMedia`, `createPost`.
- `shared/api/mock-control-api.ts`: `getConfig`, `updateConfig`, `insertNewPosts`, `resetDatabase`.
- `shared/ui/lesson-layout.tsx`: tiêu đề, mục RADIO, link tới bài, khối "Cần quan sát gì", gợi ý "xem log ở terminal backend", slot nội dung.
- `shared/ui/mock-control-panel.tsx`: slider độ trễ, tỉ lệ lỗi, tự sinh bài mới, nút chèn bài, nút reset.
- `shared/ui/post-card-basic.tsx`: card đơn giản dùng cho lesson 01–03.
- `shared/ui/post-skeleton.tsx`.
- `shared/styles/global.css`: CSS logical properties, token màu, dark mode.
- `src/lessons/lesson-registry.ts`: danh sách 8 lesson (id, title, radioSection, loader). Lesson chưa làm hiện "Sắp có".

## Tasks & Steps
1. Cài các dependency frontend.
2. Viết config, http-client, feed-api, UI dùng chung, picker.
3. Viết test `src/shared/api/http-client.test.ts`: tính backoff, có `Retry-After`, không retry POST thiếu idempotency key.

## Verification
- `npm run typecheck && npm run test`.
- `npm run dev` → `localhost:5173` hiện trang chọn lesson; panel mock đọc được config từ backend.
