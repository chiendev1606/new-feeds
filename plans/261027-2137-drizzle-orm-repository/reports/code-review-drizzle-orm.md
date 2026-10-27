# Code review: chuyển SQL thuần (pg) → Drizzle ORM 0.45 / drizzle-kit 0.31

Ngày: 2026-10-27 · Reviewer: code-reviewer · Không sửa mã nguồn.

## Phạm vi
- Mới: `server/src/data/database-schema.ts`, `drizzle.config.ts`, `server/db/migrations/0000_init.sql` (+ `meta/`).
- Viết lại: `server/src/data/{database-pool,feed-repository,seed-database}.ts`, `app-context.ts`, `routes/post-routes.ts`, `services/{idempotency-store,engagement-summary-builder,feed-query-service}.ts`, `server-entry.ts`, `cli/reset-database-cli.ts`, `test-support/test-database.ts`.
- Xoá: `server/db/schema.sql`.
- Mốc so sánh "bản SQL thuần": không có git → lấy code cũ từ transcript phiên trước (database-pool, seed-database, feed-repository, post-routes, feed-query-service, schema.sql) + DDL thật trong `backups/newsfeed-20261027-212017.sql` (pg_dump của DB tạo bằng schema.sql).

## Cách kiểm chứng (đã chạy)
- `npx tsc --noEmit`: pass (0 lỗi).
- `drizzle-kit generate` với out = bản sao migrations trong scratchpad: "No schema changes, nothing to migrate" → schema TS và `0000_init.sql`/snapshot khớp nhau.
- DB tạm `review_scratch_legacy` (nạp backup cũ) + `review_scratch_fresh` (trống), đã DROP sau khi xong:
  - `ensureDatabaseReady` trên DB cũ → **crash** `DrizzleQueryError ... relation "feed_state" already exists (42P07)`.
  - Unique violation qua Drizzle: lỗi ngoài là `DrizzleQueryError` (`code` undefined), `cause.code = '23505'` → `isUniqueViolation` = true.
  - 5 vòng × 15 POST /api/posts song song cùng key: mỗi vòng đúng 1 bài, 1×`201` + 14×`201` có `Idempotent-Replayed`, cùng post id.
  - `createdAt` trả về là string ISO (`2026-10-27T14:46:57.635Z`); `getReactionStats` trả `total`/counts kiểu number.
  - Thử chèn chuỗi `z') OR 1=1 --` vào anchor.id → được bind như tham số, query chạy bình thường.
  - Cursor giả mạo `["garbage","x",1]` → 500 `INTERNAL_ERROR` (lỗi 22007 từ Postgres).

## Đánh giá tổng quát
Port trung thành, phạm vi gọn, không lan ra ngoài. Hợp đồng API, cursor, idempotency, quyền sở hữu media giữ nguyên hành vi. Schema tương đương về ngữ nghĩa với schema.sql. Lỗ hổng thật duy nhất là **đường nâng cấp cho DB đã tạo bằng schema.sql**: chưa có tài liệu, chưa có cơ chế phát hiện, và server crash với stack trace khó hiểu.

## Critical
Không có.

## High

