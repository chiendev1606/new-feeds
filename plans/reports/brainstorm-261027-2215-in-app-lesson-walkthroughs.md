---
type: brainstorm
date: 2026-10-27
status: accepted
---

# Brainstorm: bài học chi tiết bám sát code (tab "Bài học" trong app + doc)

## Tóm tắt
Mỗi lesson 01–12 có một bài giảng viết song song với code: khái niệm, nội dung bài viết (diễn giải lại), **đoạn code thật**, vì sao, các cách khác, lỗi hay gặp, tự thử, câu hỏi phỏng vấn. Bài giảng nằm ở `docs/lessons/lesson-XX.md` và hiển thị trong app ở tab "Bài học", cạnh tab "Demo". Người dùng đã chọn hình thức này.

## Kết quả cần có
- **`docs/lessons/lesson-01.md` … `lesson-12.md`.** Mỗi khái niệm của lesson theo đúng khung sau:
  1. Khái niệm (1–2 câu).
  2. Trong bài viết nói gì: diễn giải lại kèm link tới mục của bài. Không chép nguyên văn đoạn dài, vì bài GreatFrontEnd có bản quyền.
  3. Code thật: nhúng từ source bằng marker, có giải thích từng dòng hoặc từng bước.
  4. Vì sao làm vậy, có cách nào khác, đánh đổi ra sao (bảng).
  5. Lỗi hay gặp: kèm cách project đã tránh, và lỗi thật đã gặp trong quá trình làm nếu có (vd cache chiều cao bằng 0 ở lesson 08, race reaction ở lesson 05).
  6. Tự thử: các bước cụ thể trên app, DevTools hoặc terminal, và kết quả mong đợi.
  7. Câu hỏi phỏng vấn kèm đáp án gợi ý.
- Sơ đồ (Mermaid) cho các luồng phức tạp: cursor, optimistic + rollback, idempotency, outbox, Service Worker, scroll anchor…
- **App:** mỗi lesson có 2 tab "Demo" và "Bài học". Tab "Bài học" render markdown, nhúng code thật, vẽ Mermaid. Thư viện markdown và Mermaid chỉ tải khi mở tab, nên chính phần này cũng là ví dụ về Tier 3 (lazy-load).
- **Code:** thêm marker `// #region learn:<id>` … `// #endregion learn:<id>` quanh các đoạn được trích, kèm comment ngắn trỏ tới mục bài học (vd `// Bài học: lesson-02 §2 – vì sao cursor`). Comment chi tiết hơn ở những chỗ khó, nhưng không biến file code thành tiểu luận.

## Ràng buộc
- Không đổi hành vi code. Typecheck, test và build vẫn pass.
- Đoạn code trong bài học **không được lệch** khỏi code thật. Doc chỉ tham chiếu `path#learn:id`, còn nội dung lấy từ source lúc chạy (Vite `import.meta.glob` + `?raw`). Một test vitest kiểm tra mọi tham chiếu đều tồn tại và các section bắt buộc đều có.
- Tiếng Việt. Nội dung bài viết gốc chỉ diễn giải lại, kèm link.
- Bám theo kiến trúc hiện có: lesson-layout, lazy chunk, CSS riêng.

## Ngoài phạm vi
Thêm lesson hoặc tính năng mới; viết lại code các lesson; dịch sang tiếng Anh.

## Tiêu chí hoàn thành
- 12 file `docs/lessons/lesson-XX.md`, mỗi file có đủ 7 phần cho từng khái niệm chính của lesson. Mỗi lesson có ít nhất 1 sơ đồ ở những chỗ có luồng.
- Test kiểm tra doc pass: mọi `path#learn:id` trỏ tới region có thật; đủ section bắt buộc; không có marker mồ côi trong code (marker không được doc nào dùng tới).
- Mở `#/lesson-XX` rồi chuyển sang tab "Bài học" thì thấy markdown, code thật có tô màu cú pháp và sơ đồ. Không có lỗi console. Chunk markdown/Mermaid không tải khi chỉ xem tab Demo.
- Typecheck, test và build đều pass.

## Hướng triển khai
1. **Hạ tầng** (làm tuần tự, một người):
   - Quy ước marker.
   - `src/shared/learn/` gồm loader cho doc và source qua `import.meta.glob`, hàm cắt region, renderer markdown (marked) có directive nhúng code, Mermaid tải lười, tô màu cú pháp nhẹ.
   - `LessonLayout` thêm tab Demo/Bài học.
   - Test kiểm tra doc.
2. **Nội dung:** chia nhóm lesson cho agent viết song song (01–04, 05–08, 09–12, cộng phần backend/cross-cutting). Mỗi nhóm chỉ thêm marker và comment trong đúng file của lesson mình.
3. Review tính chính xác của nội dung so với code, chạy test kiểm tra doc, rồi smoke test trên trình duyệt.

## Rủi ro
- **Nhiều agent cùng thêm marker vào file dùng chung** (`feed-repository.ts`, `http-client.ts`). Cách xử lý: file dùng chung do một nhóm "backend/cross-cutting" sở hữu; nhóm khác chỉ tham chiếu.
- **Bundle tăng do Mermaid.** Cách xử lý: tải lười, chỉ khi mở tab Bài học.
- **Nội dung sai so với code.** Cách xử lý: code được nhúng thật; reviewer đối chiếu phần lời giải thích.

## Câu hỏi chưa giải quyết
Không còn.
