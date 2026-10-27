# Code review – Lesson 09–12 + backend đi kèm

Ngày: 2026-10-27 · Reviewer: code-reviewer · Phạm vi: `git status` so với `dcad051` (31 file sửa, ~60 file mới)

## Scope
- Backend: contracts, schema + migration 0001, feed-repository (sampleReactorIds, relationshipToViewer, telemetry, deletePost), session/telemetry/mock routes, fake-session middleware, feed-query-service, NFC check ở post-routes.
- Shared client: http-client (dedupe, single-flight refresh), feed-api, sync/, lazy/, offline/, post-rendering, public/sw.js.
- Lesson 09–12 + file sửa ở 05/08, picker, registry.
- Không chạy lại typecheck/test/build/CDP (đã kiểm chứng theo brief). Thăm dò thêm 2 request KHÔNG ghi DB: POST bài NFD (→ 400) và telemetry durationMs âm (→ 400). Có 1 truy vấn chỉ đọc vào DB (follows=15, telemetry_events=5).

## Overall
Code gọn, đúng pattern, comment dạy học kỹ, test thuần nhiều. Các flow chính đã chạy được. Rủi ro thật nằm ở **tương tác giữa các phần**: SW chiến lược SWR rò sang mọi lesson, server từ chối NFD làm vỡ hợp đồng của lesson 06, `generation` dùng sai ý nghĩa cho anchor, và một số race trong outbox/reload mà CDP happy path không chạm tới.

---

## Critical
Không có.

## High

### H1. SW stale-while-revalidate cho `/api/feed` trả dữ liệu cũ cả khi ONLINE, cho MỌI lesson, client không biết
- `public/sw.js:67-90, 115-116`; scope `/` (`service-worker-controls.tsx:87`).
- Kịch bản:
  1. Lesson 12 bấm "Đăng ký SW", react 1 bài, F5 → trang đầu lấy từ cache → reaction "mất" (viewerReaction cũ), tới lần tải sau mới đúng.
  2. Sang lesson 09 (SW vẫn còn): banner "Feed đã cũ" → "Tải lại" (`lesson-09-advanced-feed-list.tsx:103`) nhận lại đúng bản cache cũ, nhưng `lastFetchedAt = Date.now()` → banner tắt, tức là UI "nói dối" rằng feed đã mới. http-client bỏ qua header nên không thể biết.
  3. Lesson 04 poll `direction=newer&cursor=X` (cùng URL qua nhiều lần poll): lần poll sau nhận kết quả cache của lần trước → bài mới đến trễ thêm một chu kỳ.
- Thêm nữa: server gửi `Cache-Control: private, no-store` (`feed-routes.ts:25,30`), SW vẫn cache (Cache API bỏ qua header này). Cache cũng không tách theo viewer, trong khi lesson 12 dạy tách outbox theo viewer. Hai bài dạy đang mâu thuẫn nhau.
- Chiến lược SWR là quyết định trong plan nên **không tự đổi**. Các phương án:
  - (a) Online thì network-first, chỉ fallback sang cache khi fetch lỗi. Header `X-From-SW-Cache` vẫn dùng được. Dạy đúng hơn cho dữ liệu cá nhân hoá.
  - (b) Giữ SWR nhưng chỉ khi request tự xin, vd header `X-SW-Strategy: swr` chỉ lesson 12 gửi. Như vậy lesson 01–11 không bị ảnh hưởng.
  - (c) Tối thiểu: cache key thêm viewerId (lấy từ `/api/session/me` lúc install, hoặc tab postMessage sang). Lesson 12 unmount thì nhắc gỡ đăng ký / tự gỡ. Trong guide ghi rõ: Cache API không tôn trọng `no-store`.

### H2. Server từ chối text không phải NFC làm vỡ hợp đồng lesson 06 (plan: "chỉ thêm, không phá")
- `server/src/routes/post-routes.ts:53`. Lesson 06 gửi `payload.text` mà không normalize (`lesson-06-composer-upload.tsx:51`).
- Đã thăm dò: POST `"Việt Nam"` → `400 TEXT_NOT_NFC`. Trước thay đổi request này được chấp nhận. Text NFD hay gặp khi dán từ tên file macOS, PDF, một số IME.
- Cách sửa (chọn một):
  - Server chỉ reject khi `entities.length > 0` (lúc đó offset mới có nghĩa), còn không thì tự `normalize('NFC')`.
  - Hoặc lesson 06 normalize trước khi gửi.
  - Cả hai cách đều nên thêm test integration cho NFD không entity.