### H1. DB cũ (tạo bằng schema.sql) làm server/test/CLI crash, không có hướng dẫn
- Vị trí: `server/src/data/seed-database.ts:42` (`migrate()`), được gọi từ `server/src/server-entry.ts:20`, `server/src/test-support/test-database.ts:15`, `server/src/cli/reset-database-cli.ts:8`.
- Kịch bản: người đã chạy bản trước (volume `newsfeed-pgdata` còn bảng do schema.sql tạo, chưa có `drizzle.__drizzle_migrations`) cập nhật code rồi `npm run dev` → `migrate()` chạy `CREATE TABLE "feed_state"` → 42P07 → top-level await reject trong `server-entry.ts` → process chết, in ra cả `DrizzleQueryError` kèm SQL. `npm run test` cũng hỏng theo cách này ở `beforeAll` (DB `newsfeed_test` cũng là DB cũ). Đã tái hiện trên bản sao backup cũ.
- Việc reset thủ công một lần chỉ sửa máy hiện tại. README/server README chỉ ghi "Lần chạy đầu tiên, server tự chạy migration", không nhắc trường hợp nâng cấp.
- Cách sửa (chọn 1, nên làm cả 2):
  1. Phát hiện DB cũ trong `ensureDatabaseReady` trước khi gọi `migrate()`, rồi ném lỗi có hướng dẫn:
     ```ts
     const legacy = await db.execute(sql`SELECT to_regclass('public.users') IS NOT NULL AS has_tables,
                                                to_regclass('drizzle.__drizzle_migrations') IS NOT NULL AS has_journal`);
     const { has_tables, has_journal } = legacy.rows[0] as { has_tables: boolean; has_journal: boolean };
     if (has_tables && !has_journal) {
       throw new Error('DB được tạo bằng schema.sql cũ. Chạy "npm run db:backup", sau đó reset schema public (xem README > Nâng cấp) rồi khởi động lại.');
     }
     ```
     Đồng thời bọc `ensureDatabaseReady` trong `server-entry.ts` bằng try/catch giống `assertDatabaseReachable` (in message rồi `process.exit(1)`).
  2. Thêm mục "Nâng cấp từ bản dùng schema.sql" vào README.md:
     ```bash
     npm run db:backup
     docker compose exec -T postgres psql -U newsfeed -d newsfeed      -c 'DROP SCHEMA public CASCADE; CREATE SCHEMA public;'
     docker compose exec -T postgres psql -U newsfeed -d newsfeed_test -c 'DROP SCHEMA public CASCADE; CREATE SCHEMA public;'
     npm run dev   # migrate + seed lại
     ```
     (Hoặc `docker compose down -v && npm run db:up`. Cách này xoá volume, script init sẽ tạo lại `newsfeed_test`.)
- Trả lời câu hỏi (c): **có, cần ghi chú cho người dùng.**

## Medium

### M1. Khôi phục backup cũ vào DB mới làm lệch tên constraint so với snapshot Drizzle
- Vị trí: `package.json` script `db:backup` (`pg_dump --clean`), `backups/newsfeed-20261027-212017.sql`, `backups/newsfeed-20261027-213907.sql` (cả hai đều là schema cũ, không có schema `drizzle`).
- Kịch bản: người dùng muốn lấy lại dữ liệu cũ nên `psql < backups/newsfeed-2026...sql` vào DB đã migrate. `--clean` sẽ DROP rồi tạo lại bảng với tên cũ (`media_width_check`/`media_height_check`, `reactions_reaction_check`, `feed_state_id_check`, `reactions_pkey`, `posts_author_id_fkey`, `users_handle_key`...), còn `drizzle.__drizzle_migrations` vẫn ghi là đã áp `0000`. Server vẫn chạy được. Nhưng migration sau này do drizzle-kit sinh ra sẽ tham chiếu tên mới (`media_size_positive`, `reactions_post_id_user_id_pk`, `posts_author_id_users_id_fk`...), nên `ALTER TABLE ... DROP CONSTRAINT "media_size_positive"` sẽ lỗi trên DB đó.
- Cách sửa: trong mục Nâng cấp, ghi rõ chỉ khôi phục **dữ liệu**. Ví dụ để server migrate + seed DB trống, rồi `TRUNCATE` các bảng và nạp phần `COPY ... FROM stdin` của backup (hoặc `pg_restore --data-only` nếu chuyển sang format `-Fc`). Không restore cả file `--clean` cũ.

## Low

### L1. Cursor có `createdAt` không phải ngày giờ → 500 thay vì 400 (đã có từ trước)
- `server/src/services/feed-cursor-codec.ts:26-33` chỉ kiểm tra `typeof === 'string'`. `feed-repository.ts:96,107` cast `::timestamptz` → Postgres trả 22007 → `error-handler-middleware` trả 500 và `console.error` cả query + params.
- Bản SQL thuần cũng `$1::timestamptz` nên đây không phải regression. Sửa: thêm `!Number.isNaN(Date.parse(parsed[0]))` vào điều kiện của `decodeCursor`, và thêm test "cursor đúng base64 nhưng createdAt hỏng → 400".

### L2. `npm run db:reset` seed 2 lần khi DB trống
- `server/src/cli/reset-database-cli.ts:8-9`: `ensureDatabaseReady` đã seed DB trống, sau đó `resetDatabaseToSeed` TRUNCATE rồi seed lại. Kết quả vẫn đúng nhưng tốn công gấp đôi. Sửa: export riêng hàm `runMigrations(db)` và gọi hàm đó trong CLI, hoặc bỏ qua bước reset khi `ensureDatabaseReady` trả về khác null.

