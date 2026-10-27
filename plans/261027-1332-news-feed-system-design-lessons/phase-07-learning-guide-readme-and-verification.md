---
phase: 7
title: "Learning guide + README + kiểm thử tổng"
status: completed
priority: P2
effort: "1.5h"
dependencies: [1, 3, 4, 5, 6]
---

# Phase 7: Learning guide + README + kiểm thử tổng

## Goal
Có tài liệu dẫn đường học, và toàn bộ project pass các bước kiểm tra.

## Files to Create
- `README.md`: cách chạy (backend + frontend), cấu trúc thư mục, thứ tự học, script. Link tới `server/README.md`.
- `docs/learning-guide.md`
  - Bảng RADIO: mỗi mục gồm khái niệm, lesson, file frontend, file backend, và "Cần quan sát gì" (UI và log terminal).
  - Mỗi lesson có 3–5 câu hỏi phỏng vấn tự kiểm tra kèm đáp án gợi ý.
  - Phần "Không có code, chỉ lý thuyết": SSR so với CSR, Service Worker/offline/outbox, live updates (polling/SSE/WebSocket), telemetry/RUM, tiered JS loading, `BroadcastChannel` cross-tab, i18n RTL.

## Tasks & Steps
1. Viết README và learning guide.
2. Chạy `npm run typecheck && npm run test && npm run build`.
3. Chạy dev server rồi smoke-check bằng curl các endpoint. Mở từng lesson (agent-browser nếu có) và xác nhận không có lỗi console.
4. Tắt dev server sau khi kiểm tra.

## Verification
- Cả 3 lệnh pass. Mọi đường dẫn file được nhắc trong guide đều tồn tại (`grep` đối chiếu).
