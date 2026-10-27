/**
 * Lõi của virtualization (windowing) – hàm thuần, dễ test.
 *
 * Cho chiều cao từng item (đã đo, hoặc ước lượng nếu chưa đo) và vị trí cuộn,
 * tính ra item nào cần render + chiều cao 2 khoảng trống (spacer) trên/dưới để thanh cuộn vẫn đúng.
 *
 *   ┌──────────────┐
 *   │ topSpacer    │  = tổng chiều cao các item [0, startIndex)
 *   ├──────────────┤
 *   │ item start   │
 *   │ ...          │  ← chỉ những item này có trong DOM
 *   │ item end-1   │
 *   ├──────────────┤
 *   │ bottomSpacer │  = tổng chiều cao các item [endIndex, n)
 *   └──────────────┘
 */
// 📖 Bài học lesson-08 §1 – đầu vào và đầu ra của hàm tính range (docs/lessons/lesson-08.md)
// #region learn:visible-range-types
export interface VisibleRangeInput {
  /** heights[i] = chiều cao đã đo; undefined = chưa đo → dùng estimatedHeight. */
  heights: ReadonlyArray<number | undefined>;
  /** Chiều cao dùng cho item chưa đo (nên gồm cả khoảng cách giữa các item). */
  estimatedHeight: number;
  /** Đã cuộn bao nhiêu px tính từ ĐẦU LIST (có thể âm nếu list còn ở dưới màn hình). */
  scrollOffset: number;
  viewportHeight: number;
  /** Render thêm bao nhiêu px phía trên/dưới viewport để cuộn nhanh không thấy khoảng trắng. */
  overscanPx: number;
}

export interface VisibleRange {
  startIndex: number;
  /** exclusive */
  endIndex: number;
  topSpacer: number;
  bottomSpacer: number;
  totalHeight: number;
}
// #endregion learn:visible-range-types

// 📖 Bài học lesson-08 §1 – tính item cần render và hai spacer (docs/lessons/lesson-08.md)
// #region learn:compute-visible-range
export function computeVisibleRange({ heights, estimatedHeight, scrollOffset, viewportHeight, overscanPx }: VisibleRangeInput): VisibleRange {
  const count = heights.length;
  const windowTop = scrollOffset - overscanPx;
  const windowBottom = scrollOffset + viewportHeight + overscanPx;

  let offset = 0;
  let startIndex = count;
  let endIndex = count;
  let topSpacer = 0;

  for (let index = 0; index < count; index += 1) {
    const height = heights[index] ?? estimatedHeight;
    const itemTop = offset;
    const itemBottom = offset + height;
    if (startIndex === count && itemBottom > windowTop) {
      startIndex = index;
      topSpacer = itemTop;
    }
    if (startIndex !== count && itemTop >= windowBottom) {
      endIndex = index;
      break;
    }
    offset = itemBottom;
  }

  let totalHeight = offset;
  for (let index = endIndex; index < count; index += 1) totalHeight += heights[index] ?? estimatedHeight;
  const renderedHeight = heights.slice(startIndex, endIndex).reduce<number>((sum, height) => sum + (height ?? estimatedHeight), 0);

  return {
    startIndex,
    endIndex,
    topSpacer,
    bottomSpacer: Math.max(0, totalHeight - topSpacer - renderedHeight),
    totalHeight,
  };
}
// #endregion learn:compute-visible-range
