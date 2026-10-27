---
title: "Tab 'Bài học' trong app + docs/lessons cho 12 lesson"
description: "Bài giảng chi tiết bám sát code: markdown theo lesson, nhúng đoạn code thật qua marker #region learn:, hiển thị trong app ở tab Bài học."
status: completed
priority: P2
effort: 11h
tags: [docs, frontend, feature]
blockedBy: [261027-1456-lessons-09-12-advanced-feed-topics]
blocks: []
created: 2026-10-27
---

# Tab "Bài học" trong app + docs/lessons cho 12 lesson

## Overview
Phạm vi đã chốt trong `plans/reports/brainstorm-261027-2215-in-app-lesson-walkthroughs.md`: người dùng chọn tab "Bài học" trong app kèm doc. Mục tiêu là mỗi khái niệm của mỗi lesson đi theo cùng một khung 7 phần, đoạn code được nhúng từ source nên không bao giờ lệch khỏi code thật, và luồng phức tạp có sơ đồ.

**Phụ thuộc:** chờ plan lesson 09–12 hoàn tất (review xong và đã sửa các phát hiện), để không thêm marker vào code còn đang sửa.

## Quy ước (áp dụng cho mọi phase)
- **Marker trong code:** `// #region learn:<id>` … `// #endregion learn:<id>`. Trong TSX, nếu nằm giữa JSX thì dùng `{/* #region learn:<id> */}`. `<id>` viết kebab-case và duy nhất trong mỗi file.
- **Comment trỏ tới bài học:** đặt ngay trên region, dạng `// 📖 Bài học lesson-02 §2 – vì sao cursor (docs/lessons/lesson-02.md)`.
- **Directive trong markdown:** một code block có ngôn ngữ `learn`, nội dung là `<path>#<id>`, ví dụ `server/src/data/feed-repository.ts#cursor-older`. Directive này render thành đoạn code thật có tô màu cú pháp, ghi tên file, số dòng và link mở trên GitHub.
- **Sơ đồ:** code block ngôn ngữ `mermaid`.
- **Khung cho mỗi khái niệm** (các heading bắt buộc, có test kiểm tra):
  - `## <số>. <Tên khái niệm>`
  - `### Trong bài viết`: diễn giải lại kèm link tới mục của bài. **Không chép nguyên văn đoạn dài.**
  - `### Code thật`: một hoặc nhiều directive `learn`, mỗi directive kèm giải thích từng bước.
  - `### Vì sao làm vậy`: kèm bảng so sánh các cách khác và đánh đổi.
  - `### Lỗi hay gặp`: kèm lỗi thật đã gặp trong project nếu có.
  - `### Tự thử`: các bước trên app, DevTools hoặc terminal, và kết quả mong đợi.
  - `### Câu hỏi phỏng vấn`: kèm đáp án gợi ý.
- **Đầu mỗi file** có: mục tiêu của lesson, kiến thức cần có trước, bản đồ file (bảng), và tóm tắt 5 dòng ở cuối.

## Phases
| # | Phase | Status | Effort | Phụ thuộc |
|---|-------|--------|--------|-----------|
| 1 | [Hạ tầng: loader, renderer, tab, test kiểm tra doc](./phase-01-learning-infrastructure.md) | Completed | 3h | — |
| 2 | [Marker + bài học phần dùng chung (backend, data access, hooks)](./phase-02-shared-and-backend-walkthrough.md) | Completed | 2h | 1 |
| 3 | [Bài học lesson 01–12 (3 nhóm song song)](./phase-03-lesson-walkthroughs-parallel.md) | Completed | 5h | 2 |
| 4 | [Review nội dung + kiểm chứng](./phase-04-review-and-verification.md) | Completed | 1h | 3 |

## Tiêu chí hoàn thành
- [x] Có đủ 12 file `docs/lessons/lesson-XX.md` và `docs/lessons/shared-foundations.md`. Mỗi khái niệm chính có đủ khung 7 phần; lesson nào có luồng thì có ít nhất 1 sơ đồ Mermaid.
- [x] Test `src/shared/learn/lesson-docs.test.ts` pass:
  - mọi directive trỏ tới file và region có thật;
  - đủ heading bắt buộc;
  - không có marker mồ côi (region trong code mà không doc nào dùng);
  - không có `#region` thiếu `#endregion`.
- [x] Trong app, `#/lesson-XX` có tab "Demo" và "Bài học". Tab Bài học hiện markdown, code thật có tô màu và sơ đồ. Chuyển tab không làm mất state của demo. Network cho thấy chunk markdown/mermaid/highlight **không tải** khi chỉ xem Demo.
- [x] Typecheck, test và bản đóng gói production đều pass. Smoke test CDP 12 lesson (cả 2 tab) không có lỗi console. Script CDP cũ không chạy lại vì chúng gọi `/__mock/reset` (xem mục Kết quả).

## Rủi ro
| Rủi ro | Giảm thiểu |
|---|---|
| Nhiều agent cùng thêm marker vào file dùng chung | Phase 2 là chủ sở hữu duy nhất của file dùng chung (`server/**`, `shared-contracts/**`, `src/shared/**`). Phase 3 chỉ tham chiếu marker có sẵn và chỉ thêm marker trong thư mục lesson của nhóm mình |
| Mermaid làm bundle nặng (khoảng 1MB) | Tải lười khi mở tab Bài học; có thêm prefetch khi hover vào tab |
| Nội dung sai so với code | Code được nhúng thật; phase 4 có reviewer đối chiếu phần lời |
| Vi phạm bản quyền bài GreatFrontEnd | Chỉ diễn giải lại kèm link; reviewer kiểm tra |

## Kết quả (2026-10-27)
- Có 13 bài: `docs/lessons/lesson-01..12.md` và `shared-foundations.md`. Tổng cộng 284 khối code thật và 25 sơ đồ Mermaid. Reviewer đã sửa 24 lỗi nội dung.
- `STRICT_ORPHANS = true`, `npx vitest run src/shared/learn` pass 35/35. Typecheck sạch, 237 test pass, bản production build được.
- Smoke CDP cho 12 lesson đạt: tab Bài học render code và sơ đồ, không lỗi console; chỉ xem Demo thì không tải marked/mermaid/highlight; chuyển tab thì demo vẫn hiện. Tab Bài học có thêm nút "📚 Nền tảng dùng chung".
- Không chạy lại script CDP cũ vì chúng gọi `/__mock/reset`, sẽ xoá dữ liệu của người học. Code chỉ thêm comment và marker.
