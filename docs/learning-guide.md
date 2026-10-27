# Learning guide — News Feed theo RADIO

Bài gốc: <https://www.greatfrontend.com/questions/system-design/news-feed-facebook?format=system-design>

Khi phỏng vấn system design phía frontend, câu trả lời thường đi theo khung **RADIO**:

1. **R**equirements: làm gì và không làm gì.
2. **A**rchitecture: chia hệ thống thành các khối.
3. **D**ata model: dữ liệu nằm ở đâu, có hình dạng thế nào.
4. **I**nterface: API giữa các khối.
5. **O**ptimizations: đi sâu vào hiệu năng, UX, a11y, i18n.

Mỗi mục dưới đây trỏ tới code tương ứng trong repo. Cách học hiệu quả nhất:

1. Đọc mục tương ứng trong bài.
2. Mở lesson và làm theo khối "Cần quan sát gì".
3. Đọc file code được liệt kê.
4. Trả lời câu hỏi tự kiểm tra.

Bài giảng chi tiết cho từng lesson, có code thật nhúng từ source, sơ đồ và câu hỏi phỏng vấn, nằm ở `docs/lessons/` và cũng hiện trong app ở tab **📖 Bài học**:

- Nền tảng dùng chung: [shared-foundations.md](lessons/shared-foundations.md)
- [Lesson 01](lessons/lesson-01.md) · [02](lessons/lesson-02.md) · [03](lessons/lesson-03.md) · [04](lessons/lesson-04.md) · [05](lessons/lesson-05.md) · [06](lessons/lesson-06.md) · [07](lessons/lesson-07.md) · [08](lessons/lesson-08.md) · [09](lessons/lesson-09.md) · [10](lessons/lesson-10.md) · [11](lessons/lesson-11.md) · [12](lessons/lesson-12.md)

---

## R — Requirements

| Yêu cầu trong bài | Có trong project? | Ở đâu |
|---|---|---|
| Xem feed của mình và bạn bè | Có | Mọi lesson |
| React/bỏ react (6 loại) | Có | Lesson 05, 07, 08 |
| Đăng bài có chữ và ảnh | Có | Lesson 06 |
| Cuộn để tải thêm, thấy bài mới | Có | Lesson 04 |
| Comment, share, ranking, ads | Không (ngoài phạm vi, như bài) | — |
| Non-functional: nhanh, mượt, chịu mạng kém, a11y, i18n | Có | Lesson 04, 05, 07, 08 + panel mô phỏng mạng |

**Lesson 01**: `src/lessons/01-basic-feed/lesson-01-basic-feed.tsx`

## A — Architecture

| Layer | Vai trò | Code |
|---|---|---|
| Server | Nguồn sự thật, cá nhân hoá, validate | `server/src/create-express-app.ts` |
| Database | PostgreSQL (Docker) + Drizzle ORM; mọi truy cập DB nằm trong repository | `server/src/data/database-schema.ts`, `server/src/data/feed-repository.ts` |
| Data access | Mọi HTTP, retry/backoff, idempotency | `src/shared/api/http-client.ts`, `src/shared/api/feed-api.ts` |
| Store | State phía client, đã chuẩn hoá theo id | `src/lessons/03-normalized-store/feed-store-reducer.ts` |
| View | Component React, chỉ đọc store | `src/shared/post-rendering/feed-post-article.tsx` |

- **CSR cho feed**: nội dung cá nhân hoá và nhiều tương tác. SSR chỉ hợp cho trang public như permalink bài viết.
- **SPA**: điều hướng giữa các lesson không tải lại trang (`src/app-lesson-picker.tsx`). Mỗi lesson là một chunk tải bằng `React.lazy` (`src/lessons/lesson-registry.ts`).

## D — Data model

