# Học liệu: bài học bám sát code

Mỗi lesson có một file `lesson-XX.md` trong thư mục này. App hiển thị file đó ở tab **📖 Bài học**, cạnh tab **🧪 Demo**. Bạn cũng có thể đọc thẳng file trong VS Code, nhưng đọc trong app sẽ thấy code thật có tô màu, sơ đồ và link tới GitHub.

## Đoạn code không bao giờ lệch khỏi code thật

Trong code, đánh dấu đoạn muốn trích (thay `<id>` bằng tên kebab-case):

```ts
// 📖 Bài học lesson-02 §2 – cursor (docs/lessons/lesson-02.md)
// #region learn:<id>
...code...
// #endregion learn:<id>
```

Trong JSX thì dùng comment JSX với cùng cú pháp.

Trong bài học, khai báo một code block có ngôn ngữ `learn`, mỗi dòng là một tham chiếu `đường-dẫn-từ-gốc-repo#<id>`:

    ```learn
    server/src/data/feed-repository.ts#cursor-older
    ```

App đọc file source lúc hiển thị và cắt đúng đoạn đó, nên code đổi thì bài học đổi theo. Test `src/shared/learn/lesson-docs.test.ts` báo lỗi khi:
- tham chiếu trỏ tới file hoặc region không còn tồn tại;
- region hỏng (thiếu `#endregion`, id trùng);
- một khái niệm thiếu mục bắt buộc;
- (từ khi bật nghiêm ngặt) có region trong code mà không bài học nào dùng.

Sơ đồ: dùng code block có ngôn ngữ `mermaid`.

## Khung của một khái niệm

Mỗi khái niệm là một mục `## N. Tên` và **bắt buộc** có đủ 6 mục con, đúng tên như sau:

| Mục | Viết gì |
|---|---|
| `### Trong bài viết` | Bài GreatFrontEnd nói gì. **Diễn giải bằng lời mình**, kèm link; không chép nguyên văn đoạn dài |
| `### Code thật` | Một hoặc nhiều khối `learn`, sau mỗi khối giải thích **từng bước** (đánh số) |
| `### Vì sao làm vậy` | Lý do, kèm bảng so sánh các cách khác: ưu, nhược, khi nào chọn |
| `### Lỗi hay gặp` | Lỗi dễ mắc và cách project tránh; lỗi **thật** đã gặp trong project nếu có |
| `### Tự thử` | Các bước cụ thể trên app, DevTools hoặc terminal, kèm kết quả mong đợi |
| `### Câu hỏi phỏng vấn` | Câu hỏi kèm đáp án gợi ý (trích dẫn bằng `>`) |

Đầu file có: mục tiêu, kiến thức cần có trước, bảng bản đồ file. Cuối file có: **Tóm tắt** khoảng 5 dòng. Xem mẫu ở [`_template.md`](./_template.md).

## Thêm bài học cho một khái niệm mới

1. Đánh dấu region trong code, kèm comment `📖` ngắn trỏ tới bài học.
2. Viết mục `## N.` theo khung trên.
3. Chạy `npx vitest run src/shared/learn`.
4. Mở `#/lesson-XX` rồi chuyển sang tab Bài học để kiểm tra hiển thị.

## Marker có sẵn trong file dùng chung

Các marker dưới đây đã được gắn sẵn vào backend, hợp đồng API, `src/shared/**`, `public/sw.js` và `src/app-lesson-picker.tsx`. Bài học chỉ cần tham chiếu `path#id`, không tự thêm marker vào các file này. Cột cuối là lesson nên dùng (gợi ý); `shared-foundations` là bài đọc thêm [`shared-foundations.md`](./shared-foundations.md), nơi marker đó đã được dùng. Thiếu marker nào thì báo để bổ sung, đừng sửa file dùng chung.

