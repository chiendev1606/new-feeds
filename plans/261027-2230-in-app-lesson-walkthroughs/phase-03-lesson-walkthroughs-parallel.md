---
phase: 3
title: "Bài học lesson 01–12 (3 nhóm song song)"
status: completed
priority: P1
effort: "5h"
dependencies: [2]
---

# Phase 3: Nội dung bài học từng lesson

## Goal
Viết `docs/lessons/lesson-01.md` … `lesson-12.md` theo khung 7 phần, nhúng code thật, có sơ đồ, đúng với hành vi đã kiểm chứng.

## Chia nhóm (chạy song song, mỗi nhóm chỉ sửa file của mình)
| Nhóm | Lesson | Được thêm marker và comment trong |
|---|---|---|
| A | 01–04 | `src/lessons/01-*`…`04-*`, `docs/lessons/lesson-01..04.md` |
| B | 05–08 | `src/lessons/05-*`…`08-*`, `docs/lessons/lesson-05..08.md` |
| C | 09–12 | `src/lessons/09-*`…`12-*`, `docs/lessons/lesson-09..12.md` |

File dùng chung **chỉ được tham chiếu** qua marker mà phase 2 đã gắn. Nếu thiếu marker thì ghi vào báo cáo, không tự sửa file dùng chung; lead sẽ bổ sung.

## Nội dung tối thiểu mỗi lesson
- Đầu file: mục tiêu, kiến thức cần có trước, bản đồ file.
- 3–6 khái niệm. Mỗi khái niệm đủ khung 7 phần, ít nhất 1 directive `learn` có giải thích **từng bước**.
- Ít nhất 1 sơ đồ Mermaid khi lesson có luồng. Ví dụ: 02 so sánh offset với cursor khi có bài mới; 05 luồng optimistic → confirm/rollback, hàng đợi theo bài; 06 upload → tạo bài → idempotency; 08 spacer và range; 09 anchor và BroadcastChannel; 10 tier và waterfall; 11 vòng đời impression → lô → beacon; 12 outbox, Service Worker, refresh 401.
- "Lỗi hay gặp" lấy từ lịch sử thật của project. Nguồn: `plans/**/reports/code-review-*.md` và các ghi chú hoàn thành trong `plan.md`. Ví dụ: cache chiều cao bằng 0 và gap cộng hai lần (08), server ghi reaction sai thứ tự (05), bấm đúp làm trùng cursor (02), sentinel bị kẹt (04), sửa bài khi đang gửi tạo bài trùng (06), `DESC NULLS LAST` lệch index (backend).
- "Tự thử" ghi selector hoặc nút cụ thể đang có trong UI và kết quả mong đợi.
- Câu hỏi phỏng vấn: 4–6 câu mỗi lesson. Hợp nhất với câu hỏi đang có trong `docs/learning-guide.md` và mở rộng thêm.
- Tóm tắt 5 dòng ở cuối.

## Verification (mỗi nhóm)
- `npx vitest run src/shared/learn` pass cho các lesson của nhóm.
- `npx tsc --noEmit` pass.
