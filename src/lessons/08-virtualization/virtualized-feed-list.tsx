/**
 * Danh sách ảo hoá theo window scroll (feed thường cuộn cả trang, không phải một div riêng).
 *
 * Mỗi frame có cuộn (requestAnimationFrame – không tính toán trong chính handler scroll):
 *   1. Đọc vị trí đầu list so với viewport (1 lần getBoundingClientRect).
 *   2. computeVisibleRange() → item nào render, spacer cao bao nhiêu.
 *   3. React chỉ render các item đó.
 *
 * Mở rộng cho lesson 09 (tuỳ chọn, mặc định tắt nên lesson 08 chạy như cũ):
 *   - pinnedIndex / keyboardNav: item đang có focus luôn được render dù đã cuộn ra xa → không mất focus.
 *   - keyboardNav: Page Down / Page Up chuyển focus giữa các bài (WAI-ARIA feed pattern).
 *   - handleRef.scrollToItem: cuộn tới một item theo id (dùng để khôi phục vị trí scroll).
 */
import { useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode, type Ref } from 'react';
import { computeVisibleRange, type VisibleRange } from './compute-visible-range';
import { useMeasuredItemHeights } from './use-measured-item-heights';

export const ESTIMATED_ITEM_HEIGHT = 360;
export const ITEM_GAP = 12;
const OVERSCAN_PX = 600;

export interface VirtualizedFeedListProps {
  itemIds: string[];
  renderItem: (id: string, index: number) => ReactNode;
  /** Phần tử đặt ngay sau item cuối (sentinel của infinite scroll). */
  footer?: ReactNode;
  /** Item luôn được render (vd bài đang focus) kể cả khi nằm ngoài vùng nhìn thấy. */
  pinnedIndex?: number | null;
  /** Bật theo dõi focus (tự ghim item đang focus) + phím Page Down/Page Up. */
  keyboardNav?: boolean;
  handleRef?: Ref<VirtualizedFeedListHandle>;
}

export interface VirtualizedFeedListHandle {
  /** Cuộn sao cho đỉnh item cách đỉnh viewport `offsetPx`. Dùng chiều cao đã đo (hoặc ước lượng nếu chưa đo). false nếu id không có. */
  scrollToItem(id: string, offsetPx: number): boolean;
}

export type RenderRow = { kind: 'spacer'; key: string; height: number } | { kind: 'item'; index: number };

// 📖 Bài học lesson-08 §2 – kế hoạch render spacer và item (docs/lessons/lesson-08.md)
// #region learn:plan-rendered-rows
/**
 * Kế hoạch render: spacer trên, các item trong range, spacer dưới – cộng thêm item được ghim nếu nó nằm ngoài range.
 * Item ghim được đặt đúng vị trí của nó bằng cách chia spacer làm hai để tổng chiều cao (và thanh cuộn) không đổi.
 * Hàm thuần để test.
 */