## Medium

### M1. Anchor scroll bị vứt mỗi khi có BẤT KỲ bài mới nào, trái với lý do chính mà lesson đưa ra
- `use-scroll-restoration.ts:218-222` + `scroll-anchor.ts:72-75`. `feed_state.generation` tăng ở mỗi lần chèn bài (`feed-repository.ts:239-247`: composer, simulator, `insert-new-posts`).
- Kịch bản: cuộn tới bài 20, có người đăng bài hoặc bật `autoNewPostsEverySec`, rồi F5 → trang đầu có generation mới → `persist(null)` → về đầu feed. Đường "loadMore tới khi gặp bài neo" cũng đứt giữa chừng nếu có bài mới chen vào.
- Comment `scroll-anchor.ts:4-8` lập luận: neo theo id là để sống sót qua việc "bài mới chèn lên đầu". Check generation thì làm ngược lại.
- Sửa: bỏ check generation, chỉ dựa vào "bài neo còn tồn tại" + TTL `savedAt`. Nếu muốn giữ ý tưởng "feed reset" thì server cần một epoch riêng, chỉ đổi khi `/__mock/reset`.

### M2. Outbox: bấm "Bỏ mục này" khi đang flush thì mục sống lại, hoặc bài vẫn được đăng
- `post-outbox.ts:79-99` + `use-offline-outbox.ts:217-224`.
- Kịch bản A: server chậm/lỗi, flush đang `await send(...)` mục X, người dùng bấm "Bỏ" → `store.delete(X)`. Sau đó send lỗi tạm → `store.put(X, attempted)` → X quay lại outbox và lần flush sau gửi đi.
- Kịch bản B: send thành công → bài được đăng, rồi `postPrepended` chèn lại bài thật vào feed ngay sau khi người dùng vừa bỏ.
- Sửa: trước khi `put`, kiểm tra mục còn tồn tại (`store.get`). Hoặc đánh dấu mục đang gửi (`state: 'sending'`) và disable "Bỏ" cho mục đó. Hoặc gói get+put trong một transaction IDB.

### M3. Lesson 12 "Tải lại feed" làm bài tạm của outbox biến khỏi feed
- `resilience-feed.tsx:23` (`feedReady = lastFetchedAt !== null`) + remount qua `key={feedKey}` (`lesson-12-resilience-offline.tsx:88`).
- Store nằm ở provider phía trên nên `lastFetchedAt` vẫn còn. Vì vậy `feedReady` true ngay lúc mount → dựng bài tạm (getSession + IDB, nhanh) TRƯỚC khi `useFeedLoader` tải xong trang `initial`, và trang này thay cả list → bài tạm mất (mục outbox vẫn còn). Đây đúng là điều comment `use-offline-outbox.ts:11-12` cảnh báo. Bước 6 của OBSERVE (offline → "Tải lại feed") sẽ gặp lỗi này.
- Sửa: `feedReady` dựa trên `status` của loader ở lần mount hiện tại (vd chờ status đổi từ `loading-initial` sang `idle`/`error`). Hoặc reducer 'initial' giữ lại các id `temp-*`.
- Kèm theo: remount tạo instance outbox mới, nên flush cũ (nếu còn đang chạy) và flush mới chạy chồng nhau. Idempotency cứu được, nhưng tốn request (xem L4).

