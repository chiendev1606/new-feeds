# Báo cáo: bài học lesson 01–04 (nhóm A, phase 3)

## File đã sửa
- Viết mới/mở rộng: `docs/lessons/lesson-01.md`, `lesson-02.md` (mở rộng từ bản nháp), `lesson-03.md`, `lesson-04.md`.
- Chỉ thêm marker và comment trỏ bài học (không đổi logic):
  - `src/lessons/01-basic-feed/lesson-01-basic-feed.tsx`
  - `src/lessons/02-cursor-pagination/lesson-02-cursor-pagination.tsx`, `find-duplicate-post-ids.ts`
  - `src/lessons/03-normalized-store/feed-store-reducer.ts`, `feed-store-context.tsx`, `lesson-03-normalized-store.tsx`
  - `src/lessons/04-infinite-scroll/lesson-04-infinite-scroll.tsx`, `new-posts-banner.tsx`
- Sửa comment 📖 có sẵn ở `load-more-by-cursor` (lesson 02) từ §1 thành §4 cho khớp cấu trúc bài mới.

## Số khái niệm và region
| Lesson | Khái niệm | Region mới tôi tạo | Directive `learn` | Mermaid | Câu hỏi PV |
|---|---|---|---|---|---|
| 01 | 4 | 2 | 9 | 1 | 6 |
| 02 | 4 | 4 (+1 có sẵn `load-more-by-cursor`) | 15 | 1 | 6 |
| 03 | 4 | 10 | 11 | 2 | 6 |
| 04 | 5 | 7 | 14 | 1 | 6 |

Mọi region tôi tạo đều được doc dùng (đã kiểm tra bằng script: 0 region mồ côi trong 8 file lesson của nhóm A).
Backend và dùng chung được tham chiếu qua marker có sẵn: `cursor-encode`, `cursor-decode-validate`, `get-feed-page`, `build-normalized-entities`, `cursor-older`, `cursor-newer`, `offset-page`, `limit-plus-one-page`, `feed-order`, `posts-table-feed-index`, `offset-feed-query`, `feed-api-fetch-page`, `contract-feed-page`, `contract-post`, `http-retry-policy`, `http-retry-loop`, `latency-and-failure`, `intersection-sentinel`, `feed-loader-*`.

## Marker dùng chung còn thiếu
Không thiếu. Các marker có sẵn đủ cho lesson 01–04. Phase 4 lưu ý: các region dùng chung chưa có doc nào (ví dụ `session-middleware`, `request-logger`, `feed-route-private-cache`) vẫn sẽ là mồ côi nếu không có doc nhóm khác dùng. Lesson 01 chưa nhúng `feed-route-private-cache` và `session-middleware` (chỉ nhắc bằng lời), có thể nhúng ở bài `shared-foundations`.

## Kết quả kiểm chứng
- `npx vitest run src/shared/learn`: pass (27 test, tính cả doc của nhóm khác đang có mặt).
- `npx vitest run src/lessons/02-cursor-pagination src/lessons/03-normalized-store`: pass.
- `npx tsc --noEmit`: pass, không có lỗi.
- Đã kiểm chứng bằng curl tới backend đang chạy: `/api/feed` trả đủ 4 khoá, cursor giải mã ra `[createdAt, id, generation]`, cursor hỏng trả 400 `INVALID_CURSOR`, `/api/feed-offset` trả `postIds`, `nextOffset`, `hasMore`.
- Chưa chạy trình duyệt, nên các bước "Tự thử" dựa vào đọc TSX (text nút, nhãn panel mô phỏng) và chưa được thao tác thật trong UI. Không gọi `/__mock/reset`, không chèn dữ liệu vào DB.

## Câu hỏi còn mở
- Mermaid chưa render thử bằng mermaid 12; các nhãn trong sơ đồ flowchart đã đặt trong ngoặc kép, sequenceDiagram dùng chữ thuần. Phase 4 nên xem lại trong app.
- Một số khẳng định về log terminal backend ("3 dòng GET /api/feed" khi failRate 100%) dựa vào thiết kế middleware, chưa quan sát trực tiếp.

Status: DONE_WITH_CONCERNS
Summary: Bốn bài lesson 01–04 đã hoàn tất theo khung 7 phần, nhúng 49 khối code thật, có sơ đồ Mermaid, không còn region mồ côi; typecheck và test học liệu pass.
Concerns/Blockers: Chưa kiểm tra hiển thị mermaid và các bước "Tự thử" trong trình duyệt; phase 4 nên rà.
