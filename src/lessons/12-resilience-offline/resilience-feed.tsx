/** Phần thân lesson 12: composer + outbox + feed. Nằm trong store provider để dùng được dispatch/state. */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFeedLoader } from '../../shared/hooks/use-feed-loader';
import { FeedErrorAlert } from '../../shared/ui/feed-error-alert';
import { PostSkeletonList } from '../../shared/ui/post-skeleton';
import { useFeedDispatch, useFeedState } from '../03-normalized-store/feed-store-context';
import { REACTION_META } from '../05-optimistic-reaction/reaction-picker';
import type { ReactionEvent } from '../05-optimistic-reaction/use-toggle-reaction';
import { loadPostDetail, POST_GONE_MESSAGE } from './handle-not-found';
import { OutboxPanel } from './outbox-panel';
import { ResilientPostCard } from './resilient-post-card';
import { tempPostIdFor, useOfflineOutbox } from './use-offline-outbox';

export interface ResilienceFeedProps {
  onLog: (line: string) => void;
  onToast: (message: string, tone?: 'info' | 'error') => void;
}

export function ResilienceFeed({ onLog, onToast }: ResilienceFeedProps) {
  const state = useFeedState();
  const dispatch = useFeedDispatch();
  const { status, error, retry, sentinelRef } = useFeedLoader();
  // 📖 Bài học lesson-12 §3 – chờ trang đầu của lần mount này rồi mới dựng bài tạm (docs/lessons/lesson-12.md)
  // #region learn:feed-ready-per-mount
  /**
   * "Trang đầu của LẦN MOUNT NÀY đã về (hoặc lỗi)". Không dùng `lastFetchedAt`: store nằm ở provider phía trên nên nó còn
   * sót từ lần mount trước → feedReady true ngay khi "Tải lại feed" (remount), bài tạm được dựng TRƯỚC khi trang 'initial'
   * mới về, rồi trang đó thay cả danh sách và nuốt mất bài tạm. Ta chờ status đi qua 'loading-initial' rồi mới rời nó.
   */
  const [feedReady, setFeedReady] = useState(false);
  const sawInitialLoading = useRef(false);
  useEffect(() => {
    if (status === 'loading-initial') sawInitialLoading.current = true;
    else if (sawInitialLoading.current) setFeedReady(true);
  }, [status]);
  // #endregion learn:feed-ready-per-mount
  const outbox = useOfflineOutbox({ feedReady, onLog, onToast });
  const itemsByTempId = useMemo(() => new Map(outbox.items.map((item) => [tempPostIdFor(item.idempotencyKey), item])), [outbox.items]);

  // 📖 Bài học lesson-12 §2 – reaction lỗi thì hỏi chi tiết bài để biết có bị xoá không (docs/lessons/lesson-12.md)
  // #region learn:reaction-rolled-back-check-404
  /**
   * Reaction thất bại có thể do mạng, 5xx… hoặc bài đã bị xoá. Hook reaction chỉ cho ta message nên ta hỏi
   * thẳng endpoint chi tiết: 404 → bài biến mất khỏi feed + toast (404 của reaction nghĩa là "đã xoá").
   * Lỗi khác thì giữ nguyên: reaction đã rollback, bài vẫn còn.
   */
  const handleReactionEvent = useCallback(
    (event: ReactionEvent) => {
      if (event.kind === 'confirmed') {
        onLog(`#${event.requestSeq} ✅ reaction ${event.reaction ? REACTION_META[event.reaction].emoji : 'đã bỏ'} được server xác nhận`);
      } else if (event.kind === 'rolledBack') {
        onLog(`#${event.requestSeq} ↩️ rollback reaction ${event.postId}: ${event.message}`);
        void loadPostDetail(event.postId).then((detail) => {
          if (detail.kind !== 'gone') return;
          dispatch({ type: 'postRemoved', postId: event.postId });
          onToast(POST_GONE_MESSAGE, 'error');
          onLog(`🗑 ${event.postId} đã bị xoá ở server → gỡ khỏi feed`);
        });
      }
    },
    [dispatch, onLog, onToast],
  );
  // #endregion learn:reaction-rolled-back-check-404

  return (
    <>
      <OutboxPanel ready={outbox.ready} setupError={outbox.setupError} items={outbox.items} onSubmit={outbox.submit} onDiscard={(key) => void outbox.discard(key)} onFlush={() => void outbox.flushNow()} />
      <div className="feed" data-testid="resilience-feed">
        {status === 'loading-initial' && <PostSkeletonList count={3} />}
        {state.feed.postIds.map((postId) => (
          <ResilientPostCard key={postId} postId={postId} outboxItem={itemsByTempId.get(postId)} onReactionEvent={handleReactionEvent} />
        ))}
        {status === 'loading-older' && <PostSkeletonList count={1} />}
      </div>
      {/* GET /api/feed trả 404 (hay bất kỳ lỗi nào) = lỗi thường, đi đường lỗi chung – không có nghĩa nghiệp vụ như 404 của reaction. */}
      {status === 'error' && <FeedErrorAlert error={error} onRetry={retry} />}
      <div ref={sentinelRef} className="sentinel" aria-hidden="true" />
    </>
  );
}