### L3. Seed bằng INSERT nhiều dòng bị giới hạn 65 535 tham số bind
- `server/src/data/seed-database.ts:24-27`. Bản cũ dùng `json_to_recordset($1)` (1 tham số). Bản mới bind mỗi ô một tham số: hiện có ~3 183 reactions × 3 ≈ 9.5k tham số, còn dư khoảng 6.8 lần. Nếu sau này tăng seed (ví dụ 3 000 bài) thì INSERT reactions sẽ vượt giới hạn và `migrate + seed` lúc khởi động sẽ lỗi. Sửa: chia lô (ví dụ 5 000 dòng/lô), hoặc ghi chú giới hạn này ngay trong comment.

### L4. `migrate()` không có khoá giữa các process
- `seed-database.ts:42`. Nếu 2 process khởi động cùng lúc trên một DB trống (ví dụ `npm run dev` và `npm run db:reset` chạy song song), một process có thể lỗi 42P07 hoặc trùng khoá ở `__drizzle_migrations`. Rủi ro thấp với project học tập. Nếu muốn chặn: bọc bằng `pg_advisory_lock`.

### L5. Comment chưa chính xác
- `server/src/data/feed-repository.ts:7-8` ghi "Các hàm nhận tham số `executor` tuỳ chọn", nhưng `insertPost`, `updateMediaAlt`, `saveIdempotentResponse` **bắt buộc** executor ở tham số đầu. Sửa: "Hàm đọc nhận `executor` tuỳ chọn; hàm ghi trong transaction nhận `executor` bắt buộc."
- `docs/learning-guide.md:69` ghi SQL là `< ($1, $2)`, còn SQL thật là `< ($1::timestamptz, $2)` (log ở trên cho thấy câu Drizzle sinh ra). Đây là mô tả mang tính minh hoạ, có thể bỏ qua.

### L6. `drizzle.config.ts` không được typecheck
- `tsconfig.json:21` `include` không có `drizzle.config.ts`, nên `npm run typecheck`/`build` không bắt được lỗi trong file này. Sửa: thêm vào `include`.

## Đối chiếu yêu cầu

### (a) Hợp đồng API và hành vi route: KHÔNG ĐỔI
- Cursor older/newer: SQL sinh ra giống bản cũ (`(created_at,id) < / > ($1::timestamptz,$2)`, ORDER DESC / ASC rồi đảo, LIMIT n+1). `toPage` + `reverse()` cho kết quả tương đương. EXPLAIN dùng index (đã có từ trước).
- `createdAt`: `timestamp({withTimezone})` mode `date` → `rowToPost` gọi `.toISOString()` (`feed-repository.ts:40`). Khi ghi, `postToRow` dùng `new Date(iso)`. Precision vẫn là ms như cũ.
- Reaction count: `count()` của Drizzle tự `mapWith(Number)` → number (đã kiểm chứng). `bool_or` trả boolean.
- Idempotency: replay → 422 khi khác hash; tạo bài, cập nhật alt và lưu key trong cùng 1 `db.transaction`. Khi 2 request chạy song song thì 23505 nằm ở `cause` và `isUniqueViolation` đã đọc đúng (đã kiểm chứng). Ngoài ra, khi gặp 23505 không phải từ key (ví dụ trùng post id) thì `replay()` trả false → rethrow → 500, giống bản cũ.
- Alt text được đọc trong transaction: `buildNormalizedEntities(..., tx)` → `getMediaByIds(..., tx)` (`post-routes.ts:122`).
- Quyền sở hữu media: `findMediaNotOwnedBy` dùng `inArray` + `eq(uploadedBy)`, giữ đúng ngữ nghĩa của `= ANY($1) AND uploaded_by = $2`.
- `USER_FIELDS`/`MEDIA_FIELDS` khớp với `User`/`Media` trong `shared-contracts/feed-api-contracts.ts:20-37` (cùng cột với `USER_COLUMNS`/`MEDIA_COLUMNS` cũ). Response JSONB replay đọc ra object.

