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

const ESTIMATED_POST_HEIGHT_PX = 320;
const OLDER_PAGE_SIZE = 10;

function computeInitialPageSize(viewportHeight: number) {
  return Math.min(20, Math.max(3, Math.ceil(viewportHeight / ESTIMATED_POST_HEIGHT_PX) + 1));
}

export type FeedLoadStatus = 'idle' | 'loading-initial' | 'loading-older' | 'error';

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

  /** Tải `pages` trang liên tiếp. initial: trang đầu thay toàn bộ list; older: nối tiếp từ olderCursor. */
  const loadPages = useCallback(
    async (direction: 'initial' | 'older', pages = 1, pageSize?: number) => {
      if (inFlightRef.current) return;
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
      } catch (reason) {
        setError(toErrorMessage(reason));
        setStatus('error');
      } finally {
        setRetryMessage(null);
        inFlightRef.current = false;
      }
    },
    [dispatch],
  );

  useEffect(() => {
    void loadPages('initial');
  }, [loadPages]);

  const hasOlder = state.feed.hasOlder;
  const postCount = state.feed.postIds.length;
  const loadOlder = useCallback(() => {
    if (hasOlder && postCount > 0) void loadPages('older');
  }, [loadPages, hasOlder, postCount]);

  /** Tải nhanh nhiều trang (lesson 08) – dùng chung cờ inFlight với infinite scroll. */
  const loadMany = useCallback((pages: number, pageSize = 50) => loadPages('older', pages, pageSize), [loadPages]);

  const retry = useCallback(() => void loadPages(postCount === 0 ? 'initial' : 'older'), [loadPages, postCount]);

  const sentinelRef = useIntersectionSentinel(loadOlder, {
    rootMargin,
    enabled: hasOlder && status === 'idle',
    observeKey: [postCount, observeKey].join('|'),
  });

  return { status, error, retryMessage, requestCount, loadMany, retry, hasOlder, sentinelRef };
}
