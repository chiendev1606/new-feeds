# Review nội dung bài học, phase 4 (261027-2230-in-app-lesson-walkthroughs)

Ngày: 2026-10-27. Phạm vi: `docs/lessons/lesson-01.md` … `lesson-12.md` và `shared-foundations.md`.

Cách làm:
- Dựng bản "mở rộng" của từng bài, chèn code region thật vào ngay dưới mỗi khối `learn`, rồi đọc lời giải thích cạnh code (dùng chính `extractRegion` của project).
- Đối chiếu hằng số, text nút và selector với TSX, endpoint với `server/src/routes/*`.
- Chạy curl GET tới :3001.
- Chạy `EXPLAIN` chỉ đọc qua psql, đọc `users.handle` bằng SELECT.
- Không gọi `/__mock/reset`, không POST, không đổi `/__mock/config`.

Kiểm chứng: `npx vitest run src/shared/learn` cho kết quả **35/35 pass**, gồm cả kiểm tra region mồ côi ở chế độ nghiêm ngặt (`STRICT_ORPHANS = true`). Heading bắt buộc và khối `learn` giữ nguyên.

## 1. Lỗi đã sửa

| # | File:dòng (sau khi sửa) | Sai gì | Sửa thành |
|---|---|---|---|
| 1 | lesson-01.md:23 | "Trong bài viết" mô tả kiến trúc bài gốc là "server, controller phía client, store, UI" và nói "SSR chỉ đáng giá cho trang công khai cần SEO". Bài gốc hiện tại ghi 4 layer **View, Store, Data access, Server**, và nói với feed đã đăng nhập thì lợi ích của SSR là *performance, not SEO*. | Diễn giải lại đúng 4 layer, nói rõ lợi ích chính của SSR với feed đăng nhập là tốc độ hiển thị lần đầu, CSR là mặc định. |
| 2 | lesson-01.md:42 | Ghi `FetchFeedPageParams` "chỉ có `count`, `cursor`, `direction`, `signal`", trong khi code có thêm `onRetry`. | Thêm `onRetry`. |
| 3 | lesson-01.md:189 | Kết quả mong đợi `10 10 N` "với N ≤ 10". Curl thật trả `10 10 14`, vì `users` gồm cả người được mention và người react mẫu (`sampleReactorIds`). | N là số user khác nhau được tham chiếu, có thể > 10, nhưng mỗi user chỉ có một bản ghi. |
| 4 | lesson-02.md:274 | Gợi ý `echo … \| base64 -d` để giải cursor base64url. Lệnh này hỏng khi chuỗi có `-`/`_` hoặc thiếu `=`. | Dùng lệnh `node … 'base64url'` làm chính và giải thích vì sao `base64 -d` không đáng tin. |
| 5 | lesson-03.md:75 | "Số user ít hơn số bài" ở trang đầu: sai với dữ liệu thật (14 user / 10 bài). | Mỗi user chỉ một bản ghi. Trang đầu có thể nhiều user hơn số bài; tải thêm vài trang thì số user tăng chậm hơn. |
| 6 | lesson-03.md:147 | Dùng "dedupe" cho việc reducer khử trùng id, lẫn với "dedupe" là gộp GET ở lesson 09. | Ghi là `mergeUniqueIds` khử trùng, kèm chú thích phân biệt hai thuật ngữ. |
| 7 | lesson-04.md:166 | Thử "trang ngắn" bằng cách "thu nhỏ cửa sổ rất nhỏ": làm vậy không khiến trang ngắn hơn màn hình. | Giảm mức zoom trình duyệt (Cmd/Ctrl + `-`) rồi tải lại. |
| 8 | lesson-04.md:341 | "Chờ tối đa khoảng 10 giây" để thấy banner. Thực tế server sinh bài mỗi 5 giây và polling mỗi 10 giây, nên có thể tới khoảng 15 giây. | "Khoảng 10–15 giây", kèm lý do. |
| 9 | lesson-05.md:108 | Câu "sau khoảng 2 giây, Event log có `⚡ optimistic` rồi `✅`" dễ hiểu là dòng optimistic cũng xuất hiện sau 2 giây. | `⚡ optimistic` hiện ngay, `✅ server xác nhận` hiện sau khoảng 2 giây và chữ "đang lưu…" biến mất. |
| 10 | lesson-05.md:120 | "Bài chưa đi sâu vào việc server ghi theo thứ tự nào": sai, vì bài gốc có gợi ý *serialize them per post or attach a client sequence/version*. | Diễn giải đúng hai gợi ý của bài, và nói rõ project từng chỉ làm vế `requestSeq`. |
| 11 | lesson-06.md:504, 527 | Lấy "☕" làm ví dụ emoji gây lệch giữa đếm code point và UTF-16. U+2615 nằm trong BMP nên chỉ chiếm 1 đơn vị UTF-16. "Emoji chiếm 2 đơn vị" cũng là khái quát sai. | Dùng "😀", emoji ngoài BMP (1 code point, 2 đơn vị UTF-16). Chữ có dấu thì lệch khi đếm theo byte UTF-8. |
| 12 | lesson-06.md:507 | Lời dẫn ghi "start 0 end 6" nhưng lệnh curl ghi `end: 5`. Giá trị đúng là 5, vì "@Minh" dài 5 ký tự. | `start 0 end 5`. |
| 13 | lesson-06.md:408 | Viết lệch thuật ngữ thành "Key idempotency". | "Idempotency key", kèm `temp-<idempotencyKey>`. |
| 14 | lesson-07.md:91 | Gợi ý "dùng **Tải nhanh** ở lesson 08" để đổi `aria-setsize` của lesson 07. Không làm được, vì mỗi lesson có `FeedStoreProvider` riêng. | Giải thích store tách theo lesson và chỉ cách thử ngay trên `#/lesson-08`, nơi có cùng `FeedPostArticle` và cùng cách tính `setSize`. |
| 15 | lesson-07.md:171 | Ghi Network sẽ có `?w=320/640/960` và chuyển sang 390px thì "URL nhỏ hơn". Code chọn theo bề rộng × DPR: retina thường ra 1280, còn chế độ thiết bị 390px mặc định DPR 3 cũng ra 1280. | Giải thích quy tắc "nhỏ nhất đủ cho bề rộng × DPR", hướng dẫn đặt DPR 1 để thấy `?w=640`, và lưu ý cache. |
| 16 | lesson-09.md:335–340 | Snippet Console lấy `document.querySelector('article')`, tức bài đầu tiên, rồi gửi `engagementSummary: {}`. Nếu tab chưa biết `confirmedAt` của bài đó thì tin được **áp**, và `ReactionPicker` đọc `summary.reactionCounts[...]` từ object rỗng nên card lỗi render. Kết quả mong đợi "Bỏ qua bản cũ hơn" chỉ đúng khi may. | Bắt dùng đúng id bài vừa Thích ở bước 2 và cảnh báo hậu quả nếu chọn sai bài. |
| 17 | lesson-09.md:432 | "panel mô phỏng mạng (nếu có)": panel này luôn có (`LessonLayout` luôn render `MockControlPanel`). | Ghi đúng tên panel và giá trị độ trễ gợi ý. |
| 18 | lesson-10.md:308, 310 | Dùng handle mẫu `@an1`. Seed hiện tại không có handle này (user-1 là `ngoc1`), nên bước "thành mention" không làm theo được. `@an1` chỉ là fallback trong nhãn TSX. | Dùng `@<handle>` lấy từ nhãn gợi ý hoặc hàng "Chèn nhanh @handle". |
| 19 | lesson-12.md:114 | "refresh gọi với `maxAttempts: 1` ở `refreshSession`": sai đường code. Luồng tự động dùng `refreshWithRetry` (gọi `fetch` trực tiếp, `REFRESH_MAX_ATTEMPTS = 3`). `refreshSession` trong `feed-api.ts` không nằm trên đường này. | Mô tả đúng hai cơ chế chặn lặp, và nói rõ `refreshSession` không liên quan. |
| 20 | lesson-12.md:448 | Gọi tên nút là "Gỡ đăng ký SW", nhưng nút thật ghi "Gỡ đăng ký". | Đúng text nút, và nhắc phải tải lại trang vì controller cũ còn điều khiển tab. |
| 21 | lesson-12.md:451 | Ở bản dev, Cache Storage được hứa có `newsfeed-v2-assets`. Dev không có request `/assets/*` nên cache này không được tạo. | Ghi rõ `newsfeed-v2-assets` chỉ có ở bản preview đã build. |
| 22 | shared-foundations.md:290, 361 | Gọi công thức `n/2 + random × n/2` là "full jitter". Theo thuật ngữ AWS, đó là **equal jitter**; full jitter là `random × n`. | Gọi là jitter nửa trên (equal jitter), kèm ghi chú rằng comment trong code đang gọi khác. |
| 23 | shared-foundations.md:406 | Ghi `request-deduped` được phát "để lesson 12 ghi log", nhưng nơi nghe sự kiện duy nhất là `post-detail-view.tsx` của lesson 09. | Ghi đúng lesson 09. |
| 24 | shared-foundations.md:408 | Liệt kê ba giới hạn của comment dedupe nhưng bỏ giới hạn thứ ba thật ("có signal thì không gộp"). | Liệt kê đúng ba giới hạn trong comment. |

