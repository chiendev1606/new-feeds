# Code review: News Feed system design lessons (2026-10-27)

## Scope
- Files: `server/src/**`, `shared-contracts/feed-api-contracts.ts`, `src/shared/**`, `src/lessons/0[1-8]-*/**`, `docs/learning-guide.md`, README, plan.
- LOC: khoảng 5.8k (ts/tsx/md).
- Focus: toàn bộ project (greenfield, không có git).
- Cách kiểm chứng: đọc code. Thêm vào đó, các finding quan trọng được chạy lại trên app thật: `npm run dev`, Chrome headless qua CDP, curl vào backend. Đã dừng dev server và reset mock config sau khi test xong.

## Overall Assessment
Kiến trúc và phần giảng giải nhìn chung tốt. Cursor pagination ở server đúng, cả nhánh `direction=newer`. Render entity an toàn với XSS. Retry/backoff đúng chính sách.

Tuy vậy, **lesson 08 hỏng ở đúng khái niệm cốt lõi**: cache chiều cao bị ghi đè bằng 0, nên khi cuộn thì list nhảy qua hàng trăm bài. **Lesson 05 dạy giải pháp race chưa đủ**: UI và server lệch nhau thật, tôi tái hiện được 2/2 lần. Smoke test trước đó bỏ sót cả hai vì chỉ đếm số `article` và chỉ kiểm tra trạng thái UI, không đối chiếu với server.

---

## Critical

### C1. Lesson 08: ResizeObserver ghi chiều cao 0 cho item đã unmount, virtualization sụp
- File: `src/lessons/08-virtualization/use-measured-item-heights.ts:20-36` và `:46-56`
- Nguyên nhân: nhánh `element === null` chỉ `unobserve` khi `!observed.isConnected`. React 18 gọi ref(null) **trước** khi gỡ node khỏi DOM (`safelyDetachRef` chạy trước `removeChild`), nên lúc đó node vẫn connected. Kết quả là node không bao giờ được unobserve. Sau khi node bị gỡ, Chrome bắn ResizeObserver với `blockSize = 0`. Đã kiểm chứng riêng: `conn=false bb=0 cr=0`. Callback không kiểm tra `isConnected`, nên ghi `heightsRef[id] = 0`.
- Tái hiện (CDP, lesson 08, latency 0, bấm "Tải nhanh thêm 150 bài", cuộn từng bước 300px):
  ```
  y=1500 range 1-5    topSpacer 12px        docH 58632
  y=3000 range 37-45  topSpacer 1427px      docH 45035
  y=4500 range 115-121 topSpacer 3045px     docH 18739
  y=6000 range 225-229 (scrollY bị kẹp 5552) docH 9547
  y=7500 range 297-300 scrollY=4901         docH 5801
  ```
  Mỗi bài đã cuộn qua chỉ còn chiếm 12px (đúng bằng gap). Người dùng bỏ qua hàng trăm bài, chiều cao document co từ 57k xuống 5.8k px, và cuộn ngược không bao giờ quay lại được các bài đó. Ngoài ra `elementsRef` giữ node đã tách khỏi DOM mãi mãi, gây rò bộ nhớ.
- Fix:
  ```ts
  // trong callback RO
  if (!entry.target.isConnected) { observer.unobserve(entry.target); elementsRef.current.delete(entry.target); continue; }
  // và lưu Map<id, Element>; nhánh null: unobserve element đã lưu cho id, KHÔNG kiểm tra isConnected
  ```
  Thêm vào đó: cache ref callback theo id (`Map<id, callback>`) để không tạo hàm mới mỗi lần render (xem L1). Nên thêm test hành vi (vd test e2e cuộn tới y=6000 rồi assert `topSpacer ≈ Σ chiều cao`), vì unit test `compute-visible-range` không bắt được lỗi này.

## High

