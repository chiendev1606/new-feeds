/**
 * Idempotency: client sinh 1 key khi bấm "Đăng" và gửi kèm mọi lần retry.
 * Server lưu (viewerId, key) → response trong bảng idempotency_keys; lần gọi lặp lại trả về đúng
 * response cũ thay vì tạo bài thứ hai. Nhờ vậy client retry an toàn khi mạng chập chờn.
 *
 * Kèm theo hash nội dung request: cùng key nhưng KHÁC nội dung nghĩa là client dùng sai key
 * (bug) → trả 422 thay vì lặng lẽ trả bài cũ (giống Stripe).
 *
 * Hệ thống thật đặt TTL cho bảng này (vd xoá key cũ hơn 24h).
 */
import { createHash } from 'node:crypto';

// 📖 Bài học shared-foundations §8 – băm nội dung request để phát hiện dùng sai key (docs/lessons/shared-foundations.md)
// #region learn:request-hash
export function hashRequestBody(body: unknown): string {
  return createHash('sha256').update(JSON.stringify(body)).digest('hex');
}
// #endregion learn:request-hash

// 📖 Bài học shared-foundations §8 – Drizzle bọc lỗi Postgres trong cause nên phải đọc đệ quy (docs/lessons/shared-foundations.md)
// #region learn:unique-violation-in-cause
/** Mã lỗi PostgreSQL khi vi phạm UNIQUE/PRIMARY KEY. */
const UNIQUE_VIOLATION = '23505';

/** Drizzle bọc lỗi của driver trong DrizzleQueryError → mã lỗi Postgres nằm ở error.cause. */
export function isUniqueViolation(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const { code, cause } = error as { code?: string; cause?: unknown };
  return code === UNIQUE_VIOLATION || isUniqueViolation(cause);
}
// #endregion learn:unique-violation-in-cause
