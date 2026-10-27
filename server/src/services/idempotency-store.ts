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

export function hashRequestBody(body: unknown): string {
  return createHash('sha256').update(JSON.stringify(body)).digest('hex');
}

/** Mã lỗi PostgreSQL khi vi phạm UNIQUE/PRIMARY KEY. */
const UNIQUE_VIOLATION = '23505';

/** Drizzle bọc lỗi của driver trong DrizzleQueryError → mã lỗi Postgres nằm ở error.cause. */
export function isUniqueViolation(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const { code, cause } = error as { code?: string; cause?: unknown };
  return code === UNIQUE_VIOLATION || isUniqueViolation(cause);
}
