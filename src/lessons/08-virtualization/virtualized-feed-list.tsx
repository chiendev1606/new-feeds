/**
 * Danh sách ảo hoá theo window scroll (feed thường cuộn cả trang, không phải một div riêng).
 *
 * Mỗi frame có cuộn (requestAnimationFrame – không tính toán trong chính handler scroll):
 *   1. Đọc vị trí đầu list so với viewport (1 lần getBoundingClientRect).
 *   2. computeVisibleRange() → item nào render, spacer cao bao nhiêu.
 *   3. React chỉ render các item đó.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { computeVisibleRange } from './compute-visible-range';
import { useMeasuredItemHeights } from './use-measured-item-heights';

export const ESTIMATED_ITEM_HEIGHT = 360;
export const ITEM_GAP = 12;
const OVERSCAN_PX = 600;

export interface VirtualizedFeedListProps {
  itemIds: string[];
  renderItem: (id: string, index: number) => ReactNode;
  /** Phần tử đặt ngay sau item cuối (sentinel của infinite scroll). */
  footer?: ReactNode;
}

export function VirtualizedFeedList({ itemIds, renderItem, footer }: VirtualizedFeedListProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState({ scrollOffset: 0, height: typeof window === 'undefined' ? 800 : window.innerHeight });

  const onShiftAboveViewport = useCallback((delta: number) => window.scrollBy(0, delta), []);
  const { measureRef, getHeight, version } = useMeasuredItemHeights(onShiftAboveViewport);

  const readViewport = useCallback(() => {
    const listTop = listRef.current?.getBoundingClientRect().top ?? 0;
    setViewport((current) => {
      const next = { scrollOffset: -listTop, height: window.innerHeight };
      return current.scrollOffset === next.scrollOffset && current.height === next.height ? current : next;
    });
  }, []);

  useEffect(() => {
    let frame = 0;
    const schedule = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        readViewport();
      });
    };
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    return () => {
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      cancelAnimationFrame(frame);
    };
  }, [readViewport]);

  // Số item / chiều cao đã đo thay đổi → đọc lại vị trí.
  useLayoutEffect(readViewport, [readViewport, itemIds.length, version]);

  const range = computeVisibleRange({
    heights: itemIds.map(getHeight),
    // Chiều cao đo được (borderBox) đã gồm paddingBlockEnd = khoảng cách giữa các bài, nên KHÔNG cộng thêm gap
    // (cộng 2 lần thì nội dung giật mỗi khi một bài rời DOM). Ước lượng cho bài chưa đo cũng phải gồm khoảng cách đó.
    estimatedHeight: ESTIMATED_ITEM_HEIGHT + ITEM_GAP,
    scrollOffset: viewport.scrollOffset,
    viewportHeight: viewport.height,
    overscanPx: OVERSCAN_PX,
  });

  return (
    // overflow-anchor: none – tắt scroll anchoring của trình duyệt vì ta tự bù (tránh bù 2 lần).
    <div ref={listRef} style={{ overflowAnchor: 'none' }} data-rendered-range={`${range.startIndex}-${range.endIndex}`}>
      <div style={{ height: range.topSpacer }} aria-hidden="true" />
      {itemIds.slice(range.startIndex, range.endIndex).map((id, offset) => (
        <div key={id} ref={measureRef(id)} style={{ paddingBlockEnd: ITEM_GAP }}>
          {renderItem(id, range.startIndex + offset)}
        </div>
      ))}
      <div style={{ height: range.bottomSpacer }} aria-hidden="true" />
      {footer}
    </div>
  );
}
