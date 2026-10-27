/**
 * GIỮ VỊ TRÍ SCROLL KHI QUAY LẠI FEED (O – Feed list) – phần logic thuần.
 *
 * Vì sao không lưu `scrollY` thô?
 *   Feed thay đổi giữa lúc rời đi và lúc quay lại (bài mới chèn lên đầu, ảnh tải xong làm đổi chiều cao,
 *   virtualization chỉ biết chiều cao ước lượng). 3200px của lần trước có thể trỏ sang BÀI KHÁC.
 *   Cách bền hơn: nhớ "bài nào đang ở đỉnh màn hình và nó cách mép trên bao nhiêu px" (anchor), rồi khi quay
 *   lại tìm đúng bài đó và đặt nó về cùng chỗ.
 *
 * Toạ độ trong file này là toạ độ TRANG (document): top = rect.top + scrollY.
 */

export interface ItemRect {
  postId: string;
  top: number;
  bottom: number;
}

/** Điểm neo: bài đầu tiên còn nhìn thấy và khoảng cách từ đỉnh bài tới mép trên viewport (âm = bài bị cắt phía trên). */
export interface ScrollAnchorPoint {
  postId: string;
  offsetPx: number;
}

/**
 * Anchor lưu lại kèm thời điểm chụp và hạn dùng. KHÔNG gắn với `generation` của feed: generation tăng ở mỗi lần có bài mới
 * chèn lên đầu, mà neo theo id sinh ra chính là để sống sót qua việc đó. Anchor chỉ hết hạn theo thời gian (người dùng đã
 * bỏ đi quá lâu thì vị trí cũ không còn đáng khôi phục). Việc bài neo còn tồn tại hay không được xử lý ở luồng khôi phục:
 * tải tới khi thấy bài neo, hết trang mà không thấy thì bỏ anchor.
 */
// 📖 Bài học lesson-09 §1 – anchor có hạn dùng, không gắn với generation (docs/lessons/lesson-09.md)
// #region learn:anchor-stored-with-expiry
export interface StoredScrollAnchor extends ScrollAnchorPoint {
  savedAt: number;
  expiresAt: number;
}

export const SCROLL_ANCHOR_TTL_MS = 30 * 60 * 1000;

export function withExpiry(point: ScrollAnchorPoint, now: number, ttlMs: number = SCROLL_ANCHOR_TTL_MS): StoredScrollAnchor {
  return { ...point, savedAt: now, expiresAt: now + ttlMs };
}
// #endregion learn:anchor-stored-with-expiry

/**
 * Chọn bài đầu tiên (theo thứ tự trong feed) có đáy nằm DƯỚI mép trên viewport.
 * Không dùng "bài có đỉnh ≥ scrollY" vì bài đang bị cắt một phần ở trên vẫn là thứ người dùng đang đọc.
 */
// 📖 Bài học lesson-09 §1 – chụp bài ở đỉnh màn hình và tính scrollY khôi phục (docs/lessons/lesson-09.md)
// #region learn:anchor-capture-and-restore-math
export function captureScrollAnchor(itemRects: readonly ItemRect[], scrollY: number): ScrollAnchorPoint | null {
  const first = itemRects.find((rect) => rect.bottom > scrollY);
  return first ? { postId: first.postId, offsetPx: first.top - scrollY } : null;
}

/** scrollY cần đặt để bài neo về lại đúng chỗ; null nếu chưa biết vị trí bài đó (chưa render/đã bị xoá). */
export function computeRestoreScrollTop(anchor: ScrollAnchorPoint, itemTopById: Readonly<Record<string, number | undefined>>): number | null {
  const top = itemTopById[anchor.postId];
  return top === undefined ? null : Math.max(0, top - anchor.offsetPx);
}
// #endregion learn:anchor-capture-and-restore-math

export const SCROLL_ANCHOR_STORAGE_KEY = 'lesson-09:scroll-anchor';

export function serializeScrollAnchor(anchor: StoredScrollAnchor): string {
  return JSON.stringify(anchor);
}

/** sessionStorage là đầu vào không tin được (người dùng/bản code cũ có thể ghi gì đó) → kiểm tra hình dạng. */
// 📖 Bài học lesson-09 §1 – sessionStorage là đầu vào không tin được (docs/lessons/lesson-09.md)
// #region learn:anchor-parse-stored
export function parseStoredScrollAnchor(raw: string | null): StoredScrollAnchor | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<StoredScrollAnchor> | null;
    if (
      value &&
      typeof value.postId === 'string' &&
      Number.isFinite(value.offsetPx) &&
      Number.isFinite(value.savedAt) &&
      Number.isFinite(value.expiresAt)
    ) {
      return value as StoredScrollAnchor;
    }
  } catch {
    // JSON hỏng → coi như không có anchor
  }
  return null;
}
// #endregion learn:anchor-parse-stored

/** Anchor còn dùng được khi chưa quá hạn (bất kể feed đã có thêm bao nhiêu bài mới). */
export function isAnchorFresh(anchor: StoredScrollAnchor, now: number): boolean {
  return now < anchor.expiresAt;
}
