---
phase: 2
title: "Marker + bài học phần dùng chung (backend, data access, hooks)"
status: completed
priority: P1
effort: "2h"
dependencies: [1]
---

# Phase 2: Phần dùng chung

## Goal
Gắn marker vào **mọi file dùng chung** mà các lesson cần trích, để phase 3 chỉ tham chiếu. Viết `docs/lessons/shared-foundations.md` giải thích nền tảng chung.

## Chủ sở hữu file (chỉ phase này được sửa)
`server/**`, `shared-contracts/**`, `src/shared/**` (trừ `src/shared/learn/**`), `public/sw.js`, `src/app-lesson-picker.tsx`.

## Steps
1. Lập danh sách marker theo nhu cầu của từng lesson (bảng "Marker có sẵn" trong `docs/lessons/README.md`). Tối thiểu gồm:
   - **Backend:** cursor older/newer (`feed-repository`), offset, `buildNormalizedEntities`, reaction stats và sample reactors, upsert reaction, transaction idempotency (`post-routes`), validate entity + NFC, session middleware và hết hạn, latency/failure middleware, telemetry route, index trong `database-schema`, cursor codec.
   - **Contract:** `Post`, `TextEntity`, `NormalizedFeedResponse`, `ReactionResponse`.
   - **Client:** `http-client` (retry/backoff, dedupe, refresh 401), `feed-api`, `use-feed-loader`, `use-intersection-sentinel`, `latest-intent-queue`, `post-rendering/*` (entity rendering, safe href, ảnh responsive, Intl), `sync`, `lazy`, `offline`, `sw.js` theo từng chiến lược.
2. Thêm comment `📖` ngắn trỏ tới bài học. Ở những chỗ khó, thêm comment giải thích từng bước cho kỹ, nhưng không đổi logic.
3. Viết `docs/lessons/shared-foundations.md`: kiến trúc tổng thể (sơ đồ View/Store/Data access/Server/DB), vòng đời một request (sơ đồ sequence), `http-client` (retry, dedupe, refresh), hợp đồng API, repository và Drizzle, migration. Mỗi mục theo khung 7 phần.
4. Chạy test kiểm tra doc: doc phần dùng chung pass. Marker chưa có doc lesson nào dùng thì nằm trong allowlist cho tới cuối phase 3.

## Verification
- Typecheck, test và bản production đều pass, không đổi hành vi (chỉ thêm comment).
- Test kiểm tra doc pass với allowlist.
