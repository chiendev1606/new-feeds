# Báo cáo: bài học lesson 09–12 (nhóm C, phase 3)

## File đã sửa/tạo
- Tạo: `docs/lessons/lesson-09.md`, `lesson-10.md`, `lesson-11.md`, `lesson-12.md`.
- Chỉ thêm marker `#region learn:` + comment `📖` (không đổi logic) trong:
  - 09: `scroll-anchor.ts`, `use-scroll-restoration.ts`, `use-stale-feed-prompt.ts`, `lesson-09-route.ts`, `lesson-09-advanced-feed-list.tsx`, `post-detail-view.tsx`.
  - 10: `post-renderer-registry.ts`, `lesson-10-lazy-loading.tsx`, `lazy-post-card.tsx`, `author-name-with-hover-card.tsx`, `composer-entity-parser.ts`, `composer-text-utils.ts`, `entity-aware-composer.tsx`, `use-loaded-js-chunks.ts`, `js-tiers-and-chunks-panel.tsx`.
  - 11: `impression-tracker.ts`, `use-impression-tracking.ts`, `web-vitals-observer.ts`, `web-vitals-rating.ts`, `changed-final-vitals.ts`, `lesson-11-metrics-telemetry.tsx`.
  - 12: `use-offline-outbox.ts`, `resilience-feed.tsx`, `handle-not-found.ts`, `register-background-sync.ts`, `service-worker-controls.tsx`, `session-and-server-controls.tsx`, `use-cache-source-probe.ts`.
- Ngoại lệ nhỏ: `use-offline-outbox.ts` (catch trong effect khởi tạo): sửa **comment** sai ("Hạ cờ…" trong khi code không hạ `started.current`). Không đổi logic.

## Số liệu
| Lesson | Khái niệm | Region trong thư mục lesson | Câu hỏi phỏng vấn | Mermaid |
|---|---|---|---|---|
| 09 | 5 | 12 | 6 | 3 (flowchart anchor, sequence stale, sequence BroadcastChannel) |
| 10 | 5 | 16 | 5 | 2 (flowchart tier, sequence waterfall vs song song) |
| 11 | 5 | 15 | 5 | 2 (state impression, sequence lô → beacon) |
| 12 | 6 | 14 | 6 | 3 (refresh 401, outbox, SW network-first) |

- Mọi region tôi tạo đều được doc dùng (đã kiểm bằng script). Mọi marker phase 2 gắn nhãn `Bài học lesson-09..12` ở file dùng chung cũng đã được dùng (sync/*, lazy/*, offline/*, sw.js, feed-api send-telemetry, server telemetry/session, contract-*, feed-state, feed-generation-read, use-feed-loader reload).
- Có dùng thêm region của file dùng chung gắn nhãn khác: `http-*` (retry-loop, single-flight, session-epoch, refresh-with-retry, dedupe-get, idempotency-key), `middleware-pipeline`, `validate-post-body-nfc`.
- Mermaid đã kiểm bằng `mermaid.parse` (v12.2.0, có stub DOMPurify vì chạy Node): 10/10 khối hợp lệ.

## Marker dùng chung còn thiếu
Không có marker nào bắt buộc. Gợi ý tuỳ chọn cho lead (file nhóm B/shared):
- `src/lessons/05-optimistic-reaction/reaction-picker.tsx`: `onPointerEnter={preloadReactionMenu}` trên `.reaction-bar` (lesson 10 §3 hiện chỉ mô tả bằng lời, không có khối code).

## Phát hiện cần lead biết
- Comment ở `use-offline-outbox.ts` từng nói "Hạ cờ" nhưng code không hạ `started.current` (đã sửa comment). Hành vi thật: lỗi khởi tạo → phải mount lại feed.
- `public/sw.js` đầu file vẫn nhắc `CACHE_VERSION` trong comment, nhưng không có hằng nào tên đó (version nằm trong `CACHE_PREFIX`). Không sửa vì là file dùng chung. Doc đã viết theo code thật.

## Kết quả kiểm chứng
- `npx vitest run src/shared/learn`: pass (35 tests).
- `npx vitest run src/lessons/09… 10… 11… 12… src/shared`: pass (22 file, 173 tests).
- `npx tsc --noEmit`: pass.
- Không chạy lệnh build, không reset DB, không gọi `/__mock/reset`. Các lệnh curl trong "Tự thử" hoặc bị server từ chối (không ghi), hoặc ghi 1 dòng telemetry (đã ghi chú trong doc).

Status: DONE
Summary: Viết xong lesson-09..12 (21 khái niệm, 10 sơ đồ Mermaid hợp lệ, 22 câu hỏi phỏng vấn) và gắn 57 region trong code các lesson; mọi region và marker phase 2 đều được dùng, test và tsc pass.
Concerns/Blockers: Không có blocker. Xem mục "Phát hiện cần lead biết" (comment `CACHE_VERSION` trong sw.js).