### M4. Refresh session: lỗi tạm thời bị coi là "phải đăng nhập lại"; single-flight chỉ đúng trong cửa sổ trùng nhau
- `http-client.ts:104-117`. `/api/session/refresh` nằm sau `createSimulatedLatencyAndFailureMiddleware` (`create-express-app.ts:46,53`). Với failRate > 0, refresh nhận 503 → ném `REAUTH_REQUIRED` mà không retry. Điều này trái với chính sách retry ở đầu file (5xx là lỗi tạm thời).
- 401 tới muộn: request gửi trước refresh nhưng nhận 401 SAU khi `refreshInFlight` đã reset → gọi refresh lần 2. Ở đây vô hại, nhưng với refresh-token rotation thật thì lần 2 dùng token đã bị thu hồi → logout oan. Comment hiện tại ("3 request cùng nhận 401 thì chỉ gọi refresh một lần") không nói giới hạn này.
- Sửa:
  - Retry refresh 1–2 lần khi gặp 5xx/mạng, chỉ trả `REAUTH_REQUIRED` khi server nói 401/403.
  - Giữ `sessionEpoch`: request ghi lại epoch lúc gửi; khi nhận 401 mà epoch đã tăng thì retry luôn, không refresh lại. Ghi điều này vào comment dạy.

### M5. Lesson 09 `reloadFeed` đi vòng qua loader nên race với trang older → feed bị hổng giữa
- `lesson-09-advanced-feed-list.tsx:100-112`. Nút bị disable khi `isLoading`, nhưng điều ngược lại không được chặn. Khi reload đang bay (latency cao), người dùng cuộn → sentinel gọi `loadPages('older')` với `olderCursor` CŨ (ở sâu). Thứ tự xảy ra: `initial` về và thay list, rồi trang older-cũ về và nối thêm → list = 10 bài đầu + bài 41–50, mất 11–40. `olderCursor` cũng trỏ sai.
- Sửa: thêm `reload()` vào `useFeedLoader`, dùng chung `inFlightRef`. Hoặc tạm khoá sentinel khi `reloading`.

### M6. Reaction menu mở ngay khi hover cả thanh reaction nên lời dạy "preload khi hover ▾" không đúng
- `reaction-picker.tsx:63` `onMouseEnter={() => setOpen(true)}` trên `.reaction-bar`. Chuột chạm vào thanh (vùng summary hoặc nút Thích) là menu mở và chunk bắt đầu tải do render, xảy ra TRƯỚC `pointerenter` của ▾. Vì vậy lần hover đầu luôn thấy placeholder; preload ▾ gần như không có tác dụng với chuột.
- Comment `reaction-picker.tsx:25-28` và OBSERVE lesson 10 ("menu mở ra không bị khựng") đang dạy sai cơ chế. CDP "chỉ tải khi hover thật" vẫn pass, nhưng lý do pass khác với điều được dạy.
- Sửa (chọn một): preload ở `onMouseEnter` của thanh và mở menu sau một khoảng trễ (giống hover card 300ms). Hoặc sửa lời dạy cho khớp hành vi thật.

### M7. Telemetry: web vital "chốt" bị gửi lại mỗi lần ẩn tab; lô bị 4xx kẹt hàng đợi mãi
- `use-impression-tracking.ts:91-105`. `hiddenHandled` reset khi tab hiện lại, nên mỗi lần đổi tab lại enqueue LCP/CLS/INP (giá trị không đổi). Đổi tab 5 lần → 5 dòng LCP cho cùng một page view, p75 phía server (`feed-repository.ts getTelemetrySummary`) bị lệch. Comment nói "chỉ gửi giá trị chốt".
  - Sửa: nhớ giá trị đã gửi theo từng tên metric, chỉ gửi khi đổi (web-vitals làm như vậy với `delta`).
- `impression-tracker.ts:117-122` + `feed-api.ts sendTelemetry`: mọi `!ok` (kể cả 400/401/413) đều đưa lô về ĐẦU hàng đợi → một lô bị từ chối chặn mọi lô sau, retry mỗi 5s mãi mãi.
  - Sửa: 4xx (trừ 408/429) thì bỏ lô và log; chỉ retry khi 5xx hoặc lỗi mạng (dùng lại `isRetryableStatus`).

### M8. Feed query: từ 1 vòng song song thành 3 vòng tuần tự
- `feed-query-service.ts:37-51` + `feed-repository.ts:161-196`. Trước đây stats, users, media chạy song song. Giờ là: stats (GROUP BY), rồi samples (window), rồi users+follows / media. Mỗi trang feed thêm ~2 RTT DB, và mỗi PUT reaction cũng thêm query samples.
- Sửa: trong `getReactionStats` chạy 2 query bằng `Promise.all` khi không có transaction. Load users của author/mention song song với stats, sau đó chỉ query bổ sung các reactor còn thiếu.