### H1. Lesson 08: gap bị cộng 2 lần, nên mỗi lần item rời viewport nội dung giật 12px (đang bị C1 che)
- File: `src/lessons/08-virtualization/virtualized-feed-list.tsx:74` (`paddingBlockEnd: ITEM_GAP`), `use-measured-item-heights.ts:25` (`borderBoxSize` đã gồm padding), `compute-visible-range.ts:50,65-66` (lại cộng `gap`).
- Kịch bản: item i rời vùng render ở phía trên. `topSpacer` tăng thêm `h+12`, nhưng DOM chỉ mất `h`, nên nội dung đang đọc trôi xuống 12px. `overflow-anchor: none` tắt luôn cơ chế bù của trình duyệt. Tổng chiều cao DOM cũng dao động theo số item đang render. Sau khi sửa C1, lỗi này sẽ lộ ra.
- Fix: truyền `gap: 0` vào `computeVisibleRange`, vì chiều cao đo được đã gồm padding. Cách khác là đo `contentBoxSize` và giữ gap. Ước lượng cho item chưa đo nên là `ESTIMATED_ITEM_HEIGHT + ITEM_GAP`.

### H2. Lesson 05: `requestSeq` chỉ sắp thứ tự *response*, không sắp thứ tự *lúc server ghi*, nên UI lệch server vĩnh viễn
- File: `src/lessons/05-optimistic-reaction/use-toggle-reaction.ts:22-36`, `reaction-reducer-with-rollback.ts:84-95`. Middleware `server/src/middleware/simulated-latency-and-failure-middleware.ts:13` có jitter ±20%, nên các request song song **được server xử lý khác thứ tự gửi**.
- Kịch bản: latency 2000ms, bấm Thích/bỏ Thích 6 lần cách nhau 30ms. Response của request #6 về và được dùng làm "sự thật". Nhưng request #5 (thứ tự ngược lại) lại tới server **sau** #6 và ghi đè. Response của #5 bị reducer bỏ qua vì record đã xoá. Tái hiện bằng CDP, 2/2 lần chạy: `post-0300 ui=true server=null MISMATCH`. Tải lại trang thì reaction "nhảy".
- Phần dạy cũng sai: lesson 05 ghi "trạng thái cuối khớp lần bấm cuối" (`lesson-05...tsx:131`), và `docs/learning-guide.md:146-147` trả lời câu hỏi race chỉ bằng sequence number phía client.
- Fix (chọn một):
  1. Serialize theo post: khi đang có request in-flight thì chỉ nhớ ý định mới nhất, đợi request xong mới gửi tiếp nếu ý định khác trạng thái đã xác nhận. Đây là cách đơn giản nhất và dạy tốt.
  2. Gửi `clientSeq`/version lên server. Server bỏ qua các ghi có seq cũ hơn (last-writer-wins theo seq).

  Cập nhật comment và learning guide cho phù hợp. Thêm integration test: hai PUT/DELETE với độ trễ đảo ngược, assert trạng thái server.

## Medium

### M1. Lesson 06: sửa text trong lúc đang submit làm xoá idempotency key, có thể tạo bài trùng
- File: `src/lessons/06-composer-upload/composer-draft-reducer.ts:47,52,54` (`contentChanged` reset `submitState='idle'` và `idempotencyKey=null` ngay cả khi đang `submitting`); `composer.tsx:91-102` (textarea và nút thêm ảnh không bị disable khi submitting).
- Kịch bản: bấm Đăng (latency 2s), gõ thêm 1 ký tự. Nút Đăng bật lại, bấm tiếp thì sinh key mới và POST lần 2, server tạo 2 bài. Khi request đầu thành công, `submitSucceeded` reset draft và xoá luôn phần chữ vừa gõ.
- Fix: trong `contentChanged`, nếu `submitState==='submitting'` thì giữ nguyên state (hoặc chặn chỉnh sửa). Nên disable textarea/nút ảnh khi đang submitting. Thêm test vào `composer-draft-reducer.test.ts`.

### M2. Backend không validate shape của entity; client âm thầm làm mất text
- File: `server/src/routes/post-routes.ts:17-26`, `src/shared/post-rendering/render-post-body-with-entities.tsx:43-67`
- Đã kiểm chứng bằng curl:
  - `{"type":"bogus","start":6,"end":12}` được chấp nhận và lưu nguyên. Khi render, `renderEntity` không có nhánh default nên trả `undefined`, và đoạn "secret" **biến mất** khỏi bài.
  - `entities:[null]` trả **500** kèm message nội bộ `"Cannot read properties of null (reading 'start')"`.
  - `hashtag.tag`/`link.url` không được kiểm là string (regex `test` ép kiểu mảng thành string). Thuộc tính lạ của client được lưu nguyên.