| Entity | Định nghĩa | Lưu ở client |
|---|---|---|
| Post, User, Media, PostBody, TextEntity, EngagementSummary | `shared-contracts/feed-api-contracts.ts` | `postsById`, `usersById`, `mediaById` |
| Feed (postIds, cursors, generation) | `FeedPageInfo` | `feed` trong store |
| ComposerDraft | `src/lessons/06-composer-upload/composer-draft-reducer.ts` | State cục bộ của composer |

**Lesson 03**: đổi tên một user thì mọi bài của user đó cập nhật theo, vì chỉ có một bản ghi.

## I — Interface (API)

| Endpoint | Server | Client |
|---|---|---|
| `GET /api/feed?count&cursor&direction` | `server/src/routes/feed-routes.ts`, `server/src/services/feed-query-service.ts` | `fetchFeedPage` |
| `PUT/DELETE /api/posts/:id/reaction` | `server/src/routes/reaction-routes.ts` | `setReaction`, `removeReaction` |
| `POST /api/media/uploads` | `server/src/routes/media-routes.ts` | `uploadMedia` |
| `POST /api/posts` + `Idempotency-Key` | `server/src/routes/post-routes.ts`, `server/src/services/idempotency-store.ts` | `createPost` |

Các quyết định quan trọng, mỗi quyết định có test chứng minh:

- **Cursor ở tầng DB** (Drizzle: `sql` template trong `getPostsOlderThan`): `WHERE (created_at, id) < ($1, $2) ORDER BY created_at DESC, id DESC LIMIT n+1`, đi kèm index `(created_at DESC, id DESC)`. Truy vấn nhanh như nhau dù ở trang nào; ngược lại OFFSET buộc DB đọc rồi bỏ qua N dòng. Xem bằng `npm run db:psql` rồi `EXPLAIN ANALYZE`.
- **Cursor mờ** (`server/src/services/feed-cursor-codec.ts`): server mã hoá vị trí trong feed thành một chuỗi mà client không cần hiểu. Test `feed-query-service.test.ts` chứng minh lật hết các trang không bị trùng hay sót bài kể cả khi có bài mới chèn vào. Lesson 02 cho thấy offset thì bị trùng.
- **Response chuẩn hoá**: `{ feed, posts, users, media }`.
- **Danh tính lấy từ session** (`server/src/middleware/fake-session-middleware.ts`): server không nhận `userId` từ client.
- **`Cache-Control: private`** cho feed vì feed đã cá nhân hoá.
- **Idempotency key** (lesson 06): client retry an toàn mà không tạo bài trùng. Ở server, tạo bài và lưu key nằm trong **cùng một transaction**; khoá chính `(viewer_id, key)` chặn trường hợp hai request cùng key chạy song song. Cùng key nhưng khác nội dung thì trả 422.

## O — Optimizations

