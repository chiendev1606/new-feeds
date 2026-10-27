/**
 * GIỮ VỊ TRÍ SCROLL KHI QUAY LẠI FEED – phần dính vào DOM/React (logic thuần ở scroll-anchor.ts).
 *
 * Luồng:
 *   1. Khi đang ở feed: cuộn xong 120ms (debounce) hoặc ngay trước khi rời feed → chụp anchor
 *      (bài đang ở đỉnh màn hình + độ lệch) từ DOM. Lưu vào ref (SPA: store còn sống) và sessionStorage
 *      (tải lại trang vẫn còn). Anchor mang theo hạn dùng (30 phút); KHÔNG gắn với `generation` của feed vì bài mới chèn lên đầu không làm anchor sai.
 *   2. Quay lại feed: list render xong (useLayoutEffect → trước khi trình duyệt vẽ, không thấy nhảy) thì đặt
 *      scroll về anchor.
 *   3. VÌ SAO phải lặp (settle loop) thay vì scrollTo một lần? Feed ảo hoá chỉ biết chiều cao ƯỚC LƯỢNG của các
 *      bài chưa đo. Sau khi nhảy tới, các bài phía trên bài neo được render và đo thật → bài neo trôi đi vài
 *      chục px. Mỗi frame ta đo lại vị trí thật của bài neo và bù, tới khi ổn định (hoặc người dùng tự cuộn).
 *   4. Tải lại trang: store rỗng, bài neo có thể chưa được tải → tải thêm trang tới khi có (hoặc hết bài thì bỏ anchor).
 *
 * `history.scrollRestoration = 'manual'`: tắt khôi phục scroll của trình duyệt (nó chỉ biết scrollY thô và
 * chạy trước khi feed render) để không giành quyền với cơ chế của ta.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import type { VirtualizedFeedListHandle } from '../08-virtualization/virtualized-feed-list';
import {
  captureScrollAnchor,
  computeRestoreScrollTop,
  isAnchorFresh,
  parseStoredScrollAnchor,
  SCROLL_ANCHOR_STORAGE_KEY,
  serializeScrollAnchor,
  type StoredScrollAnchor,
  withExpiry,
} from './scroll-anchor';

const CAPTURE_DEBOUNCE_MS = 120;
const MAX_SETTLE_FRAMES = 90;
const STABLE_FRAMES_REQUIRED = 3;
const MAX_LOAD_ATTEMPTS = 8;

export interface ScrollRestorationFeed {
  postIds: readonly string[];
  lastFetchedAt: number | null;
  hasOlder: boolean;
}

export interface ScrollRestorationOptions {
  /** true khi view feed đang hiển thị. */
  active: boolean;
  containerRef: RefObject<HTMLElement | null>;
  listHandleRef: RefObject<VirtualizedFeedListHandle | null>;
  feed: ScrollRestorationFeed;
  isLoading: boolean;
  /** Tải thêm bài cũ (dùng khi bài neo chưa có trong store sau khi tải lại trang). */
  loadMore: () => void | Promise<void>;
}

export type RestorePhase = 'idle' | 'loading-anchor-post' | 'settling';

export interface RestoreReport {
  postId: string;
  /** Độ lệch cuối cùng giữa vị trí bài neo và vị trí đã lưu (px). */
  driftPx: number;
  frames: number;
  interrupted: boolean;
}

function readStoredAnchor(): StoredScrollAnchor | null {
  try {
    return parseStoredScrollAnchor(window.sessionStorage.getItem(SCROLL_ANCHOR_STORAGE_KEY));
  } catch {
    return null; // sessionStorage bị chặn (chế độ riêng tư) → chỉ dùng ref
  }
}

