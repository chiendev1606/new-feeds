# News Feed — System Design qua 8 lesson

Project học **frontend system design** dựa trên bài [News Feed (Facebook) – GreatFrontEnd](https://www.greatfrontend.com/questions/system-design/news-feed-facebook?format=system-design).

Project gồm 8 lesson, lesson sau xây thêm một khái niệm lên lesson trước. Đi kèm là một backend Express thật, có thể chỉnh độ trễ và tỉ lệ lỗi để quan sát hành vi mạng.

## Chạy

Cần **Node 20+** và **Docker** (PostgreSQL chạy trong container).

```bash
npm install
npm run dev          # tự bật Postgres + Adminer (docker compose), rồi chạy backend :3001 + frontend :5173
```

Lần chạy đầu tiên, server tự chạy migration (Drizzle) và seed 300 bài viết. Restart thì dữ liệu vẫn còn: reaction đã bấm và bài đã đăng được lưu trong Postgres.

Xem dữ liệu bằng **Adminer** tại http://localhost:8080 (System: PostgreSQL, Server: `postgres`, User/Password/Database: `newsfeed`). Hoặc dùng `npm run db:psql`.

Mở http://localhost:5173 và học theo thứ tự. **Để terminal mở song song**: backend in log mọi request (cursor, status, thời gian xử lý, idempotency key).

| Script | Việc |
|---|---|
| `npm run dev` | Chạy cả backend và frontend |
| `npm run dev:server` / `npm run dev:web` | Chỉ chạy một bên |
| `npm run test` | Vitest: unit test cho reducer/logic; integration test backend chạy trên DB `newsfeed_test` (cần `npm run db:up`) |
| `npm run db:up` / `npm run db:down` | Bật/tắt container Postgres + Adminer (dữ liệu nằm trong volume, không mất khi tắt) |
| `npm run db:backup` | `pg_dump` ra `backups/newsfeed-<thời gian>.sql` |
| `npm run db:reset` | Xoá sạch rồi seed lại (chạy `db:backup` trước nếu muốn giữ dữ liệu) |
| `npm run db:psql` | Mở psql trong container |
| `npm run db:generate` | Sinh migration mới sau khi sửa `server/src/data/database-schema.ts` |
| `npm run db:recreate` | Xoá và tạo lại schema của cả DB dev lẫn DB test (dùng khi nâng cấp, xem bên dưới) |
| `npm run typecheck` | `tsc --noEmit` cho cả client, server và contracts |
| `npm run build` | Typecheck rồi build bằng Vite (mỗi lesson là một chunk riêng) |

### Nâng cấp từ bản trước Drizzle

Nếu DB được tạo bằng phiên bản cũ (có `server/db/schema.sql`), server sẽ báo *"Database được tạo bằng schema cũ"* và dừng. Cách nâng cấp:

```bash
npm run db:backup     # giữ lại dữ liệu cũ
npm run db:recreate   # xoá và tạo lại schema của newsfeed và newsfeed_test
npm run dev           # server tự chạy migration và seed lại
```

Cách khác: `docker compose down -v` xoá luôn volume. Lưu ý: file backup cũ chứa cả cấu trúc bảng cũ, nên **đừng restore nguyên file** vào DB đã migrate. Nếu cần lấy lại dữ liệu, chỉ restore phần dữ liệu (`COPY ...`), hoặc dump lại bằng `pg_dump --data-only`.

## Lộ trình học

| # | Lesson | RADIO | Khái niệm |
|---|---|---|---|
| 01 | Feed cơ bản | R + A | Các layer View / Store / Data access / Server, CSR |
| 02 | Cursor vs offset | I | Vì sao offset bị trùng bài khi có bài mới; cursor mờ (opaque) |
| 03 | Normalized store | D | `postsById` / `usersById` / `mediaById`, merge response theo id |
| 04 | Infinite scroll | O | IntersectionObserver, prefetch, skeleton, banner "Có bài mới" |
| 05 | Optimistic reaction | O | Cập nhật UI trước, rollback khi lỗi, xử lý response về sai thứ tự |
| 06 | Composer & upload | I + O | Upload ảnh trước rồi mới tạo bài, idempotency key, chèn bài tạm |
| 07 | Ảnh, a11y, i18n | O | srcset, giữ chỗ cho ảnh, entity ranges, Intl, `role="feed"` |
| 08 | Virtualization | O | Windowing, đo chiều cao, so sánh với `content-visibility` |

Hướng dẫn chi tiết, nối từng mục trong bài với từng file, kèm câu hỏi tự kiểm tra: **[docs/learning-guide.md](docs/learning-guide.md)**.

## Cấu trúc

```
shared-contracts/feed-api-contracts.ts   Hợp đồng API, dùng chung cho server và client
docker-compose.yml                       PostgreSQL 17 + Adminer
server/                                  Backend Express (xem server/README.md)
  db/migrations/   migration SQL do drizzle-kit sinh ra
  src/data/        database-schema (Drizzle), feed-repository (mọi truy cập DB), seed
  src/routes/      feed, posts, reactions, media, __mock
  src/services/    cursor codec, feed query, idempotency, engagement, SVG ảnh
  src/middleware/  logger, fake session, latency/failure, error handler
src/
  app-lesson-picker.tsx                  Điều hướng bằng hash + React.lazy
  shared/api/                            Data access: http-client (retry/backoff), feed-api
  shared/hooks/                          use-feed-loader, use-intersection-sentinel
  shared/post-rendering/                 Bài viết "production-grade" (lesson 07, 08)
  shared/ui/                             Layout lesson, panel mô phỏng, card, skeleton, toast
  lessons/0X-*/                          Mỗi lesson: component + logic riêng + test
```

## Panel "Mô phỏng mạng"

Mỗi lesson có một panel để chỉnh **độ trễ**, **tỉ lệ lỗi** (trả 503 kèm `Retry-After`), **tự sinh bài mới**, **chèn 3 bài mới** và **reset dữ liệu**. Đây là công cụ chính để quan sát retry, rollback, skeleton và banner "Có bài mới".