### (b) Schema: TƯƠNG ĐƯƠNG (khác tên constraint)
| Thành phần | schema.sql (pg_dump) | 0000_init.sql | Kết luận |
|---|---|---|---|
| Cột, kiểu, NOT NULL, default (`'[]'::jsonb`, `'{}'::text[]`, `0`, `false`, `now()`) | có | có | khớp |
| PK `users/posts/media/feed_state(id)`, `reactions(post_id,user_id)`, `idempotency_keys(viewer_id,key)` | `*_pkey` | `*_pk`/inline | khớp, khác tên |
| UNIQUE `users.handle` | `users_handle_key` | `users_handle_unique` | khớp, khác tên |
| CHECK media | 2 check: `width>0`, `height>0` | 1 check: `width>0 AND height>0` | tương đương |
| CHECK reaction IN (...) | `= ANY(ARRAY[...])` | `IN (...)` | tương đương |
| CHECK feed_state `id = 1` | có | có | khớp |
| FK `posts.author_id`, `media.uploaded_by`, `reactions.user_id` (NO ACTION), `reactions.post_id` (CASCADE) | có | có | khớp |
| Index `posts_feed_order_idx (created_at DESC, id DESC)` | có | `DESC NULLS FIRST` | giống hệt (DESC mặc định là NULLS FIRST; `\d posts` hiển thị như nhau) |

Không code nào phụ thuộc vào tên constraint. Khác tên chỉ là vấn đề khi restore backup cũ (M1).

### (c) Rủi ro
- `sql` cho so sánh row value: an toàn. `${anchor.createdAt}`/`${anchor.id}` được bind thành `$1/$2`, còn `${posts.createdAt}` render thành identifier có quote. Đã thử payload injection.
- TRUNCATE (`seed-database.ts:35`): chạy trong transaction, liệt kê đủ cả 6 bảng có FK lẫn nhau nên không cần CASCADE. Không đụng `drizzle.__drizzle_migrations`. `${table}` render thành `"reactions"`... Lệnh này giữ ACCESS EXCLUSIVE lock trong lúc reset, giống bản cũ.
- `migrate()` với DB cũ: xem H1 và M1.
- Dùng chung 1 client trong transaction: `NodePgDatabase.transaction` lấy 1 client từ pool, BEGIN/COMMIT/ROLLBACK, release trong `finally` (`node_modules/drizzle-orm/node-postgres/session.js:180-195`), tương đương `withTransaction` cũ. Chạy tuần tự khi có executor là đúng: pg 8.x đánh dấu deprecate việc gọi `client.query()` lúc client đang bận (`node_modules/pg/lib/client.js:36`). Comment ở `feed-query-service.ts:50` chính xác.

### (d) Code / pattern / docs
- Phong cách theo pattern có sẵn: repository là nơi duy nhất truy cập DB, executor truyền qua tham số, comment tiếng Việt nhất quán. Không có `any`/`@ts-` hay lint suppression.
- Không còn tham chiếu `schema.sql`, `withTransaction`, `PoolClient` trong `server/src`, `README.md`, `server/README.md`, `docs/`. Docs đã cập nhật cho Drizzle. Còn thiếu mục nâng cấp (H1) và có 1 comment chưa chính xác (L5).
- `feed-repository.ts` dài 251 dòng, vượt ngưỡng 200 nhưng bản cũ cũng dài tương đương. Không đề xuất tách trong lần thay đổi này.

### (e) Type/build
- `tsc --noEmit` pass. Build/test đã được xác nhận trước đó, không chạy lại. `drizzle.config.ts` nằm ngoài typecheck (L6).

## Hành động đề xuất (theo thứ tự)
1. H1: phát hiện DB cũ, in hướng dẫn thay vì crash, thêm mục "Nâng cấp" vào README.
2. M1: ghi trong mục Nâng cấp là chỉ restore dữ liệu từ backup cũ, không restore cả schema.
3. L1: validate `createdAt` trong `decodeCursor` và thêm test.
4. L2, L5, L6: sửa nhỏ. L3, L4: chỉ cần ghi chú.

## Chỉ số
- Type: tsc 0 lỗi. Lint: repo không có linter.
- Test: 76 pass (theo xác nhận trước). Chưa có test cho cursor có createdAt hỏng.

## Câu hỏi chưa giải quyết
- Có cần giữ dữ liệu từ 2 file backup cũ không? Nếu có, nên viết sẵn script restore chỉ dữ liệu, không chỉ ghi chú.
- Có muốn baseline tự động (đánh dấu `0000` đã áp khi DB cũ có schema giống hệt) thay vì yêu cầu người dùng reset không? Cách này phức tạp hơn và khó kiểm chứng tính tương đương nên không khuyến nghị.