export function planRenderedRows(range: VisibleRange, itemCount: number, heightAt: (index: number) => number, pinnedIndex: number | null | undefined): RenderRow[] {
  const { startIndex, endIndex, topSpacer, bottomSpacer } = range;
  const rows: RenderRow[] = [];
  const items = (from: number, to: number) => {
    for (let index = from; index < to; index += 1) rows.push({ kind: 'item', index });
  };
  const sumHeights = (from: number, to: number) => {
    let total = 0;
    for (let index = from; index < to; index += 1) total += heightAt(index);
    return total;
  };
  const pinned = pinnedIndex ?? -1;
  const needsPin = pinned >= 0 && pinned < itemCount && (pinned < startIndex || pinned >= endIndex);

  if (needsPin && pinned < startIndex) {
    const before = sumHeights(0, pinned);
    rows.push({ kind: 'spacer', key: 'spacer-top', height: before });
    items(pinned, pinned + 1);
    rows.push({ kind: 'spacer', key: 'spacer-mid', height: Math.max(0, topSpacer - before - heightAt(pinned)) });
    items(startIndex, endIndex);
    rows.push({ kind: 'spacer', key: 'spacer-bottom', height: bottomSpacer });
  } else if (needsPin) {
    const between = sumHeights(endIndex, pinned);
    rows.push({ kind: 'spacer', key: 'spacer-top', height: topSpacer });
    items(startIndex, endIndex);
    rows.push({ kind: 'spacer', key: 'spacer-mid', height: between });
    items(pinned, pinned + 1);
    rows.push({ kind: 'spacer', key: 'spacer-bottom', height: Math.max(0, bottomSpacer - between - heightAt(pinned)) });
  } else {
    rows.push({ kind: 'spacer', key: 'spacer-top', height: topSpacer });
    items(startIndex, endIndex);
    rows.push({ kind: 'spacer', key: 'spacer-bottom', height: bottomSpacer });
  }
  return rows;
}
// #endregion learn:plan-rendered-rows

const ITEM_ATTRIBUTE = 'data-virtual-item-id';

