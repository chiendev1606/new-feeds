import { describe, expect, it } from 'vitest';
import { captureScrollAnchor, computeRestoreScrollTop, isAnchorFresh, parseStoredScrollAnchor, serializeScrollAnchor, SCROLL_ANCHOR_TTL_MS, withExpiry } from './scroll-anchor';

const rects = [
  { postId: 'a', top: 0, bottom: 300 },
  { postId: 'b', top: 312, bottom: 700 },
  { postId: 'c', top: 712, bottom: 1000 },
];

describe('captureScrollAnchor', () => {
  it('chọn bài đầu tiên có đáy nằm dưới mép trên viewport (bài bị cắt một phần vẫn được chọn)', () => {
    expect(captureScrollAnchor(rects, 400)).toEqual({ postId: 'b', offsetPx: -88 });
  });

  it('bài nằm đúng mép trên → offset 0; bài ở dưới mép → offset dương', () => {
    expect(captureScrollAnchor(rects, 312)).toEqual({ postId: 'b', offsetPx: 0 });
    expect(captureScrollAnchor(rects, 0)).toEqual({ postId: 'a', offsetPx: 0 });
  });

  it('đáy bài đúng bằng scrollY thì bài đó đã ra khỏi màn hình → chọn bài kế', () => {
    expect(captureScrollAnchor(rects, 300)?.postId).toBe('b');
  });

  it('không có bài nào (list rỗng hoặc cuộn quá cuối) → null', () => {
    expect(captureScrollAnchor([], 0)).toBeNull();
    expect(captureScrollAnchor(rects, 5000)).toBeNull();
  });
});

describe('computeRestoreScrollTop', () => {
  it('capture rồi restore ở layout khác: bài neo về đúng chỗ cũ trong viewport', () => {
    const anchor = captureScrollAnchor(rects, 400)!;
    // Quay lại: có thêm 2 bài mới phía trên, mọi thứ lùi xuống 624px.
    const shifted = { b: 312 + 624 };
    const scrollTop = computeRestoreScrollTop(anchor, shifted)!;
    expect(shifted.b - scrollTop).toBe(anchor.offsetPx);
    expect(scrollTop).toBe(400 + 624);
  });

  it('chưa biết vị trí bài neo → null', () => {
    expect(computeRestoreScrollTop({ postId: 'zzz', offsetPx: 0 }, { a: 0 })).toBeNull();
  });

  it('không trả giá trị âm', () => {
    expect(computeRestoreScrollTop({ postId: 'a', offsetPx: 50 }, { a: 10 })).toBe(0);
  });
});

describe('lưu / đọc anchor (sessionStorage)', () => {
  const stored = { postId: 'b', offsetPx: -88, savedAt: 1000, expiresAt: 5000 };

  it('khứ hồi serialize → parse', () => {
    expect(parseStoredScrollAnchor(serializeScrollAnchor(stored))).toEqual(stored);
  });

  it('từ chối dữ liệu hỏng hoặc sai hình dạng', () => {
    expect(parseStoredScrollAnchor(null)).toBeNull();
    expect(parseStoredScrollAnchor('{oops')).toBeNull();
    expect(parseStoredScrollAnchor('null')).toBeNull();
    expect(parseStoredScrollAnchor(JSON.stringify({ postId: 1 }))).toBeNull();
  });

  it('anchor kiểu cũ (có generation, không có expiresAt) bị từ chối', () => {
    expect(parseStoredScrollAnchor(JSON.stringify({ postId: 'b', offsetPx: 0, generation: 3, savedAt: 1000 }))).toBeNull();
  });

  it('hạn dùng chỉ phụ thuộc thời gian, không phụ thuộc generation/bài mới', () => {
    const fresh = withExpiry({ postId: 'b', offsetPx: -88 }, 10_000);
    expect(fresh).toEqual({ postId: 'b', offsetPx: -88, savedAt: 10_000, expiresAt: 10_000 + SCROLL_ANCHOR_TTL_MS });
    expect(isAnchorFresh(fresh, 10_000 + SCROLL_ANCHOR_TTL_MS - 1)).toBe(true);
    expect(isAnchorFresh(fresh, 10_000 + SCROLL_ANCHOR_TTL_MS)).toBe(false);
  });
});