| path#id | Nội dung | Lesson nên dùng |
|---|---|---|
| `server/src/data/feed-repository.ts#feed-order` | Thứ tự ổn định (created_at DESC, id DESC) làm nền cho cursor | `lesson-02` |
| `server/src/data/feed-repository.ts#limit-plus-one-page` | Lấy dư 1 dòng để biết còn trang sau, không cần COUNT(*) | `shared-foundations` (đã dùng) |
| `server/src/data/feed-repository.ts#feed-generation-read` | Đọc feed generation từ bảng feed_state | `lesson-09` |
| `server/src/data/feed-repository.ts#cursor-older` | Cursor SQL: so sánh bộ giá trị (created_at, id) để lấy bài cũ hơn | `shared-foundations` (đã dùng) |
| `server/src/data/feed-repository.ts#cursor-newer` | Lấy bài mới hơn anchor: ASC rồi đảo lại thành thứ tự feed | `lesson-04` |
| `server/src/data/feed-repository.ts#offset-page` | Phân trang offset – chỉ để so sánh với cursor | `lesson-02` |
| `server/src/data/feed-repository.ts#batch-users-with-relationship` | Đọc user theo lô và tính quan hệ với viewer, không N+1 | `shared-foundations` (đã dùng) |
| `server/src/data/feed-repository.ts#reaction-stats` | Số reaction theo loại + reaction của viewer cho nhiều bài | `lesson-05` |
| `server/src/data/feed-repository.ts#reaction-counts-query` | GROUP BY đếm reaction và bool_or xác định reaction của viewer | `lesson-05` |
| `server/src/data/feed-repository.ts#sample-reactors-query` | Window function row_number lấy vài người react mẫu, ưu tiên bạn bè | `lesson-07` |
| `server/src/data/feed-repository.ts#set-reaction-upsert` | UPSERT reaction: chạy hai lần cùng giá trị cho cùng kết quả | `lesson-05` |
| `server/src/data/feed-repository.ts#media-ownership-check` | Chỉ chủ ảnh mới được gắn ảnh vào bài | `lesson-06` |
| `server/src/data/feed-repository.ts#insert-post-generation` | Chèn bài và tăng feed generation trong cùng executor | `lesson-06` |
| `server/src/data/feed-repository.ts#idempotency-find-and-save` | Đọc/lưu response idempotent, khoá chính (viewer_id, key) | `shared-foundations` (đã dùng) |
| `server/src/data/feed-repository.ts#insert-new-posts-batch` | Giả lập bạn bè đăng bài, chèn cả lô trong một transaction | `lesson-02` |
| `server/src/data/feed-repository.ts#telemetry-insert-batch` | Lưu cả lô sự kiện telemetry bằng một câu INSERT | `lesson-11` |
| `server/src/data/feed-repository.ts#telemetry-summary` | Tổng hợp impression, dwell và p75 web vitals bằng SQL | `lesson-11` |
| `server/src/routes/post-routes.ts#entity-sanitize` | Validate entity và tạo lại object sạch, không lưu nguyên dữ liệu client | `lesson-06` |
| `server/src/routes/post-routes.ts#validate-post-body-nfc` | Validate body ở server, chuẩn hoá Unicode NFC trước khi tính offset entity | `lesson-06` |
| `server/src/routes/post-routes.ts#idempotency-key-and-replay` | Đọc key, băm body, phát lại response cũ nếu key đã dùng | `shared-foundations` (đã dùng) |
| `server/src/routes/post-routes.ts#create-post-validate-media` | Kiểm tra media, bài rỗng và alt text trước khi tạo bài | `lesson-06` |
| `server/src/routes/post-routes.ts#create-post-transaction` | Tạo bài và lưu key trong cùng transaction, thua cuộc đua thì phát lại | `shared-foundations` (đã dùng) |
| `server/src/services/idempotency-store.ts#request-hash` | Băm nội dung request để phát hiện dùng sai key | `shared-foundations` (đã dùng) |
| `server/src/services/idempotency-store.ts#unique-violation-in-cause` | Drizzle bọc lỗi Postgres trong cause nên phải đọc đệ quy | `shared-foundations` (đã dùng) |
| `server/src/services/feed-query-service.ts#clamp-page-size` | Kẹp kích thước trang để chặn client xin quá nhiều | `lesson-02` |
| `server/src/services/feed-query-service.ts#build-normalized-entities` | Gom user/media/post thành map theo id, số query không phụ thuộc số bài | `shared-foundations` (đã dùng) |
| `server/src/services/feed-query-service.ts#get-feed-page` | Cursor, direction, generation và response chuẩn hoá của một trang feed | `shared-foundations` (đã dùng) |
| `server/src/services/feed-cursor-codec.ts#cursor-encode` | Cursor mờ: JSON gói trong base64url | `lesson-02` |
| `server/src/services/feed-cursor-codec.ts#cursor-decode-validate` | Giải mã và kiểm tra cursor, sai thì trả 400 thay vì 500 | `lesson-02` |
| `server/src/services/offset-feed-query-service.ts#offset-feed-query` | Endpoint offset để so sánh với cursor | `lesson-02` |
| `server/src/services/engagement-summary-builder.ts#personalize-posts` | Điền số liệu reaction theo người xem nên response phải private | `lesson-05` |
| `server/src/services/http-error.ts#http-error-class` | Lỗi có status và code để error handler đổi thành JSON thống nhất | `shared-foundations` (đã dùng) |
| `server/src/middleware/fake-session-middleware.ts#session-middleware` | Danh tính lấy từ cookie phía server và giả lập session hết hạn trả 401 | `shared-foundations` (đã dùng) |
| `server/src/middleware/simulated-latency-and-failure-middleware.ts#latency-and-failure` | Độ trễ có jitter và lỗi 503 kèm Retry-After để thử retry | `shared-foundations` (đã dùng) |
| `server/src/middleware/error-handler-middleware.ts#error-handler` | Chuẩn hoá lỗi, không lộ chi tiết lỗi 500 cho client | `shared-foundations` (đã dùng) |
| `server/src/middleware/request-logger-middleware.ts#request-logger` | Log mỗi request kèm thời gian và idempotency key | `shared-foundations` (đã dùng) |
| `server/src/routes/telemetry-routes.ts#telemetry-validate-batch` | Validate lô sự kiện: số hữu hạn, cận trên, độ dài postId | `lesson-11` |
| `server/src/routes/telemetry-routes.ts#telemetry-post-route` | Nhận cả text/plain của sendBeacon lẫn JSON và trả 204 | `lesson-11` |
| `server/src/routes/media-routes.ts#media-upload` | Upload ảnh trước, kiểm tra type, lưu chủ sở hữu | `lesson-06` |
| `server/src/routes/media-routes.ts#media-serve-nosniff` | Phục vụ ảnh với nosniff, CSP sandbox và cache theo loại ảnh | `lesson-07` |
| `server/src/routes/reaction-routes.ts#reaction-write-confirmed-at` | Ghi reaction rồi trả số liệu mới kèm confirmedAt làm sự thật | `lesson-05` |
| `server/src/routes/reaction-routes.ts#reaction-put-route` | PUT reaction: validate rồi UPSERT | `lesson-05` |
| `server/src/routes/feed-routes.ts#feed-route-private-cache` | GET /api/feed và Cache-Control private vì feed cá nhân hoá | `shared-foundations` (đã dùng) |
| `server/src/routes/session-routes.ts#session-refresh-route` | Làm mới session đã hết hạn | `lesson-12` |
| `server/src/create-express-app.ts#middleware-pipeline` | Thứ tự middleware chính là đường đi của một request | `shared-foundations` (đã dùng) |
| `server/src/data/database-schema.ts#posts-table-feed-index` | Bảng posts và index (created_at DESC, id DESC) cho cursor | `shared-foundations` (đã dùng) |
| `server/src/data/database-schema.ts#reactions-table` | Khoá chính (post_id, user_id) khiến PUT/DELETE reaction tự idempotent | `lesson-05` |
| `server/src/data/database-schema.ts#idempotency-keys-table` | Khoá chính (viewer_id, key) chặn hai request cùng key ghi song song | `shared-foundations` (đã dùng) |
| `server/src/data/database-schema.ts#feed-state-single-row` | Một dòng duy nhất giữ feed generation | `lesson-09` |
| `server/src/data/database-schema.ts#telemetry-events-table` | Bảng sự kiện telemetry và index theo (type, created_at) | `lesson-11` |
| `server/src/data/database-pool.ts#drizzle-setup` | Kiểu QueryExecutor dùng chung cho db và transaction, casing snake_case | `shared-foundations` (đã dùng) |
| `server/src/data/seed-database.ts#reset-and-seed` | TRUNCATE rồi seed lại trong một transaction | `shared-foundations` (đã dùng) |
| `server/src/data/seed-database.ts#run-migrations` | Áp migration chưa chạy và phát hiện DB cũ không có lịch sử migration | `shared-foundations` (đã dùng) |
| `shared-contracts/feed-api-contracts.ts#contract-user-relationship` | User và quan hệ với viewer do server tính theo session | `lesson-03` |
| `shared-contracts/feed-api-contracts.ts#contract-text-entity` | Entity ranges thay cho HTML, offset UTF-16 trên text | `shared-foundations` (đã dùng) |
| `shared-contracts/feed-api-contracts.ts#contract-engagement-summary` | Số liệu tương tác và vài người react mẫu | `lesson-05` |
| `shared-contracts/feed-api-contracts.ts#contract-post` | Post chỉ giữ authorId và mediaIds để client chuẩn hoá | `shared-foundations` (đã dùng) |
| `shared-contracts/feed-api-contracts.ts#contract-feed-page` | FeedPageInfo và NormalizedFeedResponse | `shared-foundations` (đã dùng) |
| `shared-contracts/feed-api-contracts.ts#contract-offset-feed` | Response của phân trang offset | `lesson-02` |
| `shared-contracts/feed-api-contracts.ts#contract-reaction-response` | ReactionResponse kèm confirmedAt để các tab bỏ bản cập nhật cũ | `shared-foundations` (đã dùng) |
| `shared-contracts/feed-api-contracts.ts#contract-create-post` | Request và response tạo bài | `lesson-06` |
| `shared-contracts/feed-api-contracts.ts#contract-api-error` | Hình dạng lỗi thống nhất giữa server và client | `shared-foundations` (đã dùng) |
| `shared-contracts/feed-api-contracts.ts#contract-telemetry-event` | Union các loại sự kiện telemetry | `lesson-11` |
| `shared-contracts/feed-api-contracts.ts#contract-simulation-and-headers` | Cấu hình mô phỏng và tên header dùng chung | `lesson-12` |
| `src/shared/types/feed-entities.ts#client-reexport-contract` | Client re-export hợp đồng từ shared-contracts | `shared-foundations` (đã dùng) |
| `src/shared/api/http-client.ts#http-api-error` | ApiError mang status và code để phân loại lỗi | `shared-foundations` (đã dùng) |
| `src/shared/api/http-client.ts#http-request-options` | Các tuỳ chọn retry, dedupe, signal của một request | `shared-foundations` (đã dùng) |
| `src/shared/api/http-client.ts#http-retry-policy` | Chỉ retry khi an toàn và lỗi là lỗi tạm thời | `shared-foundations` (đã dùng) |
| `src/shared/api/http-client.ts#http-backoff-jitter` | Retry-After hoặc exponential backoff với equal jitter | `shared-foundations` (đã dùng) |
| `src/shared/api/http-client.ts#http-sleep-abortable` | Chờ có thể huỷ bằng AbortSignal | `lesson-04` |
| `src/shared/api/http-client.ts#http-session-epoch` | Epoch đếm số lần refresh để xử lý 401 tới muộn | `shared-foundations` (đã dùng) |
| `src/shared/api/http-client.ts#http-refresh-with-retry` | Refresh retry lỗi tạm thời, chỉ 4xx mới yêu cầu đăng nhập lại | `shared-foundations` (đã dùng) |
| `src/shared/api/http-client.ts#http-refresh-single-flight` | Nhiều request cùng 401 chỉ gọi refresh một lần | `shared-foundations` (đã dùng) |
| `src/shared/api/http-client.ts#http-dedupe-get` | Gộp GET trùng URL đang bay thành một request mạng | `shared-foundations` (đã dùng) |
| `src/shared/api/http-client.ts#http-request-body-and-headers` | Dựng body JSON hoặc raw và gắn Idempotency-Key | `shared-foundations` (đã dùng) |
| `src/shared/api/http-client.ts#http-retry-loop` | Vòng gửi: 401 refresh một lần, lỗi tạm thì backoff rồi gửi lại | `shared-foundations` (đã dùng) |
| `src/shared/api/http-client.ts#http-idempotency-key` | Sinh key một lần khi bấm gửi và giữ qua mọi lần retry | `lesson-06` |
| `src/shared/api/feed-api.ts#feed-api-fetch-page` | Client gọi trang feed bằng cursor và direction | `shared-foundations` (đã dùng) |
| `src/shared/api/feed-api.ts#feed-api-set-reaction` | Reaction không tự retry để thấy rollback | `lesson-05` |
| `src/shared/api/feed-api.ts#feed-api-upload-media` | Upload ảnh bằng body raw kèm kích thước trong header | `lesson-06` |
| `src/shared/api/feed-api.ts#feed-api-create-post` | Tạo bài luôn kèm idempotency key | `lesson-06` |
| `src/shared/api/feed-api.ts#feed-api-send-telemetry` | Gửi telemetry bằng fetch keepalive và phân loại lỗi | `lesson-11` |
| `src/shared/api/latest-intent-queue.ts#latest-intent-queue` | Mỗi khoá chỉ một lần chạy, ý định mới đè ý định chờ | `lesson-05` |
| `src/shared/hooks/use-feed-loader.ts#feed-loader-initial-size` | Số bài trang đầu suy ra từ chiều cao viewport | `lesson-04` |
| `src/shared/hooks/use-feed-loader.ts#feed-loader-load-pages` | InFlightRef chặn tải chồng, cursor lấy từ ref mới nhất | `shared-foundations` (đã dùng) |
| `src/shared/hooks/use-feed-loader.ts#feed-loader-load-older` | Chỉ tải tiếp khi còn bài cũ hơn | `lesson-04` |
| `src/shared/hooks/use-feed-loader.ts#feed-loader-reload` | Tải lại từ đầu dùng chung cờ inFlight | `lesson-09` |
| `src/shared/hooks/use-feed-loader.ts#feed-loader-sentinel` | Sentinel chỉ bật khi rảnh và observe lại khi số bài đổi | `lesson-04` |
| `src/shared/hooks/use-intersection-sentinel.ts#intersection-sentinel` | IntersectionObserver với rootMargin và observeKey để không bị kẹt | `lesson-04` |
| `src/shared/post-rendering/render-post-body-with-entities.tsx#safe-href` | Chỉ cho phép http, https, mailto để chặn javascript: | `lesson-06` |
| `src/shared/post-rendering/render-post-body-with-entities.tsx#split-text-by-entities` | Cắt text theo entity ranges, entity sai thì bỏ qua | `lesson-06` |
| `src/shared/post-rendering/render-post-body-with-entities.tsx#render-entity` | Mỗi entity thành phần tử React, React tự escape | `lesson-06` |
| `src/shared/post-rendering/render-post-body-with-entities.tsx#post-body-text` | Ghép các đoạn thành nội dung bài mà không dùng innerHTML | `lesson-06` |
| `src/shared/post-rendering/responsive-post-image.tsx#responsive-post-image` | Srcset, aspect-ratio giữ chỗ, lazy loading và decoding async | `lesson-07` |
| `src/shared/post-rendering/responsive-post-image.tsx#post-media-grid` | Lưới ảnh 1 đến 4 và gộp ảnh thừa thành +N | `lesson-07` |
| `src/shared/post-rendering/format-relative-time.ts#intl-formatter-cache` | Cache Intl formatter theo locale vì tạo rất tốn kém | `lesson-07` |
| `src/shared/post-rendering/format-relative-time.ts#format-relative-time` | Thời gian tương đối bằng Intl.RelativeTimeFormat | `lesson-07` |
| `src/shared/post-rendering/format-relative-time.ts#use-now-clock` | Một đồng hồ chung tick mỗi phút cho mọi timestamp | `lesson-07` |
| `src/shared/post-rendering/format-compact-count.ts#compact-count` | Số đếm gọn bằng Intl.NumberFormat compact | `lesson-07` |
| `src/shared/post-rendering/format-compact-count.ts#plural-rules-comment-count` | Chọn chuỗi số nhiều theo Intl.PluralRules | `lesson-07` |
| `src/shared/post-rendering/format-reactor-list.ts#reactor-list-format` | Intl.ListFormat và cách đếm "N người khác" không tính viewer | `lesson-07` |
| `src/shared/post-rendering/expandable-post-text.tsx#expandable-post-text` | Line-clamp bằng CSS, aria-expanded và dir=auto | `lesson-07` |
| `src/shared/post-rendering/feed-post-article.tsx#feed-post-article` | Role article, aria-posinset, aria-setsize theo WAI-ARIA feed pattern và tên người react lấy từ store | `lesson-07` |
| `src/shared/sync/cross-tab-reaction-sync.ts#sync-message-types` | Tin nhắn đồng bộ và kênh tách theo viewer | `lesson-09` |
| `src/shared/sync/cross-tab-reaction-sync.ts#sync-message-validate` | Dữ liệu từ kênh là đầu vào ngoài nên phải kiểm tra hình dạng | `lesson-09` |
| `src/shared/sync/cross-tab-reaction-sync.ts#confirmed-at-tracker` | Chỉ áp dụng bản có confirmedAt mới hơn bản đã biết | `lesson-09` |
| `src/shared/sync/cross-tab-reaction-sync.ts#deferred-patch-buffer` | Giữ bản mới nhất theo bài khi chưa áp được để không mất dữ liệu | `lesson-09` |
| `src/shared/sync/cross-tab-reaction-sync.ts#sync-channel-on-message` | Nhận tin: kiểm tra, so confirmedAt, áp hoặc giữ lại | `lesson-09` |
| `src/shared/sync/cross-tab-reaction-sync.ts#sync-channel-publish-flush-close` | Phát sau khi server xác nhận, áp lại tin bị hoãn, đóng kênh | `lesson-09` |
| `src/shared/sync/use-cross-tab-reaction-sync.ts#cross-tab-apply-patch` | Không ghi đè bài đang chờ server | `lesson-09` |
| `src/shared/sync/use-cross-tab-reaction-sync.ts#cross-tab-open-channel` | Mở kênh theo viewerId, không có session thì tắt đồng bộ | `lesson-09` |
| `src/shared/sync/use-cross-tab-reaction-sync.ts#cross-tab-flush-deferred` | Bài hết chờ thì áp lại các tin đã hoãn | `lesson-09` |
| `src/shared/lazy/lazy-with-preload.ts#lazy-with-preload` | React.lazy và preload dùng chung một Promise của import() | `lesson-10` |
| `src/shared/lazy/lazy-with-preload.ts#preload-on-idle` | Prefetch ưu tiên thấp khi trình duyệt rảnh | `lesson-10` |
| `src/shared/lazy/chunk-error-boundary.tsx#chunk-error-boundary` | Chunk phụ hỏng chỉ làm mất tính năng phụ, không sập cả cây React | `lesson-10` |
| `src/shared/offline/post-outbox.ts#outbox-item-and-events` | Mục outbox giữ idempotencyKey và trạng thái pending hoặc rejected | `lesson-12` |
| `src/shared/offline/post-outbox.ts#outbox-transient-error` | Phân loại lỗi tạm thời và lỗi bị từ chối vĩnh viễn | `lesson-12` |
| `src/shared/offline/post-outbox.ts#outbox-enqueue` | Lưu ý định kèm idempotencyKey sinh một lần | `lesson-12` |
| `src/shared/offline/post-outbox.ts#outbox-run-flush` | Gửi tuần tự cùng key, phân loại lỗi, xử lý mục bị bỏ giữa chừng | `lesson-12` |
| `src/shared/offline/post-outbox.ts#outbox-flush-single-flight` | Đang flush thì mọi lời gọi nhận lại đúng promise đó | `lesson-12` |
| `src/shared/offline/indexed-db-store.ts#key-value-store-and-viewer-db` | Interface KeyValueStore và tên IndexedDB tách theo viewer | `lesson-12` |
| `src/shared/offline/indexed-db-store.ts#indexed-db-open-store` | Mỗi thao tác một transaction, ghi chỉ xong khi transaction commit | `lesson-12` |
| `src/shared/offline/use-online-status.ts#use-online-status` | UseSyncExternalStore theo sự kiện online và offline | `lesson-12` |
| `public/sw.js#sw-cache-names` | Tên cache có version và danh sách đường dẫn bỏ qua của Vite | `lesson-12` |
| `public/sw.js#sw-install-activate` | SkipWaiting, claim và dọn cache version cũ | `lesson-12` |
| `public/sw.js#sw-cache-first` | Cache-first cho ảnh và asset bất biến | `lesson-12` |
| `public/sw.js#sw-mark-from-cache` | Tạo Response mới gắn header X-From-SW-Cache | `lesson-12` |
| `public/sw.js#sw-viewer-scoped-cache` | Cache feed tách theo viewer và giới hạn số entry | `lesson-12` |
| `public/sw.js#sw-network-first-feed` | Feed network-first, chỉ khi mất mạng mới trả cache kèm header | `lesson-12` |
| `public/sw.js#sw-network-first-navigation` | Điều hướng ưu tiên mạng, mất mạng rơi về app shell | `lesson-12` |
| `public/sw.js#sw-fetch-router` | Định tuyến chiến lược theo loại request, non-GET không đụng vào | `lesson-12` |
| `public/sw.js#sw-background-sync` | Background Sync chỉ nhắn tab flush outbox | `lesson-12` |
| `public/sw.js#sw-message-handler` | Nhận set-viewer và clear-caches từ tab, kiểm tra dữ liệu | `lesson-12` |
| `src/app-lesson-picker.tsx#hash-router` | SPA điều hướng bằng hash để giữ store, cache và vị trí scroll | `shared-foundations` (đã dùng) |
| `src/app-lesson-picker.tsx#lesson-lazy-suspense` | Mỗi lesson là một chunk tải lười bằng React.lazy và Suspense | `shared-foundations` (đã dùng) |