## 2. Đã kiểm, khớp code (không sửa)

- Hằng số và ngưỡng:
  - Lesson 04: `rootMargin '100% 0px'`, 320px, sàn 3 và trần 20 bài; ví dụ 900px → 4 là đúng.
  - Lesson 04: polling 10s; `MAX_PAGE_SIZE` 50.
  - Lesson 06: `MAX_UPLOAD_DIMENSION` 1600, upload 5MB, `MAX_MEDIA_PER_POST` 10, `MAX_IMAGES_PER_POST` 4, alt 300 ký tự, text 5000 ký tự.
  - Lesson 08: 360 + 12 và overscan 600. Phép tính ví dụ startIndex 11, endIndex 18, topSpacer 4092, bottomSpacer 49104 đã tính lại và đúng.
  - Lesson 09: debounce 120ms, `MAX_LOAD_ATTEMPTS` 8, `STABLE_FRAMES_REQUIRED` 3, 90 frame, TTL 30 phút.
  - Lesson 10: mở hover card 300ms, đóng 150ms.
  - Lesson 11: `BATCH_SIZE` 20, 5s, 200 sự kiện/lô, cắt hàng đợi ở 1000, `postId` tối đa 100, dwell tối đa 24h, giá trị vital tối đa 1e7, các budget.
  - Lesson 12: flush 8s, `REFRESH_MAX_ATTEMPTS` 3, 30 entry, viewerId tối đa 100 ký tự, key `newsfeed:last-viewer`.