| Chủ đề trong bài | Lesson | File |
|---|---|---|
| Infinite scroll bằng IntersectionObserver, prefetch trước một viewport | 04 | `src/shared/hooks/use-intersection-sentinel.ts` |
| Trang đầu tải số bài theo chiều cao màn hình | 04 | `src/shared/hooks/use-feed-loader.ts` |
| Skeleton thay spinner | 04 | `src/shared/ui/post-skeleton.tsx` |
| Banner "Có bài mới" (stale feed) | 04 | `src/lessons/04-infinite-scroll/new-posts-banner.tsx` |
| Optimistic update, rollback, race (sequence number) | 05 | `src/lessons/05-optimistic-reaction/reaction-reducer-with-rollback.ts` |
| Retry: exponential backoff, jitter, `Retry-After` | 01–08 | `src/shared/api/http-client.ts` |
| Upload ảnh trước, idempotency, chèn bài tạm | 06 | `src/lessons/06-composer-upload/*` |
| Thu nhỏ ảnh và bỏ EXIF trước khi upload | 06 | `src/lessons/06-composer-upload/prepare-image-for-upload.ts` |
| Mention/hashtag bằng entity ranges, chặn URL `javascript:` | 07 | `src/shared/post-rendering/render-post-body-with-entities.tsx` |
| srcset, lazy load, giữ chỗ bằng aspect-ratio, placeholder | 07 | `src/shared/post-rendering/responsive-post-image.tsx` |
| Thời gian tương đối bằng `Intl`, dùng một timer chung | 07 | `src/shared/post-rendering/format-relative-time.ts` |
| Số gọn (103K), `Intl.PluralRules` | 07 | `src/shared/post-rendering/format-compact-count.ts` |
| "Xem thêm", `dir="auto"` | 07 | `src/shared/post-rendering/expandable-post-text.tsx` |
| `role="feed"`, `aria-posinset`/`aria-setsize`, `aria-busy`, skip link | 07 | `src/lessons/07-perf-a11y-images/lesson-07-perf-a11y-images.tsx`, `src/shared/ui/lesson-layout.tsx` |
| Reaction picker dùng được bằng bàn phím, Esc để đóng | 05 | `src/lessons/05-optimistic-reaction/reaction-picker.tsx` |
| RTL bằng CSS logical properties, `prefers-reduced-motion` | 07 | `src/shared/styles/global.css` |
| Virtualization: spacer, đo chiều cao, bù scroll | 08 | `src/lessons/08-virtualization/*` |
| `content-visibility: auto` | 08 | `src/shared/styles/global.css` (`.feed--content-visibility`) |

### Bảng độ bao phủ bài viết

✅ = có code chạy được · 📘 = chỉ lý thuyết (giải thích bên dưới)

