---
phase: 6
title: "Guide độ bao phủ + kiểm chứng tổng"
status: pending
priority: P2
effort: "0.5h"
dependencies: [2, 3, 4, 5]
---

# Phase 6: Guide độ bao phủ + kiểm chứng tổng

## Goal
Người học tra được mọi mục trong bài đang nằm ở lesson hay file nào, hoặc chỉ có lý thuyết. Toàn bộ project pass kiểm tra.

## Files
**`docs/learning-guide.md`:**
- Thêm mục "Bảng độ bao phủ". Mỗi heading của bài (Requirements → Telemetry) là một dòng, ghi ✅ kèm lesson/file hoặc 📘 chỉ lý thuyết.
- Thêm câu hỏi tự kiểm tra cho lesson 09–12.
- Chuyển các mục giờ đã có code ra khỏi phần "Chỉ lý thuyết", gồm offline, BroadcastChannel, telemetry và JS tiers.

**`README.md`:** thêm 4 dòng vào bảng lộ trình học.

**`server/README.md`:** bảng endpoint thêm telemetry, session, mock expire/delete.

## Steps
1. Cập nhật docs, rồi dùng grep để chắc mọi đường dẫn file nhắc trong docs đều tồn tại.
2. Chạy `npm run typecheck && npm run test && npm run build`.
3. Chạy toàn bộ script CDP: cũ (01–08) và mới (09–12).
4. Spawn code-reviewer độc lập, rồi xử lý các phát hiện.
5. Tắt dev server và gỡ Service Worker trong profile test.

## Verification
- Mọi tiêu chí hoàn thành trong `plan.md` đều được tick, kèm bằng chứng (lệnh đã chạy và kết quả).
