/**
 * Banner "Có N bài mới" (xử lý feed cũ – stale feed).
 *
 * KHÔNG tự chèn bài mới lên đầu khi người dùng đang đọc → nội dung nhảy, mất chỗ đang đọc.
 * Thay vào đó: lặng lẽ kiểm tra (polling direction=newer), giữ kết quả, hiện banner;
 * người dùng bấm thì mới chèn và cuộn lên đầu.
 *
 * - aria-live="polite": screen reader đọc thông báo khi rảnh, không ngắt ngang.
 * - Tạm dừng polling khi tab ẩn (document.visibilityState) để tiết kiệm pin/mạng.
 * - Production có thể dùng SSE/WebSocket thay polling; bài viết so sánh các phương án này.
 */
import { useEffect, useRef, useState } from 'react';
import { fetchFeedPage } from '../../shared/api/feed-api';
import type { NormalizedFeedResponse } from '../../shared/types/feed-entities';
import { useFeedDispatch, useFeedState } from '../03-normalized-store/feed-store-context';

export const NEW_POSTS_POLL_INTERVAL_MS = 10_000;

export function NewPostsBanner() {
  const state = useFeedState();
  const dispatch = useFeedDispatch();
  // 📖 Bài học lesson-04 §5 – polling bài mới, không chồng request (docs/lessons/lesson-04.md)
  // #region learn:new-posts-polling-effect
  const [pending, setPending] = useState<NormalizedFeedResponse | null>(null);
  const [lastCheckedAt, setLastCheckedAt] = useState<Date | null>(null);
  const newerCursorRef = useRef(state.feed.newerCursor);
  newerCursorRef.current = state.feed.newerCursor;

  useEffect(() => {
    const controller = new AbortController();
    let checking = false;
    const check = async () => {
      // Không chồng request: mạng chậm hơn chu kỳ polling thì bỏ lượt này.
      if (checking || document.visibilityState !== 'visible' || !newerCursorRef.current) return;
      checking = true;
      try {
        const response = await fetchFeedPage({ count: 20, cursor: newerCursorRef.current, direction: 'newer', signal: controller.signal });
        setLastCheckedAt(new Date());
        if (response.feed.postIds.length > 0) setPending(response);
      } catch {
        // Polling lỗi (hoặc bị huỷ khi rời trang) thì bỏ qua, lần sau thử lại – không làm phiền người dùng.
      } finally {
        checking = false;
      }
    };
    const timer = setInterval(() => void check(), NEW_POSTS_POLL_INTERVAL_MS);
    const onVisible = () => document.visibilityState === 'visible' && void check();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      controller.abort();
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);
  // #endregion learn:new-posts-polling-effect

  const count = pending?.feed.postIds.length ?? 0;

  return (
    <>
      <div aria-live="polite" className="new-posts-banner-region">
        {/* 📖 Bài học lesson-04 §5 – người dùng bấm thì mới chèn bài mới (docs/lessons/lesson-04.md) */}
        {/* #region learn:new-posts-apply-on-click */}
        {pending && (
          <button
            type="button"
            className="new-posts-banner primary"
            onClick={() => {
              dispatch({ type: 'feedPageReceived', direction: 'newer', response: pending, receivedAt: Date.now() });
              setPending(null);
              window.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
            }}
          >
            ↑ Có {count}
            {pending.feed.hasNewer ? '+' : ''} bài mới
          </button>
        )}
        {/* #endregion learn:new-posts-apply-on-click */}
      </div>
      <p className="muted">
        Kiểm tra bài mới mỗi {NEW_POSTS_POLL_INTERVAL_MS / 1000}s{lastCheckedAt ? ` · lần cuối ${lastCheckedAt.toLocaleTimeString()}` : ''}
      </p>
    </>
  );
}
