---
type: brainstorm
date: 2026-10-27
source: https://www.greatfrontend.com/questions/system-design/news-feed-facebook?format=system-design
status: accepted
---

# Đối chiếu độ bao phủ: bài News Feed và project

## Tóm tắt
Đã đọc lại toàn bộ bài (113k ký tự, gồm References và Exercises) và so với code hiện có.

- **Có code chạy được:** khoảng 70% các mục, gồm toàn bộ phần lõi R/A/D/I và phần lớn các tối ưu O.
- **Còn thiếu:** 9 mục có thể minh hoạ bằng code mà chưa có, và 8 mục chỉ cần giải thích (lý thuyết hoặc ngoài khả năng của một demo local).

Ký hiệu: ✅ có code · 🟡 có một phần hoặc chỉ nhắc trong guide · ❌ chưa có.

## Bảng đối chiếu

| Mục trong bài | Trạng thái | Ghi chú |
|---|---|---|
| Requirements (core features, post types, infinite scroll, mobile) | ✅ | Lesson 01, guide |
| Rendering approach CSR/SSR/hybrid | 🟡 | Mới giải thích; chưa nói SSR phải overfetch vì không biết chiều cao viewport, và chưa nói tới ngân sách LCP |
| Navigation SPA vs MPA | 🟡 | Có SPA, nhưng **chưa chứng minh** state và scroll sống sót khi chuyển trang |
| 4 layer View/Store/Data access/Server | ✅ | Lesson 01 |
| Post entity, entity ranges UTF-16 | 🟡 | Thiếu **chuẩn hoá NFC** cho text; thiếu `viewerHasShared` |
| User entity, relationship flags | 🟡 | Thiếu `RelationshipToViewer` (friend/following/muted/blocked) |
| Feed entity (cursors, generation, lastFetchedAt) | ✅ | Lesson 03 |
| Normalized store (feedsById, composerDraft) | 🟡 | Chỉ có một feed, chưa có `feedsById`; composerDraft nằm riêng trong composer |
| API, identity từ session | ✅ | Backend |
| Offset vs cursor | ✅ | Lesson 02 |
| Dynamic loading count | ✅ | Lesson 04 |
| Cache `private`, xoá cache khi logout | 🟡 | Có `private`; chưa có namespace theo tài khoản |
| **Gộp request đọc trùng nhau (dedup) + AbortController** | 🟡 | AbortController chỉ có ở lesson 01; chưa gộp request trùng |
| Gửi reaction tuần tự hoặc dùng sequence number | ✅ | Lesson 05 |
| Idempotency key | ✅ | Lesson 06 |
| Upload ảnh trước, chèn bài optimistic | ✅ | Lesson 06 |
| Virtualization | 🟡 | Có; **chưa giữ focus** khi bài đang focus bị unmount |
| Infinite scroll bằng IntersectionObserver | ✅ | Lesson 04 |
| Skeleton | ✅ | Lesson 04 |
| **Giữ vị trí scroll khi quay lại (anchor post ID + offset)** | ❌ | |
| **Stale feed: nhắc refresh sau vài giờ, invalidation từ server, đồng bộ tab bằng BroadcastChannel** | 🟡 | Mới có banner "Có bài mới" bằng polling |
| **Data-driven dependencies (Relay @match/@module, prefetch renderer)** | ❌ | |
| Entity ranges vs các cách khác (custom syntax, editor format, HTML) | 🟡 | Mới so sánh trong comment |
| Render an toàn (escape, allowlist, noopener, CSP) | ✅ | CSP mới áp cho SVG |
| Ảnh: CDN, AVIF/WebP, alt, lazy, srcset, giữ chỗ, LQIP/BlurHash | 🟡 | Chưa có `<picture>` AVIF/WebP; placeholder là màu trơn, chưa phải BlurHash |
| Bỏ EXIF ở client, re-encode ở server | 🟡 | Client có; server chỉ kiểm tra type |
| **Lazy-load code tương tác (reaction picker, menu, hover card)** | ❌ | Reaction picker đang được tải ngay từ đầu |
| Optimistic, pending state khi offline | 🟡 | Có optimistic; chưa có trạng thái pending khi offline |
| Hiển thị thời gian: 3 cách (raw / server dịch / Intl) | 🟡 | Mới có cách Intl |
| **Hiển thị icon: 5 cách** | ❌ | Lý thuyết |
| Cắt bài dài "Xem thêm", số gọn | ✅ | Lesson 07 |
| Composer: contenteditable vs editor library | 🟡 | Chỉ có comment |
| **Composer: chặn paste HTML; model nội bộ khác wire format** | ❌ | Composer luôn gửi `entities: []` nên mention/hashtag gõ trong composer không thành entity |
| **Composer: lazy-load emoji/GIF picker** | ❌ | |
| Error states: inline/toast/toàn trang | ✅ | Lesson 04, 05 |
| **Đọc offline (Service Worker, IndexedDB, chính sách cache theo loại tài nguyên)** | ❌ | |
| **Ghi offline bằng outbox, Background Sync** | ❌ | |
| Retry: backoff, jitter, Retry-After | ✅ | |
| **Retry: làm mới token một lần khi gặp 401; xử lý 404 tuỳ endpoint** | ❌ | |
| Comments: phân trang cursor, thêm comment optimistic, trang chi tiết bài | ❌ | Bài coi là ngoài phạm vi chính nhưng vẫn có mục đi sâu |
| Cập nhật trực tiếp: polling / long polling / SSE / WebSocket | 🟡 | Có polling; guide có so sánh |
| **Đo hiệu năng: LCP/INP/CLS, budget, đo thật (RUM), long task** | ❌ | Lý thuyết |
| Chia JS theo 3 tầng, các kiểu prefetch | 🟡 | Mới có `React.lazy` theo route |
| **Web Worker, `scheduler.postTask`** | ❌ | |
| `content-visibility: auto` | ✅ | Lesson 08 |
| A11y: feed, article, posinset, busy, skip link, aria-live | ✅ | Lesson 07 |
| A11y: vùng bấm 44px, phím tắt, giữ focus khi virtualize | 🟡 | |
| i18n: RTL, `dir="auto"`, PluralRules, NumberFormat | ✅ | Lesson 07 |
| **i18n: `Intl.ListFormat`** ("An, Bình và 3 người khác") | ❌ | |
| **Telemetry: đếm lượt hiển thị (≥50% trong 1 giây), gửi theo lô khi `visibilitychange`/`pagehide`** | ❌ | |
| Báo lỗi (Sentry), feature flag | ❌ | Lý thuyết |
| Interview callouts, bài tập 30 phút | 🟡 | Guide có câu hỏi, chưa có kịch bản trả lời 30 phút |

