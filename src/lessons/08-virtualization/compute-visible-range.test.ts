import { describe, expect, it } from 'vitest';
import { computeVisibleRange } from './compute-visible-range';

const base = { estimatedHeight: 100, viewportHeight: 300, overscanPx: 0 };

describe('computeVisibleRange', () => {
  it('đầu list: render các item nằm trong viewport', () => {
    const range = computeVisibleRange({ ...base, heights: Array(100).fill(100), scrollOffset: 0 });
    expect(range).toMatchObject({ startIndex: 0, endIndex: 3, topSpacer: 0, bottomSpacer: 9700, totalHeight: 10_000 });
  });

  it('giữa list: spacer trên = tổng chiều cao các item đã qua', () => {
    const range = computeVisibleRange({ ...base, heights: Array(100).fill(100), scrollOffset: 1050 });
    expect(range.startIndex).toBe(10);
    expect(range.endIndex).toBe(14);
    expect(range.topSpacer).toBe(1000);
    expect(range.topSpacer + 400 + range.bottomSpacer).toBe(range.totalHeight);
  });

  it('overscan render thêm item ngoài viewport', () => {
    const range = computeVisibleRange({ ...base, heights: Array(100).fill(100), scrollOffset: 1000, overscanPx: 200 });
    expect(range.startIndex).toBe(8);
    expect(range.endIndex).toBe(15);
  });

  it('chiều cao khác nhau + chưa đo dùng ước lượng', () => {
    const heights = [50, undefined, 300, 20, undefined];
    const range = computeVisibleRange({ ...base, heights, scrollOffset: 160 });
    // offsets: 0, 50, 150, 450, 470 → item 2 (150–450) đang ở đầu viewport
    expect(range.startIndex).toBe(2);
    expect(range.topSpacer).toBe(150);
    expect(range.totalHeight).toBe(570);
  });

  it('list còn ở dưới màn hình (scrollOffset âm) → vẫn render từ đầu', () => {
    const range = computeVisibleRange({ ...base, heights: Array(10).fill(100), scrollOffset: -200 });
    expect(range.startIndex).toBe(0);
    expect(range.endIndex).toBe(1);
  });

  it('list rỗng', () => {
    expect(computeVisibleRange({ ...base, heights: [], scrollOffset: 0 })).toMatchObject({ startIndex: 0, endIndex: 0, totalHeight: 0 });
  });
});