| Mục trong bài | | Lesson / file |
|---|---|---|
| Requirements: tính năng, loại bài, infinite scroll, mobile | ✅ | 01, guide phần R |
| Rendering: CSR / SSR / hybrid | ✅/📘 | 01 (CSR); SSR là 📘 |
| Navigation: SPA vs MPA | ✅ | `src/app-lesson-picker.tsx`; 09 (state và scroll còn nguyên khi chuyển route) |
| Các layer View / Store / Data access / Server | ✅ | 01 |
| Post entity, entity ranges (UTF-16, NFC) | ✅ | 07, 10 (`composer-entity-parser.ts`), server `post-routes.ts` (bắt buộc NFC) |
| User entity, quan hệ với người xem | ✅ | `feed-repository.getUsersByIds`, 10 (hover card) |
| Feed entity: cursor, generation, lastFetchedAt | ✅ | 03, 09 (feed cũ) |
| Normalized store | ✅ | 03 |
| API, danh tính từ session | ✅ | backend, `fake-session-middleware.ts` |
| Offset vs cursor | ✅ | 02 |
| Số bài trang đầu theo màn hình | ✅ | 04 (`use-feed-loader.ts`) |
| Cache `private`, tách dữ liệu theo tài khoản | ✅ | `feed-routes.ts`; 12 (IndexedDB theo viewer), 09 (BroadcastChannel theo viewer) |
| Gộp request trùng + AbortController | ✅ | `http-client.ts` (gộp GET trùng), 09 (trang chi tiết), 01 |
| Reaction tuần tự / sequence number | ✅ | 05 (`LatestIntentQueue` + `requestSeq`) |
| Idempotency key | ✅ | 06, 10, 12 |
| Tạo bài: upload ảnh trước, chèn bài optimistic | ✅ | 06 |
| Virtualization, focus, Ctrl+F | ✅ | 08, 09 (ghim bài đang focus, Page Up/Down) |
| Infinite scroll bằng IntersectionObserver | ✅ | 04 |
| Skeleton | ✅ | 04 |
| Giữ vị trí scroll khi quay lại | ✅ | 09 (`scroll-anchor.ts`) |
| Feed cũ: banner bài mới, nhắc tải lại, đồng bộ tab | ✅ | 04 (banner), 09 (nhắc tải lại, BroadcastChannel) |
| Data-driven dependencies (Relay `@match`) | ✅ | 10 (`post-renderer-registry.ts`) |
| Mention/hashtag: entity ranges và các cách khác | ✅ | 07, 10 |
| Render rich text an toàn | ✅ | 07 (`render-post-body-with-entities.tsx`), 10 (chặn paste HTML) |
| Ảnh: srcset, lazy, giữ chỗ, alt, bỏ EXIF | ✅ | 06, 07 (AVIF/BlurHash là 📘) |
| Lazy-load code tương tác | ✅ | 10 (reaction menu, hover card, emoji picker) |
| Optimistic update | ✅ | 05, 06, 12 |
| Hiển thị thời gian | ✅ | 07 (`Intl`); các cách khác là 📘 |
| Hiển thị icon (5 cách) | 📘 | – |
| Cắt bài dài, số gọn | ✅ | 07 |
| Composer: editor, paste, model nội bộ khác wire format | ✅ | 06, 10 |
| Composer: lazy-load picker | ✅ | 10 (emoji picker) |
| Error states | ✅ | 04, 05, 12 |
| Đọc offline (Service Worker, cache) | ✅ | 12 (`public/sw.js`) |
| Ghi offline bằng outbox, Background Sync | ✅ | 12 (`post-outbox.ts`) |
| Retry: backoff, jitter, Retry-After | ✅ | `http-client.ts` |
| Retry: 401 làm mới token, 404 tuỳ endpoint | ✅ | `http-client.ts`, 12 |
| Comments, live updates (SSE/WebSocket) | 📘 | 04 có short polling |
| Core Web Vitals, budget | ✅ | 11 |
| Chia JS theo tầng, prefetch | ✅ | 10 |
| Web Worker, `scheduler.postTask` | 📘 | – |
| `content-visibility: auto` | ✅ | 08 |
| Đo thật (RUM) | ✅ | 11 (gửi web vital về server, tính p75) |
| A11y: feed, article, tương tác, aria-live, reduced motion | ✅ | 05, 07, 09 |
| i18n: RTL, `dir="auto"`, PluralRules, NumberFormat, ListFormat | ✅ | 07, `format-reactor-list.ts` |
| Telemetry: lượt hiển thị, dwell time, gửi theo lô bằng beacon | ✅ | 11 |
| Báo lỗi (Sentry), feature flag | 📘 | – |

### Chỉ có lý thuyết, không viết code

- **SSR/hybrid** cho permalink bài viết và trang chưa đăng nhập: cần SEO và hiển thị nhanh lần đầu. Khi render trên server thì không biết chiều cao màn hình, nên phải tải dư vài bài.
- **Live updates**: short polling (lesson 04 dùng cách này), long polling, SSE, WebSocket (lựa chọn mặc định khi quy mô lớn). Chỉ subscribe các bài đang hiển thị; bài quá "hot" thì chỉ đẩy số đếm, có throttle.
- **Comments**: phân trang bằng cursor như feed; thêm comment theo kiểu optimistic; trang chi tiết bài tải reply khi cần.
- **Hiển thị icon**: file ảnh rời, spritesheet, icon font, SVG, SVG nhúng thẳng. Các feed lớn đang chuyển dần sang SVG nhúng thẳng.
- **Hiển thị thời gian**: server gửi timestamp thô, server dịch sẵn, hoặc client format bằng `Intl` (project dùng cách cuối).
- **Ảnh nâng cao**: CDN trả AVIF/WebP qua `<picture>`, placeholder BlurHash/LQIP.
- **Main thread**: chuyển phần xử lý dữ liệu nặng sang Web Worker; nhường main thread bằng `scheduler.postTask()`.
- **Vận hành**: báo lỗi bằng Sentry kèm source map, lấy mẫu theo bề mặt; bật/tắt tính năng bằng feature flag, đọc trong data access layer.
- **Bảo mật**: CSP chặt chẽ; chỉ dùng DOMPurify khi thật sự phải render HTML; server re-encode và quét ảnh upload.