export function useScrollRestoration({ active, containerRef, listHandleRef, feed, isLoading, loadMore }: ScrollRestorationOptions) {
  const [anchor, setAnchor] = useState<StoredScrollAnchor | null>(readStoredAnchor);
  const [phase, setPhase] = useState<RestorePhase>('idle');
  const [report, setReport] = useState<RestoreReport | null>(null);

  const anchorRef = useRef(anchor);
  const activeRef = useRef(active);
  activeRef.current = active;
  /** Chờ khôi phục ở lần hiển thị feed kế tiếp. Trong lúc chờ/đang khôi phục không chụp anchor mới (sẽ ghi đè anchor cần dùng). */
  const armedRef = useRef(true);
  const settlingRef = useRef(false);
  const loadAttemptsRef = useRef(0);
  const cancelSettleRef = useRef<(() => void) | null>(null);

  const persist = useCallback((next: StoredScrollAnchor | null) => {
    anchorRef.current = next;
    setAnchor(next);
    try {
      if (next) window.sessionStorage.setItem(SCROLL_ANCHOR_STORAGE_KEY, serializeScrollAnchor(next));
      else window.sessionStorage.removeItem(SCROLL_ANCHOR_STORAGE_KEY);
    } catch {
      // bỏ qua: không lưu được vào sessionStorage thì vẫn còn ref
    }
  }, []);

  // 📖 Bài học lesson-09 §1 – chụp anchor từ DOM, không ghi đè khi đang chờ khôi phục (docs/lessons/lesson-09.md)
  // #region learn:restore-capture-now
  const captureNow = useCallback(() => {
    const container = containerRef.current;
    if (!activeRef.current || armedRef.current || settlingRef.current || !container) return;
    const scrollY = window.scrollY;
    const rects = [...container.querySelectorAll<HTMLElement>('article[data-post-id]')]
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return { postId: element.dataset.postId ?? '', top: rect.top + scrollY, bottom: rect.bottom + scrollY };
      })
      .filter((rect) => rect.postId !== '')
      .sort((first, second) => first.top - second.top);
    const point = captureScrollAnchor(rects, scrollY);
    if (point) persist(withExpiry(point, Date.now()));
  }, [containerRef, persist]);
  // #endregion learn:restore-capture-now

  const clearAnchor = useCallback(() => {
    persist(null);
    setReport(null);
  }, [persist]);

  // 📖 Bài học lesson-09 §1 – tắt khôi phục scroll mặc định của trình duyệt (docs/lessons/lesson-09.md)
  // #region learn:restore-manual-scroll-restoration
  useEffect(() => {
    const previous = window.history.scrollRestoration;
    window.history.scrollRestoration = 'manual';
    return () => {
      window.history.scrollRestoration = previous;
    };
  }, []);
  // #endregion learn:restore-manual-scroll-restoration

  // Chụp anchor khi cuộn (debounce) và khi trang sắp đóng/ẩn.
  useEffect(() => {
    if (!active) return;
    let timer = 0;
    const onScroll = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(captureNow, CAPTURE_DEBOUNCE_MS);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('pagehide', captureNow);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('pagehide', captureNow);
    };
  }, [active, captureNow]);

  // 📖 Bài học lesson-09 §1 – vòng bù vị trí từng frame cho tới khi ổn định (docs/lessons/lesson-09.md)
  // #region learn:restore-settle-loop
  const settle = useCallback(
    (target: StoredScrollAnchor) => {
      settlingRef.current = true;
      setPhase('settling');
      let frame = 0;
      let frames = 0;
      let stableFrames = 0;
      let interrupted = false;

      const findElement = () =>
        containerRef.current?.querySelector<HTMLElement>(`article[data-post-id="${CSS.escape(target.postId)}"]`) ?? null;

      const finish = () => {
        cancelAnimationFrame(frame);
        removeInterruptListeners();
        cancelSettleRef.current = null;
        settlingRef.current = false;
        const element = findElement();
        const driftPx = element ? Math.abs(element.getBoundingClientRect().top - target.offsetPx) : Number.NaN;
        setReport({ postId: target.postId, driftPx: Math.round(driftPx * 10) / 10, frames, interrupted });
        setPhase('idle');
      };

      // Người dùng tự cuộn/bấm trong lúc ta đang bù → dừng ngay, không giành quyền điều khiển.
      const interrupt = () => {
        interrupted = true;
        finish();
      };
      const interruptEvents = ['wheel', 'touchstart', 'pointerdown', 'keydown'] as const;
      const removeInterruptListeners = () => interruptEvents.forEach((name) => window.removeEventListener(name, interrupt));
      interruptEvents.forEach((name) => window.addEventListener(name, interrupt, { passive: true }));

      const tick = () => {
        frames += 1;
        const element = findElement();
        if (element) {
          const top = element.getBoundingClientRect().top + window.scrollY;
          const scrollTop = computeRestoreScrollTop(target, { [target.postId]: top });
          if (scrollTop !== null && Math.abs(scrollTop - window.scrollY) >= 1) {
            window.scrollTo({ top: scrollTop, behavior: 'instant' });
            stableFrames = 0;
          } else {
            stableFrames += 1;
          }
        } else {
          // Bài neo chưa có trong DOM (đang bị ảo hoá): nhảy theo chiều cao ước lượng, các frame sau sẽ tinh chỉnh.
          listHandleRef.current?.scrollToItem(target.postId, target.offsetPx);
          stableFrames = 0;
        }
        if (stableFrames >= STABLE_FRAMES_REQUIRED || frames >= MAX_SETTLE_FRAMES) finish();
        else frame = requestAnimationFrame(tick);
      };

      cancelSettleRef.current = finish;
      tick(); // lần đầu chạy ngay trong layout effect → trước khi vẽ
    },
    [containerRef, listHandleRef],
  );
  // #endregion learn:restore-settle-loop

  // 📖 Bài học lesson-09 §1 – quyết định khi quay lại feed: khôi phục, tải thêm hay bỏ anchor (docs/lessons/lesson-09.md)
  // #region learn:restore-decision-effect
  useLayoutEffect(() => {
    if (!active) {
      // Rời feed: lần sau quay lại sẽ khôi phục; huỷ vòng bù đang dở nếu có.
      armedRef.current = true;
      loadAttemptsRef.current = 0;
      cancelSettleRef.current?.();
      return;
    }
    if (!armedRef.current) return;
    const saved = anchorRef.current;
    if (!saved) {
      armedRef.current = false;
      return;
    }
    if (feed.lastFetchedAt === null) return; // feed chưa có dữ liệu (vừa tải lại trang)

    if (!isAnchorFresh(saved, Date.now())) {
      persist(null); // quá hạn → người dùng đã đi quá lâu, vị trí cũ không còn đáng khôi phục
      armedRef.current = false;
      return;
    }
    if (feed.postIds.includes(saved.postId)) {
      armedRef.current = false;
      setPhase('idle');
      settle(saved);
      return;
    }
    if (isLoading) return;
    if (feed.hasOlder && loadAttemptsRef.current < MAX_LOAD_ATTEMPTS) {
      loadAttemptsRef.current += 1;
      setPhase('loading-anchor-post');
      void loadMore();
      return;
    }
    persist(null); // tải hết/không tải được mà vẫn không thấy bài neo → bỏ
    armedRef.current = false;
    setPhase('idle');
  }, [active, feed.lastFetchedAt, feed.postIds, feed.hasOlder, isLoading, loadMore, persist, settle]);
  // #endregion learn:restore-decision-effect

  useEffect(() => () => cancelSettleRef.current?.(), []);

  return { anchor, phase, report, captureNow, clearAnchor };
}