export function VirtualizedFeedList({ itemIds, renderItem, footer, pinnedIndex, keyboardNav = false, handleRef }: VirtualizedFeedListProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const itemIdsRef = useRef(itemIds);
  itemIdsRef.current = itemIds;
  // Item đang giữ focus (chỉ khi keyboardNav) và yêu cầu chuyển focus sau lần render kế tiếp.
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [focusRequestId, setFocusRequestId] = useState<string | null>(null);
  const [viewport, setViewport] = useState({ scrollOffset: 0, height: typeof window === 'undefined' ? 800 : window.innerHeight });

  // 📖 Bài học lesson-08 §3 – bù scroll bằng window.scrollBy (docs/lessons/lesson-08.md)
  // #region learn:scroll-compensation-hook
  const onShiftAboveViewport = useCallback((delta: number) => window.scrollBy(0, delta), []);
  const { measureRef, getHeight, version } = useMeasuredItemHeights(onShiftAboveViewport);
  // #endregion learn:scroll-compensation-hook

  // 📖 Bài học lesson-08 §2 – đọc viewport một lần mỗi frame (docs/lessons/lesson-08.md)
  // #region learn:scroll-raf-viewport
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
  // #endregion learn:scroll-raf-viewport

  useImperativeHandle(
    handleRef,
    () => ({
      scrollToItem(id, offsetPx) {
        const ids = itemIdsRef.current;
        const index = ids.indexOf(id);
        const list = listRef.current;
        if (index < 0 || !list) return false;
        let top = list.getBoundingClientRect().top + window.scrollY;
        for (let position = 0; position < index; position += 1) top += getHeight(ids[position]!) ?? ESTIMATED_ITEM_HEIGHT + ITEM_GAP;
        window.scrollTo(0, Math.max(0, top - offsetPx));
        return true;
      },
    }),
    [getHeight],
  );

  // Số item / chiều cao đã đo thay đổi → đọc lại vị trí.
  useLayoutEffect(readViewport, [readViewport, itemIds.length, version]);

  // 📖 Bài học lesson-08 §2 – chiều cao đo đã gồm gap nên không cộng thêm (docs/lessons/lesson-08.md)
  // #region learn:range-and-gap
  const heights = itemIds.map(getHeight);
  const estimatedHeight = ESTIMATED_ITEM_HEIGHT + ITEM_GAP;
  const range = computeVisibleRange({
    heights,
    // Chiều cao đo được (borderBox) đã gồm paddingBlockEnd = khoảng cách giữa các bài, nên KHÔNG cộng thêm gap
    // (cộng 2 lần thì nội dung giật mỗi khi một bài rời DOM). Ước lượng cho bài chưa đo cũng phải gồm khoảng cách đó.
    estimatedHeight,
    scrollOffset: viewport.scrollOffset,
    viewportHeight: viewport.height,
    overscanPx: OVERSCAN_PX,
  });

  const focusedIndex = keyboardNav && focusedId ? itemIds.indexOf(focusedId) : -1;
  const effectivePinned = pinnedIndex ?? (focusedIndex >= 0 ? focusedIndex : null);
  const rows = planRenderedRows(range, itemIds.length, (index) => heights[index] ?? estimatedHeight, effectivePinned);
  // #endregion learn:range-and-gap

  // Chuyển focus sang bài vừa được yêu cầu (đã được ghim nên chắc chắn có trong DOM ở commit này).
  useLayoutEffect(() => {
    if (!focusRequestId) return;
    const wrapper = listRef.current?.querySelector<HTMLElement>(`[${ITEM_ATTRIBUTE}="${CSS.escape(focusRequestId)}"]`);
    // Phần tử nhận focus = phần tử đầu tiên có tabindex trong item (article tabIndex=-1).
    const target = wrapper?.querySelector<HTMLElement>('[tabindex]');
    setFocusRequestId(null);
    if (!target) return;
    target.focus({ preventScroll: true });
    // Người dùng chọn giảm chuyển động → cuộn tức thì, không smooth.
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    target.scrollIntoView({ block: 'start', behavior: reduceMotion ? 'auto' : 'smooth' });
  }, [focusRequestId]);

  const itemIdOf = (node: EventTarget | null) => (node instanceof Element ? node.closest(`[${ITEM_ATTRIBUTE}]`)?.getAttribute(ITEM_ATTRIBUTE) ?? null : null);

  const handleFocus = (event: React.FocusEvent) => {
    const id = itemIdOf(event.target);
    if (id) setFocusedId(id);
  };
  // Focus rời hẳn khỏi list → bỏ ghim. Focus chuyển giữa các item (relatedTarget còn trong list) thì giữ để handleFocus đặt lại.
  const handleBlur = (event: React.FocusEvent) => {
    if (!(event.relatedTarget instanceof Node) || !listRef.current?.contains(event.relatedTarget)) setFocusedId(null);
  };

  const handleKeyDown = (event: KeyboardEvent) => {
    if ((event.key !== 'PageDown' && event.key !== 'PageUp') || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    const currentId = itemIdOf(event.target);
    if (!currentId) return;
    const ids = itemIdsRef.current;
    const nextId = ids[ids.indexOf(currentId) + (event.key === 'PageDown' ? 1 : -1)];
    event.preventDefault(); // không để trang cuộn theo mặc định
    if (!nextId) return;
    setFocusedId(nextId); // ghim bài đích để nó được render dù đang ở rất xa vùng nhìn thấy
    setFocusRequestId(nextId);
  };

  const keyboardProps = keyboardNav ? { onFocus: handleFocus, onBlur: handleBlur, onKeyDown: handleKeyDown } : {};

  // 📖 Bài học lesson-08 §2 – spacer aria-hidden và item được đo (docs/lessons/lesson-08.md)
  // #region learn:render-spacers-and-items
  return (
    // overflow-anchor: none – tắt scroll anchoring của trình duyệt vì ta tự bù (tránh bù 2 lần).
    <div ref={listRef} style={{ overflowAnchor: 'none' }} data-rendered-range={`${range.startIndex}-${range.endIndex}`} {...keyboardProps}>
      {rows.map((row) => {
        if (row.kind === 'spacer') return <div key={row.key} style={{ height: row.height }} aria-hidden="true" />;
        const id = itemIds[row.index];
        if (id === undefined) return null;
        return (
          <div key={id} ref={measureRef(id)} style={{ paddingBlockEnd: ITEM_GAP }} {...{ [ITEM_ATTRIBUTE]: id }}>
            {renderItem(id, row.index)}
          </div>
        );
      })}
      {footer}
    </div>
  // #endregion learn:render-spacers-and-items
  );
}