## Low

- **L1. Validate telemetry** (`telemetry-routes.ts:16-30`):
  - `durationMs` không có `Number.isFinite` và không có cận trên. `1e309` trong JSON parse thành `Infinity` (đã kiểm), lọt qua `>= 0` rồi vào `double precision` → tổng dwell thành Infinity, ra JSON thành `null`.
  - `postId`/`name` không giới hạn độ dài, `at` nhận mọi năm.
  - Không có rate limit. Beacon `text/plain` cross-site không mang cookie (SameSite=Lax) nên bị gán cho `user-1`.
  - `/telemetry/summary` công khai.
  - Sửa: `Number.isFinite` + cap (vd 24h), `postId.length <= 100`. Ghi chú trong guide rằng production cần rate limit/auth.
- **L2. Danh sách người react**:
  - SQL ưu tiên người viewer *theo dõi* (`feed-repository.ts:188`), còn contract/comment nói "bạn bè" (theo dõi lẫn nhau).
  - `others = total - names.length` (`format-reactor-list.ts:22`) tính cả chính viewer: viewer đã react thì hiện "An, Bình và 1 người khác", trong khi "1 người khác" là "Bạn".
  - Fallback hiện raw id (`feed-post-article.tsx:88`) khi user chưa có trong store (response PUT reaction không kèm users).
  - Tiếng Anh ra "1 others".
- **L3. Cross-tab**: tin nhắn bị bỏ qua lúc bài đang pending (`use-cross-tab-reaction-sync.ts:30`) không được áp lại. Kịch bản: B ghi trước (t1), A ghi sau (t2), tin của A tới B lúc B còn pending → bỏ; sau đó response t1 của B được áp → B lệch so với server cho tới khi reload. Hai lần ghi trùng ms thì bản sau bị coi là cũ (`>` strict).
  - Sửa: buffer tin bị skip, sau `reactionConfirmed` thì áp lại nếu confirmedAt của nó vẫn mới hơn.
- **L4.** `post-outbox.ts:14-16,104-112`: comment nói chống flush chồng của "tab khác…", nhưng guard chỉ nằm trong một instance (một tab, một lần mount). Hai tab, hoặc remount (M3), sẽ gửi cùng mục song song. Server replay cứu được nhưng tốn request. Sửa: `navigator.locks.request('outbox-flush:'+viewerId, …)` hoặc sửa comment.
- **L5.** `sw.js:92-103`: navigation nào trả 200 cũng bị ghi đè lên app shell `/`. Mở `localhost:5173/__mock/config` (JSON, có proxy) → offline sẽ hiện JSON thay vì app. Nên chỉ cache khi `content-type` là `text/html`. Cache API của feed key theo cả cursor nên phình không giới hạn; cần giới hạn số entry.
- **L6. Dedupe GET** (`http-client.ts:125-136`): key chỉ có URL. Caller thứ hai mất `onRetry`/`maxAttempts` của mình. Read-after-write: GET bắt đầu trước khi PUT xong vẫn trả dữ liệu cũ cho caller gọi sau PUT. Nên ghi rõ giới hạn này trong comment, hoặc thêm `dedupe:false` cho đường đọc sau khi ghi.
- **L7. AuthorName trong FeedPostArticle dùng chung** (lesson 07/08/09/11): mỗi bài thêm một tab stop, và focus là bật tooltip ngay. Đây là thay đổi hành vi bàn phím của lesson cũ. Chấp nhận được nhưng nên ghi vào guide.
- **L8.** `use-impression-tracking.ts:116-119`: unmount không disconnect IntersectionObserver và không huỷ timer (comment giải thích là vì StrictMode). Leak nhỏ mỗi lần vào/ra lesson 11. `refCache` không bao giờ được dọn.
- **L9. Vệ sinh code**:
  - `eslint-disable-next-line` (`lazy-with-preload.ts:16`, `lesson-10-lazy-loading.tsx:69`) trong khi repo không có ESLint.
  - `tag.toLocaleLowerCase()` (`composer-entity-parser.ts:63`) phụ thuộc locale (chữ i Thổ Nhĩ Kỳ), nên dùng `toLowerCase()`.
  - `started.current = false // cho phép thử lại ở lần render sau` (`use-offline-outbox.ts:132`) không đúng: effect không chạy lại vì deps không đổi.
  - `aria-controls={menuId}` trỏ tới id chưa tồn tại khi đang hiện placeholder.

