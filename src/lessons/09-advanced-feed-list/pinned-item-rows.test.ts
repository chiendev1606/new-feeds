/** Test cho phần "ghim item đang focus" của VirtualizedFeedList (hàm thuần planRenderedRows). */
import { describe, expect, it } from 'vitest';
import { computeVisibleRange } from '../08-virtualization/compute-visible-range';
import { planRenderedRows, type RenderRow } from '../08-virtualization/virtualized-feed-list';

const HEIGHT = 100;
const COUNT = 100;
const range = computeVisibleRange({ heights: Array(COUNT).fill(HEIGHT), estimatedHeight: HEIGHT, scrollOffset: 5000, viewportHeight: 300, overscanPx: 0 }); // item 50..52

const totalHeight = (rows: RenderRow[]) => rows.reduce((sum, row) => sum + (row.kind === 'spacer' ? row.height : HEIGHT), 0);
const itemIndexes = (rows: RenderRow[]) => rows.flatMap((row) => (row.kind === 'item' ? [row.index] : []));

describe('planRenderedRows', () => {
  it('không ghim: giống cấu trúc cũ (spacer, items, spacer)', () => {
    const rows = planRenderedRows(range, COUNT, () => HEIGHT, null);
    expect(itemIndexes(rows)).toEqual([50, 51, 52]);
    expect(rows.map((row) => row.kind)).toEqual(['spacer', 'item', 'item', 'item', 'spacer']);
    expect(totalHeight(rows)).toBe(COUNT * HEIGHT);
  });

  it('ghim item nằm trong range: không đổi gì', () => {
    expect(planRenderedRows(range, COUNT, () => HEIGHT, 51)).toEqual(planRenderedRows(range, COUNT, () => HEIGHT, null));
  });

  it('ghim item phía trên: render thêm đúng vị trí, tổng chiều cao không đổi', () => {
    const rows = planRenderedRows(range, COUNT, () => HEIGHT, 3);
    expect(itemIndexes(rows)).toEqual([3, 50, 51, 52]);
    expect(rows[0]).toMatchObject({ kind: 'spacer', height: 300 }); // trước item 3
    expect(totalHeight(rows)).toBe(COUNT * HEIGHT);
  });

  it('ghim item phía dưới: render thêm đúng vị trí, tổng chiều cao không đổi', () => {
    const rows = planRenderedRows(range, COUNT, () => HEIGHT, 90);
    expect(itemIndexes(rows)).toEqual([50, 51, 52, 90]);
    expect(totalHeight(rows)).toBe(COUNT * HEIGHT);
  });

  it('chiều cao không đều vẫn bảo toàn tổng', () => {
    const heightAt = (index: number) => 50 + (index % 7) * 30;
    const variable = computeVisibleRange({ heights: Array.from({ length: COUNT }, (_, index) => heightAt(index)), estimatedHeight: 100, scrollOffset: 4000, viewportHeight: 300, overscanPx: 0 });
    const total = Array.from({ length: COUNT }, (_, index) => heightAt(index)).reduce((sum, height) => sum + height, 0);
    for (const pinned of [0, 5, 99]) {
      const rows = planRenderedRows(variable, COUNT, heightAt, pinned);
      const sum = rows.reduce((acc, row) => acc + (row.kind === 'spacer' ? row.height : heightAt(row.index)), 0);
      expect(sum).toBe(total);
    }
  });

  it('chỉ số ghim không hợp lệ bị bỏ qua', () => {
    expect(itemIndexes(planRenderedRows(range, COUNT, () => HEIGHT, -1))).toEqual([50, 51, 52]);
    expect(itemIndexes(planRenderedRows(range, COUNT, () => HEIGHT, 500))).toEqual([50, 51, 52]);
  });
});
