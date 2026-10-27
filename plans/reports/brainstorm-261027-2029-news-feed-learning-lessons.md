---
type: brainstorm
date: 2026-10-27
source: https://www.greatfrontend.com/questions/system-design/news-feed-facebook?format=system-design
status: accepted
---

# Brainstorm: News Feed (Facebook) — code mẫu để học System Design

## Tóm tắt
Tạo project React + TS + Vite gồm 8 lesson tăng dần, bám theo khung RADIO của bài GreatFrontEnd. Mock API chạy bằng Vite middleware, không cần backend thật.

## Kết quả cần có
- Chạy `npm run dev` → trang chọn lesson. Mỗi lesson là một bước xây feed, có comment tiếng Việt trỏ về mục tương ứng trong bài.
- `docs/learning-guide.md` nối từng mục RADIO (R/A/D/I/O) với file và lesson tương ứng, kèm câu hỏi tự kiểm tra.

## Ràng buộc
- Node 24, React + TypeScript + Vite.
- Store tự viết bằng `useReducer`, không dùng thư viện state/query, để thấy rõ cơ chế normalization.
- Mock server là Vite middleware: dữ liệu seed tất định, có độ trễ, bật/tắt được lỗi giả. Pagination dùng cursor mờ (opaque).
- API bám theo bài: `GET /feed?cursor&count&direction`, `PUT|DELETE /posts/:id/reaction`, `POST /media/uploads`, `POST /posts` (có Idempotency-Key).

## Ngoài phạm vi
Ranking, ads, auth thật, deploy, comment/live update đầy đủ, Service Worker/offline, rich-text editor library. Các phần này chỉ được giải thích trong guide, không viết code.

## Các lesson
1. `01-basic-feed`: render list post tĩnh. Ứng với R + A (các layer View/Store/Data access).
2. `02-cursor-pagination`: data-access layer, cursor so với offset (có demo trùng/sót bài khi dùng offset).
3. `03-normalized-store`: `postsById`/`usersById`/`mediaById`, response chuẩn hoá được merge vào store.
4. `04-infinite-scroll`: IntersectionObserver, prefetch trước khoảng 1 viewport, skeleton, banner "Có bài mới" (`direction=newer`).
5. `05-optimistic-reaction`: cập nhật reaction trước khi server trả lời, rollback khi lỗi, xử lý race bằng sequence number.
6. `06-composer-upload`: upload ảnh trước, rồi tạo post với `mediaIds` và idempotency key; post mới được chèn optimistic vào đầu feed.
7. `07-perf-a11y-images`: lazy image, `aspect-ratio`, `srcset`, entity ranges (mention/hashtag) render an toàn, `Intl.RelativeTimeFormat`/`NumberFormat`, `role="feed"`/`aria-posinset`/`aria-setsize`, "See more".
8. `08-virtualization`: windowing tự viết có spacer và cache chiều cao.

## Tiêu chí hoàn thành
- `npm run dev` chạy được và mở được cả 8 lesson.
- `npm run build` và `tsc` pass.
- Lesson 05: bật lỗi giả thì reaction rollback, quan sát được.
- Lesson 08: DOM chỉ chứa các post đang nằm trong khung nhìn, thấy được qua DevTools.

## Phương án đã cân nhắc
- **Lesson từng bước (chọn):** dễ học dần và có thể diff giữa các bước. Đổi lại sẽ có code lặp giữa các lesson. Giảm lặp bằng cách đưa phần dùng chung (mock server, types, UI cơ bản) vào `src/shared`.
- **Một app hoàn chỉnh:** gần thực tế hơn, nhưng người mới học bị ngợp.
- **Demo rời từng khái niệm:** không thấy các khái niệm ghép lại với nhau thế nào.

## Câu hỏi chưa giải quyết
Không còn.