- Endpoint trong mục Tự thử đều có trong routes:
  - Feed và bài: `/api/feed`, `/api/feed-offset`, `/api/posts/:id`, `/api/posts`, `/api/posts/:id/reaction`.
  - Media và telemetry: `/api/media/uploads`, `/media/:id`, `/api/telemetry`, `/api/telemetry/summary`.
  - Session và mock: `/api/session/me|refresh`, `/__mock/insert-new-posts`.
- Đã curl xác nhận:
  - `cursor=abc` trả 400 `INVALID_CURSOR`.
  - `/api/posts/khong-ton-tai` trả 404 `POST_NOT_FOUND`.
  - Feed có `Cache-Control: private, no-store`.
  - Cookie trả về là `sid=user-1; SameSite=Lax`.
- EXPLAIN thật khớp mô tả: cursor dùng `Index Only Scan` hoặc `Index Scan`; `OFFSET 250` dùng `Sort` + `Seq Scan` với `rows=261`; `NULLS LAST` chuyển sang Sort; hướng ASC dùng `Index Scan Backward`. Bảng lịch sử có đủ 2 migration `0000_init` và `0001_follows_and_telemetry`.
- Text nút và label đã đối chiếu TSX ở cả 12 lesson, gồm:
  - Panel và thanh trượt: "Mô phỏng mạng (backend)", "Độ trễ", "Tỉ lệ lỗi".
  - Nút: "Tải thêm ở cả hai cột", "Đổi tên …", "Tải nhanh thêm 150 bài", "Gửi lại bài vừa đăng với CÙNG key".
  - Panel lesson 09: "Cũ sau (giây)", "Mở tab mới".
  - Lesson 10: "Prefetch Tier 3 khi trình duyệt rảnh".
  - Lesson 11: "Làm chậm main thread 300ms", "Gửi ngay".
  - Lesson 12: "Hết hạn session", "Gọi 3 API song song", "Điền 5001 ký tự (→ 400)", "Flush outbox ngay", "Bỏ mục này".
  - Các chuỗi log/toast có emoji. Tất cả khớp.
- Ký tự ẩn trong Tự thử lesson 10 có thật: chuỗi NFD (U+0323, U+0302), U+200B và U+202E. Offset hashtag 7–9 trên chuỗi NFD là đúng.

## 3. Nghi vấn chưa sửa (ngoài quyền hoặc cần quyết định)

