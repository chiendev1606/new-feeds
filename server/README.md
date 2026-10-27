# Backend minh hoạ — News Feed API

Express 5 + TypeScript + **PostgreSQL 17** (chạy bằng Docker, xem `docker-compose.yml`). Truy cập dữ liệu dùng **Drizzle ORM**: schema viết bằng TypeScript, query có type an toàn và gần với SQL nên vẫn thấy rõ từng câu. Backend này triển khai phần **I – Interface** trong bài [News Feed (Facebook)](https://www.greatfrontend.com/questions/system-design/news-feed-facebook?format=system-design).

```bash
npm run db:up             # PostgreSQL :5432 + Adminer :8080
npm run dev:server        # chỉ chạy backend, cổng 3001 (tự chạy migration + seed nếu DB trống)
npm run dev               # backend + frontend (Vite proxy /api, /media, /__mock → 3001)
```

Mỗi request đều được in ra terminal, gồm method, URL, status, thời gian xử lý và idempotency key. Nên để terminal này mở song song với trình duyệt khi học.

## Endpoint

| Method | Path | Mô tả |
|---|---|---|
| GET | `/api/feed?count=10&cursor=…&direction=older\|newer` | Lấy feed phân trang bằng cursor. Response trả dạng chuẩn hoá: `{ feed, posts, users, media }` |
| GET | `/api/feed-offset?offset=0&count=10` | Phân trang bằng offset. Endpoint này chỉ dùng để so sánh trong lesson 02 |
| GET | `/api/posts/:id` | Lấy một bài viết |
| PUT | `/api/posts/:id/reaction` body `{ "reaction": "love" }` | Đặt hoặc đổi reaction |
| DELETE | `/api/posts/:id/reaction` | Bỏ reaction |
| POST | `/api/media/uploads` (body là bytes ảnh, kèm header `X-Image-Width/Height/Alt`) | Upload ảnh, nhận lại `mediaId` |
| POST | `/api/posts` (bắt buộc header `Idempotency-Key`) | Tạo bài viết `{ body: { text, entities }, mediaIds }` |
| GET | `/media/:id?w=640` | Lấy ảnh. Ảnh seed là SVG sinh theo bề rộng `w`; ảnh upload trả bytes gốc |
| GET/POST | `/__mock/config` | Xem hoặc chỉnh `latencyMs`, `failRate`, `autoNewPostsEverySec` |
| POST | `/__mock/insert-new-posts?n=3` | Chèn bài mới lên đầu feed |
| POST | `/__mock/reset` | Đưa dữ liệu về trạng thái seed |
| POST | `/api/telemetry` (JSON hoặc text/plain từ `sendBeacon`) | Nhận lô 1–200 sự kiện (impression, dwell, web-vital), trả 204, lưu bảng `telemetry_events` |
| GET | `/api/telemetry/summary` | Top bài theo lượt hiển thị và p75 của từng web vital |
| GET | `/api/session/me` | `{ viewerId }`, dùng để tách dữ liệu lưu cục bộ theo tài khoản |
| POST | `/api/session/refresh` | Làm mới session đã hết hạn |
| POST | `/__mock/expire-session` | Session hiện tại hết hạn, `/api` trả 401 `SESSION_EXPIRED` |
| POST | `/__mock/delete-post/:id` | Giả lập tác giả xoá bài; thao tác trên bài đó trả 404 |

## Thử bằng curl

```bash
curl -i "localhost:3001/api/feed?count=2"                      # để ý header Cache-Control: private và olderCursor
CURSOR=$(curl -s "localhost:3001/api/feed?count=2" | node -pe 'JSON.parse(require("fs").readFileSync(0)).feed.olderCursor')
curl -s "localhost:3001/api/feed?count=2&cursor=$CURSOR" | head -c 300

curl -X PUT localhost:3001/api/posts/post-0300/reaction -H 'content-type: application/json' -d '{"reaction":"love"}'

# Idempotency: chạy lệnh này 2 lần, server chỉ tạo 1 bài; lần 2 có header Idempotent-Replayed
curl -i -X POST localhost:3001/api/posts -H 'content-type: application/json' -H 'Idempotency-Key: abc' \
  -d '{"body":{"text":"Xin chào","entities":[]},"mediaIds":[]}'

# Giả lập server lỗi: mọi request /api trả 503 kèm Retry-After
curl -X POST localhost:3001/__mock/config -H 'content-type: application/json' -d '{"failRate":1}'
```

## Database

| Bảng | Ghi chú |
|---|---|
| `users` | Người dùng |
| `posts` | `body_entities JSONB`, `media_ids TEXT[]`. **Index `(created_at DESC, id DESC)`** phục vụ cursor pagination |
| `media` | Metadata ảnh. Ảnh upload lưu trong `upload_bytes BYTEA` (bản thật dùng S3/CDN). `uploaded_by` dùng để kiểm tra quyền sở hữu |
| `reactions` | Khoá chính `(post_id, user_id)`: PUT là UPSERT, DELETE là DELETE |
| `idempotency_keys` | Khoá chính `(viewer_id, key)`, kèm `request_hash` và response đã lưu |
| `feed_state` | Một dòng duy nhất chứa `generation` |

Schema nằm ở `src/data/database-schema.ts` (Drizzle). Mọi truy cập DB nằm trong `src/data/feed-repository.ts`. Mỗi hàm đọc nhận vào một mảng id nên **không bị N+1**: một trang feed chỉ tốn vài query cố định.

**Migration:** sửa `database-schema.ts`, chạy `npm run db:generate` để drizzle-kit sinh file SQL mới trong `db/migrations/`, rồi restart server để server tự áp các migration chưa chạy. Mở file `db/migrations/*.sql` để xem câu SQL mà Drizzle sinh ra.

Gợi ý thử:

```sql
-- npm run db:psql
EXPLAIN ANALYZE SELECT * FROM posts WHERE (created_at, id) < (now(), 'z') ORDER BY created_at DESC, id DESC LIMIT 11;  -- Index Scan
EXPLAIN ANALYZE SELECT * FROM posts ORDER BY created_at DESC, id DESC OFFSET 250 LIMIT 11;                           -- phải đọc 261 dòng
SELECT reaction, count(*) FROM reactions WHERE post_id = 'post-0300' GROUP BY reaction;
```

## Quyết định thiết kế (đối chiếu với bài)

| Quyết định | File | Vì sao |
|---|---|---|
| Cursor mờ chứa `(createdAt, id, generation)` | `src/services/feed-cursor-codec.ts` | Khi có bài mới chèn lên đầu feed, cursor vẫn trỏ đúng vị trí nên không bị trùng hay sót bài như offset. Client không parse được cursor, nên server đổi format lúc nào cũng được |
| Thứ tự ổn định `(created_at DESC, id DESC)` + index | `src/data/database-schema.ts`, `src/data/feed-repository.ts` | Cursor chỉ có nghĩa khi thứ tự sắp xếp là tất định; index giúp mọi trang đều nhanh |
| Response chuẩn hoá | `src/services/feed-query-service.ts` | Mỗi user/media chỉ gửi một lần, client merge thẳng vào store theo id |
| Danh tính lấy từ cookie session | `src/middleware/fake-session-middleware.ts` | Server không bao giờ tin `userId` do client gửi lên |
| `Cache-Control: private, no-store` | `src/routes/feed-routes.ts` | Feed đã cá nhân hoá (có `viewerReaction`) nên CDN không được cache |
| Bắt buộc `Idempotency-Key` khi tạo bài | `src/routes/post-routes.ts`, bảng `idempotency_keys` | Client retry an toàn. Tạo bài và lưu key trong cùng một transaction; khoá chính chặn hai request cùng key chạy song song; khác nội dung thì trả 422 |
| PUT/DELETE cho reaction | `src/routes/reaction-routes.ts` | Hai method này vốn idempotent, và response trả về số liệu mới nhất làm "sự thật" sau khi client cập nhật optimistic |
| Upload ảnh tách khỏi tạo bài | `src/routes/media-routes.ts` | Upload lâu và có thể lỗi riêng; bài chỉ tạo khi mọi ảnh đã sẵn sàng. Bản production thường dùng presigned URL |
| Entity ranges thay cho HTML | `shared-contracts/feed-api-contracts.ts` | Client tự render mention/hashtag/link, không phải chèn HTML (chống XSS) |
| 503 kèm `Retry-After` | `src/middleware/simulated-latency-and-failure-middleware.ts` | Client biết chờ bao lâu rồi mới retry |
| Validate dữ liệu ở server | `src/routes/post-routes.ts` | Không tin dữ liệu client gửi lên (độ dài, entity range, media có tồn tại) |

## Test

```bash
npm run db:up && npx vitest run server   # dùng database newsfeed_test
```

- `feed-query-service.test.ts`: lật hết các trang không bị trùng hay sót bài kể cả khi có bài mới chèn vào; chứng minh offset thì bị trùng.
- `api-routes.integration.test.ts`: HTTP thật, kiểm tra reaction, idempotency, upload, cursor hỏng, lỗi 503.
