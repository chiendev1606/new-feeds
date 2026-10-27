/**
 * Cursor "mờ" (opaque cursor).
 *
 * - Bên trong là vị trí của một post trong thứ tự ổn định (createdAt, id) + feed generation.
 *   (generation hiện chỉ mang theo để quan sát; server có thể dùng nó để phát hiện client giữ feed quá cũ
 *   và yêu cầu tải lại từ đầu – bài viết gọi là "cursor tied to feed generation".)
 * - Mã hoá base64url để client KHÔNG phụ thuộc vào cấu trúc bên trong; server đổi format lúc nào cũng được.
 * - So với offset: cursor trỏ vào "sau bài X", nên khi có bài mới chèn lên đầu,
 *   trang tiếp theo không bị lặp/sót bài (xem lesson 02).
 */
import { HttpError } from './http-error.js';

export interface FeedCursorPayload {
  createdAt: string;
  id: string;
  generation: number;
}

// 📖 Bài học lesson-02 – cursor mờ: JSON gói trong base64url (docs/lessons/lesson-02.md)
// #region learn:cursor-encode
export function encodeCursor(payload: FeedCursorPayload): string {
  return Buffer.from(JSON.stringify([payload.createdAt, payload.id, payload.generation]), 'utf8').toString('base64url');
}
// #endregion learn:cursor-encode

// 📖 Bài học lesson-02 – giải mã và kiểm tra cursor, sai thì trả 400 thay vì 500 (docs/lessons/lesson-02.md)
// #region learn:cursor-decode-validate
export function decodeCursor(cursor: string): FeedCursorPayload {
  try {
    const parsed: unknown = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
    if (
      Array.isArray(parsed) &&
      parsed.length === 3 &&
      typeof parsed[0] === 'string' &&
      !Number.isNaN(Date.parse(parsed[0])) &&
      typeof parsed[1] === 'string' &&
      typeof parsed[2] === 'number'
    ) {
      return { createdAt: parsed[0], id: parsed[1], generation: parsed[2] };
    }
  } catch {
    // rơi xuống throw bên dưới
  }
  throw new HttpError(400, 'INVALID_CURSOR', 'Cursor không hợp lệ');
}
// #endregion learn:cursor-decode-validate
