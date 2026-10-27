---
title: "Chuyển truy cập dữ liệu sang Drizzle ORM"
description: "Schema TypeScript + migration drizzle-kit + repository viết bằng Drizzle. API giữ nguyên."
status: completed
priority: P2
effort: 2h
tags: [backend, database, refactor]
blockedBy: []
blocks: []
created: 2026-10-27
---

# Chuyển truy cập dữ liệu sang Drizzle ORM

## Quyết định (người dùng chọn)
Dùng Drizzle ORM thay Prisma. Lý do: query gần với SQL, hỗ trợ so sánh row value cho cursor qua `sql```, và không cần bước generate client.

## Phases
| # | Phase | Status |
|---|---|---|
| 1 | [Schema + migration + repository](./phase-01-drizzle-schema-migration-and-repository.md) | Completed |

## Tiêu chí hoàn thành
- API, frontend và 24 test server giữ nguyên.
- Typecheck, test và build đều pass.
- Smoke test trên Chrome đạt, có đối chiếu với DB.
- Đã backup DB trước khi migrate.

## Ghi chú hoàn thành (2026-10-27)
- Code review (`reports/code-review-drizzle-orm.md`) xác nhận API và schema không đổi. Reviewer đã thử SQL injection vào cursor và gửi song song nhiều request cùng idempotency key; cả hai đều an toàn.
- Đã sửa:
  - H1: DB cũ (tạo bằng `schema.sql`) giờ được phát hiện và báo hướng dẫn rõ ràng. Thêm script `db:recreate` và mục "Nâng cấp" trong README.
  - M1: README ghi chú chỉ restore phần dữ liệu từ backup cũ.
  - L1: cursor có `createdAt` không phải ngày giờ trả 400 thay vì 500 (có test).
  - L2: `db:reset` không còn seed 2 lần.
  - L5: sửa comment về `executor`.
  - L6: `drizzle.config.ts` được đưa vào typecheck.
- Chưa làm:
  - L3: chia lô INSERT seed. Chỉ cần khi số dòng seed tăng mạnh (hiện dùng khoảng 9.5k / 65k tham số).
  - L4: advisory lock cho `migrate()`. Chỉ cần khi chạy nhiều process cùng lúc.
