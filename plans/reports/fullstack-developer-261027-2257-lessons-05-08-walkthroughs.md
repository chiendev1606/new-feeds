# Báo cáo nhóm B: lesson 05–08

## File đã sửa hoặc tạo
Tài liệu mới:
- `docs/lessons/lesson-05.md` (4 khái niệm, 2 sơ đồ Mermaid)
- `docs/lessons/lesson-06.md` (5 khái niệm, 2 sơ đồ)
- `docs/lessons/lesson-07.md` (4 khái niệm, 2 sơ đồ)
- `docs/lessons/lesson-08.md` (4 khái niệm, 2 sơ đồ)

Chỉ thêm marker và comment trỏ bài học, không đổi logic:
- 05: `reaction-reducer-with-rollback.ts`, `use-toggle-reaction.ts`, `reaction-picker.tsx`, `reaction-menu.tsx`
- 06: `composer-draft-reducer.ts`, `composer.tsx`, `prepare-image-for-upload.ts`, `lesson-06-composer-upload.tsx`
- 07: `lesson-07-perf-a11y-images.tsx`
- 08: `compute-visible-range.ts`, `use-measured-item-heights.ts`, `virtualized-feed-list.tsx`, `lesson-08-virtualization.tsx`

## Số region mới mỗi lesson
| Lesson | Region mới | Region dùng chung được dẫn tới |
|---|---|---|
| 05 | 11 | 10 (reactions-table, set-reaction-upsert, reaction-put-route, reaction-write-confirmed-at, personalize-posts, reaction-stats, reaction-counts-query, contract-engagement-summary, feed-api-set-reaction, latest-intent-queue) |
| 06 | 12 | 17 (kể cả idempotency-key-and-replay, create-post-transaction, request-hash, unique-violation-in-cause, idempotency-find-and-save, idempotency-keys-table, http-retry-policy) |
| 07 | 3 | 12 (feed-post-article, expandable-post-text, responsive-post-image, post-media-grid, media-serve-nosniff, 5 region Intl, sample-reactors-query) |
| 08 | 12 | 1 (feed-loader-load-pages) |

Mọi region mới đều được doc dùng tới (đã kiểm bằng script, không có region mồ côi trong `src/lessons/05..08`). Mọi marker dùng chung có comment trỏ `lesson-05..08` cũng đã được doc dùng.

## Marker dùng chung còn thiếu
Không thiếu marker nào bắt buộc. Gợi ý (không bắt buộc): chưa có region cho CSS `.feed--content-visibility` trong `src/shared/styles/global.css:207`; doc lesson 08 chỉ nhắc bằng lời.

## Kiểm chứng
- `npx vitest run src/shared/learn`: pass (27 + 6 test; cảnh báo orphan chỉ còn các region của nhóm khác).
- Test của lesson 05, 06, 08 (reducer, draft, compute-visible-range): pass.
- `npx tsc --noEmit`: pass.
- Cả 8 sơ đồ Mermaid parse hợp lệ với mermaid 12.2.0 (kiểm bằng script tạm, đã xoá).
- Đã dò: không có file tạm nào còn sót trong project. Prettier báo style ở cả file test không đụng tới nên bỏ qua.

## Lưu ý
- Lúc thêm marker lần đầu, script chèn lệch dòng ở `lesson-07-perf-a11y-images.tsx`; đã sửa ngay, region cuối cùng đúng (`accessible-feed-container`, `locale-state-and-dir`, `locale-dir-wrapper`).
- Ví dụ curl trong doc dùng cookie mặc định (`user-1`); lesson 06 có lệnh tạo bài thật trong DB (không reset, không gọi `/__mock/reset`).
- Server chưa chạy lúc viết nên các lệnh curl chưa chạy thực tế; nội dung dựa trên code và test hiện có.

Status: DONE_WITH_CONCERNS
Summary: Đã viết xong lesson 05–08 (4/5/4/4 khái niệm, 2 sơ đồ mỗi bài) và thêm 38 region vào code lesson; test learn, test lesson, tsc đều pass, mermaid hợp lệ.
Concerns/Blockers: Các lệnh curl và bước "Tự thử" chưa chạy thật trên app đang chạy (server không bật trong lúc viết); nên để phase 4 smoke test xác nhận.
