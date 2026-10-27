/**
 * Logic tải feed dùng chung cho lesson 04+ (đứng giữa View và Data access).
 *
 * - Trang đầu: số bài theo chiều cao màn hình (bài viết: "derive initial count from viewport").
 * - Một cờ inFlightRef duy nhất cho MỌI kiểu tải (trang đầu, cuộn, tải nhanh nhiều trang): hai luồng
 *   tải cùng lúc sẽ đọc cùng một cursor và trang về sau ghi đè olderCursor (cursor bị lùi).
 * - Tự sở hữu sentinel của infinite scroll: chỉ bật khi đang rảnh và còn bài, tự observe lại mỗi khi
 *   số bài đổi → nơi dùng chỉ cần gắn `sentinelRef`.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchFeedPage } from '../api/feed-api';
import { useFeedDispatch, useFeedState } from '../../lessons/03-normalized-store/feed-store-context';
import { toErrorMessage } from '../utils/to-error-message';
import { useIntersectionSentinel } from './use-intersection-sentinel';

// 📖 Bài học lesson-04 – số bài trang đầu suy ra từ chiều cao viewport (docs/lessons/lesson-04.md)
// #region learn:feed-loader-initial-size
const ESTIMATED_POST_HEIGHT_PX = 320;
const OLDER_PAGE_SIZE = 10;

function computeInitialPageSize(viewportHeight: number) {
  return Math.min(20, Math.max(3, Math.ceil(viewportHeight / ESTIMATED_POST_HEIGHT_PX) + 1));
}
// #endregion learn:feed-loader-initial-size

export type FeedLoadStatus = 'idle' | 'loading-initial' | 'loading-older' | 'error';

/** skipped = đang có một lần tải khác nên lời gọi này bị bỏ (không gửi request). */
export type FeedLoadOutcome = { kind: 'ok' } | { kind: 'skipped' } | { kind: 'error'; message: string };

export interface FeedLoaderOptions {
  /** rootMargin cho sentinel (lesson 04 cho đổi để so sánh). */
  rootMargin?: string;
  /** Thêm điều kiện observe lại (vd lesson 08 đổi chế độ render làm sentinel đổi vị trí). */
  observeKey?: unknown;
}

export function useFeedLoader({ rootMargin, observeKey }: FeedLoaderOptions = {}) {
  const state = useFeedState();
  const dispatch = useFeedDispatch();
  const [status, setStatus] = useState<FeedLoadStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [retryMessage, setRetryMessage] = useState<string | null>(null);
  const [requestCount, setRequestCount] = useState(0);
  const inFlightRef = useRef(false);
  const olderCursorRef = useRef(state.feed.olderCursor);
  olderCursorRef.current = state.feed.olderCursor;

  // 📖 Bài học lesson-04 – inFlightRef chặn tải chồng, cursor lấy từ ref mới nhất (docs/lessons/lesson-04.md)
  // #region learn:feed-loader-load-pages
  /** Tải `pages` trang liên tiếp. initial: trang đầu thay toàn bộ list; older: nối tiếp từ olderCursor. */
  const loadPages = useCallback(
    async (direction: 'initial' | 'older', pages = 1, pageSize?: number): Promise<FeedLoadOutcome> => {
      if (inFlightRef.current) return { kind: 'skipped' };
      inFlightRef.current = true;
      setStatus(direction === 'initial' ? 'loading-initial' : 'loading-older');
      setError(null);
      try {
        let cursor = direction === 'older' ? olderCursorRef.current : null;
        for (let page = 0; page < pages; page += 1) {
          setRequestCount((count) => count + 1);
          const response = await fetchFeedPage({
            count: pageSize ?? (direction === 'initial' ? computeInitialPageSize(window.innerHeight) : OLDER_PAGE_SIZE),
            cursor,
            onRetry: ({ attempt, delayMs }) => setRetryMessage(`Lỗi tạm thời – thử lại lần ${attempt} sau ${delayMs}ms…`),
          });
          dispatch({ type: 'feedPageReceived', direction: page === 0 ? direction : 'older', response, receivedAt: Date.now() });
          cursor = response.feed.olderCursor;
          if (!response.feed.hasOlder) break;
        }
        setStatus('idle');
        return { kind: 'ok' };
      } catch (reason) {
        const message = toErrorMessage(reason);
        setError(message);
        setStatus('error');
        return { kind: 'error', message };
      } finally {
        setRetryMessage(null);
        inFlightRef.current = false;
      }
    },
    [dispatch],
  );
  // #endregion learn:feed-loader-load-pages

  useEffect(() => {
    void loadPages('initial');
  }, [loadPages]);

  // 📖 Bài học lesson-04 – chỉ tải tiếp khi còn bài cũ hơn (docs/lessons/lesson-04.md)
  // #region learn:feed-loader-load-older
  const hasOlder = state.feed.hasOlder;
  const postCount = state.feed.postIds.length;
  const loadOlder = useCallback(() => {
    if (hasOlder && postCount > 0) void loadPages('older');
  }, [loadPages, hasOlder, postCount]);
  // #endregion learn:feed-loader-load-older

  /** Tải nhanh nhiều trang (lesson 08) – dùng chung cờ inFlight với infinite scroll. */
  const loadMany = useCallback(
    async (pages: number, pageSize = 50): Promise<void> => {
      await loadPages('older', pages, pageSize);
    },
    [loadPages],
  );

  // 📖 Bài học lesson-09 – tải lại từ đầu dùng chung cờ inFlight (docs/lessons/lesson-09.md)
  // #region learn:feed-loader-reload
  /**
   * Tải lại từ trang đầu (thay toàn bộ list) – đi cùng cờ inFlight với mọi kiểu tải khác. Đang có lần tải khác thì bỏ qua
   * (trả 'skipped'). Không tự dựng request riêng ở nơi dùng: request ngoài loader không biết về inFlight nên có thể chạy
   * chồng với trang "older" đang bay (đọc olderCursor cũ) rồi nối nhầm vào list mới → feed bị hổng giữa.
   */
  const reload = useCallback((pageSize?: number) => loadPages('initial', 1, pageSize), [loadPages]);
  // #endregion learn:feed-loader-reload

  const retry = useCallback(() => void loadPages(postCount === 0 ? 'initial' : 'older'), [loadPages, postCount]);

  // 📖 Bài học lesson-04 – sentinel chỉ bật khi rảnh và observe lại khi số bài đổi (docs/lessons/lesson-04.md)
  // #region learn:feed-loader-sentinel
  const sentinelRef = useIntersectionSentinel(loadOlder, {
    rootMargin,
    enabled: hasOlder && status === 'idle',
    observeKey: [postCount, observeKey].join('|'),
  });
  // #endregion learn:feed-loader-sentinel

  return { status, error, retryMessage, requestCount, loadMany, reload, retry, hasOlder, sentinelRef };
}