---

## Câu hỏi tự kiểm tra

### Lesson 01 – Architecture
*Đáp án gợi ý và câu hỏi mở rộng: [lesson-01.md](lessons/lesson-01.md), mục "Câu hỏi phỏng vấn".*

1. Vì sao View không nên gọi `fetch` trực tiếp?
   > Để gom retry, cache, auth, đổi base URL và mock test vào một chỗ (data access layer).
2. Khi nào chọn SSR thay vì CSR cho feed?
   > Trang public cần SEO hoặc cần hiển thị nhanh lần đầu (permalink, logged-out). Feed đã đăng nhập thì cá nhân hoá và nhiều tương tác, nên CSR hợp hơn.
3. AbortController trong `useEffect` giải quyết vấn đề gì?
   > Huỷ request thừa khi rời trang hoặc khi effect chạy lại (StrictMode, đổi deps): tiết kiệm băng thông và không để response cũ ghi đè state mới.

### Lesson 02 – Pagination
*Đáp án gợi ý và câu hỏi mở rộng: [lesson-02.md](lessons/lesson-02.md), mục "Câu hỏi phỏng vấn".*

1. Offset pagination gặp lỗi gì với feed?
   > Bài mới chèn lên đầu đẩy các bài cũ xuống, nên trang sau lặp lại bài đã thấy. Khi có bài bị xoá thì ngược lại: bị sót bài.
2. Vì sao cursor phải "mờ" (opaque)?
   > Client không phụ thuộc vào format bên trong, nên server đổi cách mã hoá (thêm field, ký số) mà không làm hỏng client.
3. Điều kiện để cursor hoạt động đúng?
   > Thứ tự sắp xếp phải ổn định và tất định, ví dụ `(createdAt, id)`.

### Lesson 03 – Normalized store
*Đáp án gợi ý và câu hỏi mở rộng: [lesson-03.md](lessons/lesson-03.md), mục "Câu hỏi phỏng vấn".*

1. Lợi ích của việc chuẩn hoá theo id?
   > Mỗi entity chỉ có một bản sao; cập nhật một chỗ thì mọi nơi đổi theo; tìm theo id mất O(1); nhiều màn hình dùng chung dữ liệu.
2. Chuẩn hoá ở server hay ở client?
   > Server trả sẵn dạng chuẩn hoá (như ở đây) thì client đỡ việc. Nếu không, data access layer tự chuẩn hoá (normalizr, Apollo, Relay).

### Lesson 04 – Infinite scroll
*Đáp án gợi ý và câu hỏi mở rộng: [lesson-04.md](lessons/lesson-04.md), mục "Câu hỏi phỏng vấn".*

1. Vì sao dùng IntersectionObserver thay vì sự kiện `scroll`?
   > Sự kiện scroll bắn rất dày; đọc layout trong handler gây giật. IntersectionObserver chạy bất đồng bộ và rẻ hơn.
2. `rootMargin: "100% 0px"` để làm gì?
   > Bắt đầu tải trang tiếp khi người dùng còn cách cuối list khoảng một màn hình, nên hiếm khi thấy skeleton.
3. Vì sao không tự chèn bài mới lên đầu feed?
   > Nội dung bị nhảy và người dùng mất chỗ đang đọc. Hiện banner để người dùng tự bấm.
4. Lỗi kinh điển: tải xong mà sentinel vẫn nằm trong vùng quan sát thì sao?
   > IntersectionObserver không bắn lại vì trạng thái không đổi. Phải observe lại (`observeKey` trong hook).

### Lesson 05 – Optimistic update
*Đáp án gợi ý và câu hỏi mở rộng: [lesson-05.md](lessons/lesson-05.md), mục "Câu hỏi phỏng vấn".*