- Fix: whitelist `type ∈ {mention, hashtag, link}`, kiểm `typeof` từng field, rồi tạo lại object entity sạch (không lưu object của client). Client thêm nhánh `default: return <span key>{text}</span>`. Comment ở dòng 12 ("Validate ở server – không tin client") hiện đang hứa nhiều hơn những gì code làm.

### M3. Lesson 08 "Tải nhanh 150 bài" chạy đua với sentinel loader; reducer nhận trang `older` không theo thứ tự
- File: `src/lessons/08-virtualization/lesson-08-virtualization.tsx:65-75`, `src/lessons/03-normalized-store/feed-store-reducer.ts:82-92`
- Kịch bản: `LoadManyButton` bỏ qua guard `inFlightRef` của `useFeedLoader`, nên sentinel cũng tải `older` từ cùng một cursor. Trang nào về sau sẽ ghi đè `olderCursor`/`hasOlder`, và cursor có thể **lùi lại**, dẫn tới tải lại các trang đã có (dedupe che mất). Ngoài ra không có try/catch: với failRate>0 thì nút kẹt "Đang tải…" vĩnh viễn và có unhandled rejection.
- Fix: đưa `loadMany` vào `useFeedLoader` (dùng chung guard), hoặc reducer bỏ qua trang `older` mà `requestCursor !== state.feed.olderCursor` (thêm `requestCursor` vào action). Thêm `try/finally`.

### M4. Lesson 02/03: không xử lý lỗi; lesson 02 có stale closure sinh trùng cả ở cột cursor
- File: `src/lessons/02-cursor-pagination/lesson-02-cursor-pagination.tsx:84-103`, `src/lessons/03-normalized-store/lesson-03-normalized-store.tsx:84-92`
- Kịch bản 1: failRate 100% (config là global, giữ nguyên từ lesson khác). Lesson 02 kẹt "Đang tải…", lesson 03 phát unhandled rejection. Lesson 03 lại tắt mock panel (`showMockControls={false}`), nên người học không biết vì sao lỗi.
- Kịch bản 2: nút "Tải thêm ở cả hai cột" không bị disable. Bấm 2 lần trước khi response về thì cả hai lần đều dùng cùng `nextOffset`/`olderCursor` cũ, nên **cột cursor cũng hiện bài trùng**. Điều này phản bác đúng điều lesson muốn chứng minh.
- Fix: disable nút chung khi một trong hai cột đang `loading`. Thêm `catch` để reset `loading` và hiện lỗi. Lesson 03 nên bật mock panel hoặc hiện lỗi.

## Low

