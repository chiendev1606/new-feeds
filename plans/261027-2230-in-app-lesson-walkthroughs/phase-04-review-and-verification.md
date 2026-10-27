---
phase: 4
title: "Review nội dung + kiểm chứng"
status: completed
priority: P1
effort: "1h"
dependencies: [3]
---

# Phase 4: Review + kiểm chứng

## Steps
1. Bỏ allowlist marker mồ côi; test kiểm tra doc phải pass ở chế độ nghiêm ngặt.
2. Spawn code-reviewer đối chiếu phần lời với code:
   - giải thích từng bước có đúng không;
   - "Tự thử" làm theo được không;
   - có chép nguyên văn bài viết không;
   - thuật ngữ có nhất quán không.
3. Smoke test CDP cho 12 lesson:
   - tab Bài học render không lỗi, có ít nhất 1 khối code thật và ít nhất 1 sơ đồ ở các lesson có luồng;
   - chuyển tab Demo ↔ Bài học vẫn giữ nguyên state của demo;
   - chỉ xem Demo thì không có chunk `marked`/`mermaid`;
   - các script CDP cũ vẫn đạt.
4. Cập nhật `docs/learning-guide.md` (link tới `docs/lessons/*`) và README (mục "Cách học").

## Verification
Typecheck, test và bản production đều pass; CDP không có lỗi console.