1. Khi nào nên dùng optimistic update?
   > Khi thao tác gần như luôn thành công và rollback dễ (reaction, like). Không nên dùng cho thanh toán.
2. Bấm Like rồi Unlike nhanh thì xử lý race thế nào?
   > Cần hai lớp. (1) **Thứ tự server ghi**: gửi tuần tự theo từng bài. Khi đang có request bay, chỉ nhớ ý định mới nhất, đợi request xong mới gửi. Nếu gửi song song, server có thể ghi "Like" sau "Unlike", khiến UI và DB lệch nhau vĩnh viễn. (2) **Thứ tự response ở client**: mỗi lần bấm mang một số thứ tự; chỉ kết quả của thao tác mới nhất được thay đổi UI. Cách khác cho (1) là gửi version/seq lên để server bỏ qua các lần ghi cũ.
3. Sau khi optimistic, vì sao vẫn dùng số liệu server trả về?
   > Server là nguồn sự thật, và có thể người khác cũng vừa react.

### Lesson 06 – Composer
*Đáp án gợi ý và câu hỏi mở rộng: [lesson-06.md](lessons/lesson-06.md), mục "Câu hỏi phỏng vấn".*

1. Vì sao upload ảnh tách khỏi bước tạo bài?
   > Upload lâu và có thể lỗi riêng, người dùng vừa gõ vừa chờ được, và bài chỉ được tạo khi ảnh đã sẵn sàng. Bản production thường dùng presigned URL để upload thẳng lên storage.
2. Idempotency key sinh khi nào, giữ đến khi nào?
   > Sinh khi bấm gửi lần đầu, giữ nguyên qua mọi lần retry, bỏ khi nội dung thay đổi hoặc khi đăng thành công.
3. Vì sao không tự viết editor bằng `contenteditable`?
   > Rất khó làm đúng selection, IME tiếng Việt, paste HTML bẩn, undo. Nên dùng Lexical, TipTap hoặc Slate.

### Lesson 07 – Ảnh, a11y, i18n
*Đáp án gợi ý và câu hỏi mở rộng: [lesson-07.md](lessons/lesson-07.md), mục "Câu hỏi phỏng vấn".*

1. Làm sao để ảnh không gây CLS?
   > Đặt sẵn `width`/`height` hoặc `aspect-ratio` để giữ chỗ trước khi ảnh tải xong, thêm màu nền làm placeholder.
2. Vì sao lưu mention dưới dạng entity ranges thay vì HTML?
   > Không phải chèn HTML (chống XSS), client tự quyết cách render, và dùng được cho nhiều nền tảng.
3. `aria-setsize="-1"` nghĩa là gì?
   > Chưa biết tổng số bài vì đang dùng infinite scroll.
4. Vì sao offset của entity phải thống nhất là UTF-16?
   > Emoji chiếm 2 đơn vị UTF-16. Nếu server và client đếm khác nhau thì mention bị cắt sai chỗ.

### Lesson 08 – Virtualization
*Đáp án gợi ý và câu hỏi mở rộng: [lesson-08.md](lessons/lesson-08.md), mục "Câu hỏi phỏng vấn".*

1. Đánh đổi của virtualization là gì?
   > Ctrl+F không tìm được bài đã ra khỏi DOM; focus bị mất khi item bị unmount; phải đo chiều cao và bù scroll.
2. `content-visibility: auto` khác virtualization thế nào?
   > DOM vẫn đầy đủ (Ctrl+F vẫn tìm được), trình duyệt chỉ bỏ qua layout/paint phần ngoài màn hình. Cách này rẻ hơn nhưng tốn bộ nhớ hơn.
3. Vì sao phải bù scroll khi item phía trên đổi chiều cao?
   > Nội dung bên dưới bị đẩy xuống, nên thứ người dùng đang xem bị trôi đi.