1. **Comment code gọi sai tên jitter.** `src/shared/api/http-client.ts` (comment đầu file và comment của `computeBackoffDelayMs`) cùng `docs/lessons/README.md:128` ghi "full jitter". Công thức thật là equal jitter. Tôi chỉ sửa phần lời trong bài học; còn code và README không thuộc quyền sửa. Đề xuất đổi comment, hoặc đổi công thức sang full jitter thật.
2. **`refreshSession` trong `src/shared/api/feed-api.ts:114`** không được dùng ở `src/` ngoài test. Có thể là export thừa; cần xác nhận rồi xoá hoặc ghi chú.
3. **Mô phỏng tự sinh bài đang bật lúc review.** Server có `autoNewPostsEverySec = 5`, số bài tăng từ 313 lên 390 trong lúc review. Tôi không đổi config theo ràng buộc. Trạng thái này làm Tự thử lesson 02 bước 3 ("Offset báo 3 bài bị trùng") có thể ra số khác, và làm số liệu lesson 01/03/04 dao động. Đề xuất tắt trước khi chạy smoke test CDP.
4. **Kiểm tra chép nguyên văn (mục 3) chỉ ở mức một phần.** Bài gốc khoảng 113k ký tự, chỉ đọc được qua công cụ tóm tắt. Các trích nguyên văn tôi lấy được (phần Architecture, sequencing, CSR) không thấy đoạn nào bị dịch sát từng câu. Mọi mục "Trong bài viết" đều ngắn (2–4 câu), là diễn giải và có link. Chưa đối chiếu được từng câu với toàn văn. Tên mục mà bài học trích dẫn (*Pagination approaches*, *Stale feed*, *Optimizations*…) chưa xác minh là đúng tên heading hiện tại của bài.
5. **Thuật ngữ "khoá" ở shared-foundations §8.** Từ này dùng cho cả idempotency key lẫn "khoá chính". Hiểu được nhờ ngữ cảnh, nhưng lesson 06 và 12 dùng "key". Đề xuất thống nhất thành "key" khi chỉ idempotency key; chưa sửa vì phải viết lại cả mục.
6. **Các con số "lỗi thật từ review"** không kiểm chứng lại được từ repo vì không có git. Ví dụ: 5 vòng × 15 POST, `conn=false bb=0`, 57k → 5.8k px, `post-0300 … MISMATCH`. Lời kể nhất quán với code hiện tại.
7. **Lesson 07 §1 Tự thử bước 4** liệt kê các điểm Tab tới theo thứ tự tên → Thích → ▾ → Xem thêm. Thứ tự DOM thật là tên → Xem thêm → Thích → ▾. Bài không khẳng định thứ tự nên tôi để nguyên.

## 4. Đánh giá ngắn từng bài

- **01:** Chắc chắn, chỉ hai lỗi nhỏ về số liệu và mô tả bài gốc. Phần 4 layer, AbortController và retry rõ ràng.
- **02:** Rất tốt. SQL, index và EXPLAIN đã chạy thật, khớp. Chỉ sửa mẹo base64.
- **03:** Tốt. Reducer giải thích từng nhánh chính xác. Lỗi về số user đến từ việc bỏ qua người được mention và người react mẫu.
- **04:** Tốt, đặc biệt phần sentinel kẹt và `observeKey`. Hai Tự thử cần chỉnh để làm theo được.
- **05:** Rất tốt về race hai lớp. Phần "Trong bài viết" từng nói sai về bài gốc, đã sửa.
- **06:** Đầy đủ, nhiều chiều (upload, idempotency, entity). Sửa hai lỗi sự thật về Unicode và offset.
- **07:** Tốt về a11y và Intl (output `12,3 N` / `12.3K` đã chạy thật). Hai Tự thử dễ gây hiểu nhầm, đã sửa.
- **08:** Chính xác nhất, ví dụ số học đúng từng con số. Không phải sửa.
- **09:** Chất lượng cao nhưng dày. Một Tự thử có thể làm hỏng card, đã sửa.
- **10:** Tốt. Handle mẫu không có thật làm hỏng Tự thử chính của §4, đã sửa.
- **11:** Chính xác, mọi hằng số đều khớp. Không phải sửa.
- **12:** Tốt và dài. Một giải thích sai đường code của refresh, hai chi tiết Cache Storage/nút, đã sửa.
- **shared-foundations:** Vững, EXPLAIN khớp. Sửa thuật ngữ jitter và hai chi tiết về dedupe.

Khung bài (bảng so sánh, câu hỏi phỏng vấn kèm đáp án) có mặt và có nội dung thật ở mọi khái niệm. Không thấy câu trả lời rỗng hay chung chung.

Status: DONE_WITH_CONCERNS
Summary: Đã đối chiếu 13 bài với code region, TSX, routes, curl GET và EXPLAIN. Đã sửa trực tiếp 24 lỗi sự thật hoặc Tự thử không làm theo được. `npx vitest run src/shared/learn` pass 35/35 ở chế độ orphan nghiêm ngặt.
Concerns/Blockers:
- Comment code và README vẫn gọi "full jitter" (không thuộc quyền sửa).
- `refreshSession` có thể là export thừa.
- Server đang bật tự sinh bài mỗi 5 giây, làm lệch kết quả Tự thử.
- Kiểm tra chép nguyên văn chỉ làm được một phần vì không đọc được toàn văn bài gốc.