- **L1** `use-measured-item-heights.ts:19-39,42-58` + `virtualized-feed-list.tsx:74`: `measureRef(id)` tạo callback mới mỗi lần render. Mọi item visible bị detach/attach ref ở mỗi render (cả mỗi frame cuộn), mỗi lần quét O(n) `elementsRef`. Observer được tạo trong lúc render nhưng bị `disconnect()` trong cleanup giả lập của StrictMode, và chỉ hoạt động lại nhờ chính sự churn này. Nên tạo observer trong effect và cache callback theo id.
- **L2** `src/shared/post-rendering/feed-post-article.tsx:33-37`: `memo` vô tác dụng vì `useFeedState()` đọc cả context, nên mọi article re-render ở mọi dispatch (kể cả mỗi reaction). Nên chọn `pendingReactions[postId]`/`usersById` qua selector, hoặc tách context. Chí ít nên ghi chú để người học không tưởng memo có tác dụng.
- **L3** `server/src/routes/media-routes.ts:39`: `decodeURIComponent` header `X-Image-Alt` sai format thì trả 500 `"URI malformed"` (đã kiểm chứng). Nên bọc try/catch và trả 400. Liên quan: `server/src/middleware/error-handler-middleware.ts:14` trả nguyên `error.message` của lỗi 500 cho client. Nên trả message chung cho >=500.
- **L4** `media-routes.ts:60`: bytes upload được serve với `Content-Type` lấy từ header client, không có `X-Content-Type-Options: nosniff` hay CSP/sandbox. Đã kiểm chứng: HTML gửi kèm `image/png` vẫn được nhận. Rủi ro thấp (Chrome không sniff image/* thành HTML), nhưng nên thêm `nosniff` + `Content-Security-Policy: default-src 'none'; sandbox` cho đúng phần dạy.
- **L5** `server/src/routes/post-routes.ts:44-48`: idempotency key không gắn với fingerprint của request. Cùng key nhưng body khác vẫn replay bài cũ (đã kiểm chứng). Stripe và các hệ thống tương tự trả 409/422 trong trường hợp này. Nên lưu hash body và so sánh, hoặc ít nhất ghi chú trong comment. Nên ghi chú thêm: bản thật cần lock khi request cùng key đang chạy (ở đây không race chỉ vì handler đồng bộ).
- **L6** `server/src/middleware/fake-session-middleware.ts:26-30`: `sid` chính là userId dạng plaintext và không được validate. `cookie: sid=ghost` tạo được bài với `authorId:"ghost"` (đã kiểm chứng). Đây là chủ ý vì là session giả, nhưng comment đang dạy "không tin userId từ client". Nên ghi rõ: sid thật là token ngẫu nhiên map tới user ở server, và reject sid không tồn tại. Thêm: `post-routes.ts:54-56` cho phép gắn upload của người khác vào bài (thiếu kiểm tra ownership).
- **L7** `server/src/data/in-memory-database.ts:21-23`: comment nói generation trong cursor giúp server phát hiện client giữ feed cũ, nhưng `decodeCursor` không dùng generation ở đâu cả. Nên sửa comment ("để dành cho…") hoặc minh hoạ cách dùng.
- **L8** Phần dạy chưa chính xác:
  - `lesson-07-perf-a11y-images.tsx:61`: "12.345 → 12K". Thực tế `en-US` ra `12.3K` và `vi-VN` ra `12,3 N` (do `maximumFractionDigits:1`).
  - `feed-post-article.tsx:7,44` và lesson 07: tự nhận theo WAI-ARIA feed pattern, nhưng chưa có Page Up/Page Down để chuyển giữa các article (APG yêu cầu). `tabIndex=-1` chưa có code nào dùng tới. Nên cài đặt, hoặc ghi rõ là chưa làm.
  - `lesson-01-basic-feed.tsx:33`, `learning-guide.md` câu Q1.3: "tránh setState trên component đã unmount". React 18 đã bỏ cảnh báo này. Lý do chính của AbortController là huỷ request thừa và bỏ response cũ (StrictMode/đổi deps).
- **L9** Composer a11y: `composer.tsx:54` gửi `alt: file.name`. Action `altChanged` có trong reducer (`composer-draft-reducer.ts:40,61`) nhưng không có ô nhập alt nào, nên ảnh upload có alt kiểu "IMG_1234.jpg". Lesson 07 lại dạy "alt bắt buộc".
- **L10** `composer.tsx:137`: `remainingSlots` lấy từ state tại thời điểm chọn file, trong khi `uploadStarted` chỉ dispatch sau khi `prepareImageForUpload` (async) xong. Mở picker 2 lần nhanh thì có thể vượt 4 ảnh.
- **L11** `prepare-image-for-upload.ts:28-30`: với GIF lớn hơn 1600px, hàm trả width/height đã thu nhỏ nhưng blob vẫn là bản gốc. Tỉ lệ vẫn đúng, nhưng metadata sai. WebP bị đổi sang JPEG nên mất nền trong suốt (thành nền đen).
- **L12** `src/lessons/04-infinite-scroll/new-posts-banner.tsx:27-45`: không abort khi unmount. Nếu latency > 10s thì các lần poll chồng lên nhau. Ngoài ra `postPrepended` (lesson 06) không dời `newerCursor`; nếu sau này ghép banner với composer thì bài của chính mình sẽ hiện thành "1 bài mới" (lỗi tiềm ẩn).
- **L13** `src/shared/api/http-client.ts:65-73`: `sleep` thêm abort listener mà không gỡ (thiếu `{ once: true }` và không remove khi resolve). Nếu signal đã abort sẵn thì vẫn chờ hết delay.
- **L14** `lesson-08-virtualization.tsx:112`: `aria-live="polite"` đặt trên panel thống kê DOM. Số liệu đổi ở mỗi lần cuộn nên screen reader bị spam. Nên bỏ aria-live.
- **L15** `reaction-picker.tsx:58`: `aria-label` đặt trên `<span>` không có role, nên AT không đọc được. Nên dùng `role="img"` hoặc text ẩn.
- **L16** Không có ESLint. Tiêu chí (e) "lint" không kiểm chứng được. `react-hooks/exhaustive-deps` đáng lẽ đã cảnh báo `lesson-03...tsx:94-97` và `observeKey` trong `use-intersection-sentinel.ts:48`.

## Edge cases từ scout (đã kiểm, không có lỗi)
- `feed-query-service.ts` nhánh `direction=newer`: lấy `count` bài gần anchor nhất, `newerCursor` = bài mới nhất của trang, `hasNewer` đúng. Khi có hơn `count` bài mới thì client lật tiếp mà không hở khoảng. Khi trang rỗng thì fallback về cursor cũ. Đúng.
- Bài chèn trong cùng 1ms có id `…-10` < `…-9` theo thứ tự chuỗi. Thứ tự hiển thị trong cùng ms bị đảo, nhưng vẫn tất định nên cursor không trùng/sót. Chỉ là chi tiết thẩm mỹ.
- `useFeedLoader` dưới StrictMode: `inFlightRef` chặn được request initial thứ hai. Đúng.
- `render-post-body-with-entities.tsx`: không dùng `dangerouslySetInnerHTML`, `toSafeHref` qua `new URL` + allowlist protocol, mention/hashtag dùng `encodeURIComponent`. An toàn XSS.
- `media-svg-renderer.ts`: `alt` được escape, `placeholderColor` do server kiểm soát, SVG được trả kèm CSP `default-src 'none'`. An toàn.
- Upload: allowlist MIME không có SVG, giới hạn 5MB, kiểm tra body rỗng. Ổn cho demo (đã ghi chú magic bytes).
- Reaction reducer: rollback về snapshot đã xác nhận, bỏ qua lỗi của request cũ. Logic client đúng; vấn đề nằm ở H2 (thứ tự ghi phía server).

## Positive Observations (để hiệu chỉnh mức rủi ro)
- Server dùng hợp đồng chung, cursor opaque + thứ tự ổn định, có test lật trang khi có bài mới chèn vào. Idempotency gắn với viewer.
- http-client chỉ retry khi an toàn (GET hoặc có key), tôn trọng `Retry-After`, dùng full jitter.

## Recommended Actions
1. Sửa C1 (unobserve đúng cách + bỏ qua target đã tách khỏi DOM) và H1 (gap). Thêm test cuộn e2e cho lesson 08.
2. Sửa H2 bằng cách serialize theo post (hoặc seq phía server). Sửa comment lesson 05 và learning guide Q5.2.
3. M1: khoá chỉnh sửa composer khi đang submit.
4. M2: validate entity chặt + nhánh default ở client.
5. M3/M4: thêm guard và xử lý lỗi cho các nút tải thủ công.
6. Các mục L theo thứ tự: L3, L5, L8, L9, rồi L16 (thêm ESLint + react-hooks).

## Plan follow-up
- `plan.md` vẫn ghi mọi phase là "Pending" và mọi Success Criteria chưa tick, trong khi code đã xong. Lead nên cập nhật trạng thái.
- Success criterion "Lesson 08: DevTools chỉ thấy khoảng 10 `article`…" vẫn **đạt** về mặt con số, nhưng virtualization **không đúng chức năng** (C1). Không nên đánh dấu phase 6 hoàn tất cho tới khi sửa xong.
- Criterion lesson 05 (rollback + toast) đạt. Còn hành vi "5 click nhanh cho trạng thái nhất quán" thì chỉ đúng ở phía UI, sai so với server (H2).

## Metrics
- Type coverage: TS strict + `noUncheckedIndexedAccess`. Typecheck pass (theo xác nhận trước đó, không chạy lại).
- Test: 66 test pass. Chưa có test nào bao phủ C1, H1, H2, M1.
- Lint: không có linter.

## Unresolved Questions
- Phạm vi của "session giả" (L6): có muốn dạy luôn sid opaque không, hay giữ đơn giản và chỉ sửa comment?
- H2: chọn serialize phía client (đơn giản, hợp với bài GreatFrontEnd) hay seq phía server (cần đổi hợp đồng API)?