## Các phương án

1. **Chỉ bổ sung guide.** Rẻ nhất, nhưng các mục ❌ vẫn chỉ là lý thuyết, đi ngược mục tiêu "học bằng code".
2. **Kết hợp (đề xuất).** Mục nào demo được thì viết code thành lesson mới hoặc mở rộng lesson cũ. Mục lý thuyết thì đưa vào guide, kèm bảng đối chiếu độ bao phủ như trên.
3. **Viết code cho mọi mục.** Cả Service Worker, outbox, comments, live updates qua SSE. Tốn nhiều nhất, và Service Worker dễ gây khó chịu khi chạy dev server (cache cũ).

## Quyết định (người dùng chọn): phương án 2, viết code cho cả 4 nhóm

### Kết quả cần có
4 lesson mới (09–12) cùng các mở rộng cho lesson cũ. Ngoài ra `docs/learning-guide.md` có thêm bảng đối chiếu độ bao phủ, liệt kê **mọi** mục trong bài với trạng thái "có code" hoặc "chỉ lý thuyết".

| Lesson | Nội dung |
|---|---|
| 09 Feed list nâng cao | Giữ vị trí scroll khi quay lại (anchor post ID + offset, lưu trong store/sessionStorage); stale feed (dựa trên `lastFetchedAt`, nhắc refresh); đồng bộ reaction giữa các tab bằng `BroadcastChannel`; gộp request đọc trùng nhau + `AbortController`; giữ focus khi virtualize |
| 10 Lazy-load code & JS tiers | Reaction picker và menu tải lười khi hover hoặc lúc trình duyệt rảnh, có prefetch; renderer theo loại bài (mô phỏng Relay `@match`/`@module`); composer tự sinh entity ranges cho #hashtag/@mention (model nội bộ khác wire format); chặn paste HTML; emoji picker tải lười |
| 11 Đo lường & telemetry | LCP/INP/CLS/long task đo bằng `PerformanceObserver`; đếm lượt hiển thị (≥50% trong 1 giây, không đếm trùng) gửi theo lô qua `sendBeacon` khi `visibilitychange`/`pagehide` tới `POST /api/telemetry`; `Intl.ListFormat` |
| 12 Resilience & offline | Gặp 401 thì làm mới token một lần (backend cho session hết hạn giả); xử lý 404 tuỳ endpoint; outbox ghi offline (lưu bền, gửi lại khi online với cùng idempotency key); Service Worker cache app shell + ảnh (cache-first) + trang feed (stale-while-revalidate), thao tác ghi luôn qua mạng |

Bổ sung nhỏ vào phần đã có: chuẩn hoá NFC cho body (server), thêm `RelationshipToViewer` cho User, tách dữ liệu lưu cục bộ theo tài khoản.

### Ràng buộc
- Giữ nguyên stack (React 18 + TS + Vite + Express) và cách tổ chức lesson. Không thêm thư viện state/query.
- Service Worker chỉ đăng ký trong lesson 12, có nút gỡ đăng ký, scope rõ ràng, để không làm hỏng các lesson khác khi dev.
- Code review đang chạy trên 8 lesson hiện có; các lỗi review phát hiện phải sửa trước hoặc cùng lúc với phần mở rộng.

### Ngoài phạm vi (chỉ lý thuyết trong guide)
Comments và live update qua SSE/WebSocket, so sánh 5 cách hiển thị icon, Web Worker và `scheduler.postTask`, Sentry/feature flag, SSR thật, AVIF/WebP trên CDN thật, BlurHash.

### Tiêu chí hoàn thành
- `npm run typecheck`, `npm run test` và `npm run build` đều pass; có test cho phần logic mới (dedup, anchor scroll, entity parser, impression tracker, outbox, refresh khi gặp 401).
- Smoke test trên Chrome thật cho lesson 09–12, không có lỗi console:
  - Rời feed rồi quay lại thì về đúng bài đang đọc.
  - Hai tab đồng bộ reaction.
  - Network cho thấy chunk reaction picker chỉ tải khi hover.
  - Terminal backend in các lô impression.
  - Bật offline (DevTools) rồi đăng bài: bài vào outbox, có mạng lại thì gửi đúng một lần.
  - Session hết hạn thì refresh rồi request thành công.
- Bảng đối chiếu trong guide không còn mục nào của bài bị bỏ sót.