### Lesson 09 – Feed list nâng cao
*Đáp án gợi ý và câu hỏi mở rộng: [lesson-09.md](lessons/lesson-09.md), mục "Câu hỏi phỏng vấn".*

1. Vì sao lưu vị trí scroll bằng "id bài + độ lệch" thay vì số pixel?
   > Chiều cao các bài thay đổi (ảnh tải xong, "Xem thêm", virtualization ước lượng), nên một số pixel cũ không còn trỏ đúng bài. Neo theo bài thì khôi phục được đúng chỗ.
2. Khi nào nên nhắc người dùng tải lại feed?
   > Khi họ quay lại tab sau một khoảng dài (dựa trên `lastFetchedAt`). Không tự tải lại để không làm mất chỗ đang đọc.
3. `BroadcastChannel` có chia sẻ bộ nhớ giữa các tab không?
   > Không. Nó chỉ gửi tin nhắn; mỗi tab tự áp bản vá vào store của mình, và bỏ qua bản cũ hơn (dựa trên `confirmedAt`).
4. Gộp request trùng giải quyết vấn đề gì?
   > Nhiều component cùng cần một dữ liệu cùng lúc thì chỉ có 1 request mạng, và mọi nơi nhận cùng một kết quả.

### Lesson 10 – Lazy-load code
*Đáp án gợi ý và câu hỏi mở rộng: [lesson-10.md](lessons/lesson-10.md), mục "Câu hỏi phỏng vấn".*

1. Code nào nên tải lười?
   > Code không cần cho lần vẽ đầu tiên: menu, hover card, picker. Prefetch khi hover/focus hoặc lúc trình duyệt rảnh để lúc dùng không phải chờ.
2. "Waterfall dữ liệu rồi mới tới code" là gì, tránh thế nào?
   > Tải dữ liệu xong mới biết cần renderer nào, rồi mới tải code của renderer đó. Relay `@match` gửi kèm thông tin renderer trong response, để client tải code song song với dữ liệu.
3. Vì sao phải chuẩn hoá NFC trước khi tính offset của entity?
   > Cùng một chữ có dấu có thể được biểu diễn bằng số code unit khác nhau, nên server và client phải thống nhất cùng một dạng.

### Lesson 11 – Đo lường
*Đáp án gợi ý và câu hỏi mở rộng: [lesson-11.md](lessons/lesson-11.md), mục "Câu hỏi phỏng vấn".*

1. Vì sao dùng p75 thay vì trung bình?
   > Trung bình che mất phần người dùng bị chậm; p75 nghĩa là 75% lượt xem tốt hơn giá trị đó.
2. Vì sao dùng `sendBeacon` khi trang bị ẩn?
   > Trình duyệt vẫn gửi request kể cả khi trang đang đóng. Gửi bằng `fetch` thường thì có thể bị huỷ giữa chừng.
3. Một lượt hiển thị (impression) được định nghĩa thế nào?
   > Bài hiện ít nhất 50% trong ít nhất 1 giây, và chỉ tính một lần mỗi phiên.

### Lesson 12 – Resilience & offline
*Đáp án gợi ý và câu hỏi mở rộng: [lesson-12.md](lessons/lesson-12.md), mục "Câu hỏi phỏng vấn".*

1. Vì sao chỉ làm mới token đúng một lần, và gộp các request lại?
   > Nhiều request cùng nhận 401 thì không gọi refresh nhiều lần. Refresh mà vẫn lỗi thì phải đăng nhập lại, không retry vô hạn.
2. Outbox cần gì để gửi lại an toàn?
   > Giữ nguyên idempotency key qua mọi lần gửi lại; gửi tuần tự; lưu bền (IndexedDB); tách theo tài khoản.
3. Background Sync có đủ để đảm bảo bài được gửi không?
   > Không. Nó chỉ là hỗ trợ thêm (Safari không có). Vòng gửi lại ngay trong tab mới là cách đảm bảo đúng.