## Edge cases từ scout
- `generation` tăng mỗi lần insert → ảnh hưởng anchor (M1).
- Store provider nằm trên phần remount → `lastFetchedAt` còn sót (M3).
- Refresh endpoint chịu failure middleware (M4).
- `onMouseEnter` của `.reaction-bar` có từ trước, tương tác với lazy menu (M6).
- `private, no-store` bị SW bỏ qua (H1).
- Lesson 06 không normalize (H2).

## Đã kiểm, không phải lỗi
- `sampleReactorIds` dùng `sql\`\``, tham số hoá đúng (`${postIds}` mở thành danh sách tham số, `${viewerId}` là tham số). Không có SQLi.
- Không có `dangerouslySetInnerHTML` mới. Paste lấy text/plain và lọc bidi/zero-width.
- Echo loop BroadcastChannel: tab phát không nhận lại tin của mình, tab nhận không publish lại.
- Kênh tách theo viewerId. Không có session thì tắt sync.
- Dedupe + StrictMode: lần chạy effect thứ hai join vào promise đầu. Có signal thì không gộp, nên abort không lan sang caller khác.
- Request chính là refresh: `url !== SESSION_REFRESH_URL` cộng với middleware bỏ qua `REFRESH_PATH` → không lặp.
- Concurrent POST cùng key: server bắt unique violation rồi replay, đúng.
- `deletePost`: reactions có `ON DELETE CASCADE`. TRUNCATE trong reset có đủ `follows`/`telemetry_events`.
- `planRenderedRows`: tổng chiều cao spacer giữ nguyên khi ghim item ở trên hoặc dưới range.
- Lesson 01–08 dùng GET: lesson 01/04 có signal nên không bị dedupe. Lesson 02/03 không có signal nhưng có guard loading nên không đổi hành vi.

## Recommended actions (theo thứ tự)
1. H2: nới check NFC (chỉ khi có entities) hoặc normalize ở lesson 06. Thêm test integration.
2. H1: chọn phương án a/b/c cho SW (cần user quyết vì SWR nằm trong plan).
3. M1: bỏ check generation cho anchor (hoặc dùng epoch reset riêng).
4. M2 + M3 + L4: outbox kiểm tra tồn tại trước khi put lại; `feedReady` theo loader của lần mount hiện tại; cân nhắc Web Locks.
5. M4: retry refresh khi lỗi tạm thời + epoch; cập nhật comment.
6. M5: `reload()` trong `useFeedLoader`.
7. M6, M7: sửa trigger mở menu hoặc lời dạy; gửi vital theo delta; bỏ lô telemetry khi 4xx.
8. M8 và các mục Low.

## Metrics
- Typecheck: sạch (theo brief). Test: 178 pass (theo brief). Repo không có ESLint (0 công cụ lint).
- Test còn thiếu: dedupe khi lỗi, 401 tới muộn sau refresh, discard khi đang flush, POST NFD không entity, reducer 'initial' gặp bài tạm.

## Plan follow-up
- Phase 1–5: code đã có đủ các hạng mục chính trong bảng "Kết quả cần có". Phase 2–5 trong `plan.md` vẫn ghi `Pending`, lead nên cập nhật.
- Tiêu chí "Lesson 01–08 không bị ảnh hưởng": CDP pass, nhưng H2 (lesson 06 với text NFD) và H1 (khi SW đang đăng ký) là hai ngoại lệ CDP không bắt được.

## Unresolved questions
1. SWR cho feed khi online là chủ ý của user (plan), hay chỉ cần "đọc được khi offline"? Câu trả lời quyết định chọn phương án H1 nào.
2. `generation` có được định nghĩa là "feed được tính lại" (ranking) theo bài gốc không? Nếu có thì server đang tăng nó sai chỗ (mỗi lần insert), cần sửa cả phía server.
3. Có chấp nhận thay đổi hành vi bàn phím (thêm tab stop ở tên tác giả) cho lesson 07/08 không?
