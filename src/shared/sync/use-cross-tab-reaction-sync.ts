/**
 * Hook bật đồng bộ reaction giữa các tab cho một feed store có reaction (lesson 05+).
 *
 * Nhận tin từ tab khác → dispatch `entitiesMerged` với post đã vá. KHÔNG đụng vào bài đang có thao tác
 * chờ server (pendingReactions): bài đó sẽ được cập nhật bằng response của chính request đó, và nếu ta
 * ghi đè giữa chừng thì UI nhảy qua lại. Tin bị bỏ qua được GIỮ LẠI (bản mới nhất theo bài) và áp lại khi
 * pendingReactions đổi (bài hết chờ) – nếu confirmedAt của nó vẫn mới hơn bản tab đã biết.
 */
import { useEffect, useRef } from 'react';
import { getSession } from '../api/feed-api';
import { useFeedDispatch, useFeedState } from '../../lessons/03-normalized-store/feed-store-context';
import type { ReactionAwareFeedState } from '../../lessons/05-optimistic-reaction/reaction-reducer-with-rollback';
import { openReactionSyncChannel, setActiveReactionSyncChannel, type ReactionSyncChannel, type ReactionSyncLogEntry, type ReactionSyncMessage } from './cross-tab-reaction-sync';

export function useCrossTabReactionSync(onLog?: (entry: ReactionSyncLogEntry) => void) {
  const state = useFeedState<ReactionAwareFeedState>();
  const dispatch = useFeedDispatch();
  // Handler của kênh sống lâu hơn một lần render → đọc state/log mới nhất qua ref.
  const stateRef = useRef(state);
  stateRef.current = state;
  const logRef = useRef(onLog);
  logRef.current = onLog;
  const channelRef = useRef<ReactionSyncChannel | null>(null);

  useEffect(() => {
    let cancelled = false;
    let close: (() => void) | null = null;

    // 📖 Bài học lesson-09 – không ghi đè bài đang chờ server (docs/lessons/lesson-09.md)
    // #region learn:cross-tab-apply-patch
    const applyPatch = (message: ReactionSyncMessage): boolean => {
      const current = stateRef.current;
      const post = current.postsById[message.postId];
      if (!post || current.pendingReactions[message.postId]) return false;
      dispatch({
        type: 'entitiesMerged',
        entities: { posts: { [post.id]: { ...post, viewerReaction: message.viewerReaction, engagementSummary: message.engagementSummary } } },
      });
      return true;
    };
    // #endregion learn:cross-tab-apply-patch

    // 📖 Bài học lesson-09 – mở kênh theo viewerId, không có session thì tắt đồng bộ (docs/lessons/lesson-09.md)
    // #region learn:cross-tab-open-channel
    getSession()
      .then(({ viewerId }) => {
        if (cancelled) return;
        const channel = openReactionSyncChannel(viewerId, { onPatch: applyPatch, onLog: (entry) => logRef.current?.(entry) });
        if (!channel) return;
        setActiveReactionSyncChannel(channel);
        channelRef.current = channel;
        close = () => {
          channelRef.current = null;
          setActiveReactionSyncChannel(null);
          channel.close();
        };
      })
      // Không có session → không biết tách kênh theo ai → tắt đồng bộ thay vì dùng kênh chung (lộ dữ liệu giữa người dùng).
      .catch(() => undefined);
    // #endregion learn:cross-tab-open-channel

    return () => {
      cancelled = true;
      close?.();
    };
  }, [dispatch]);

  // 📖 Bài học lesson-09 – bài hết chờ thì áp lại các tin đã hoãn (docs/lessons/lesson-09.md)
  // #region learn:cross-tab-flush-deferred
  // Bài hết chờ server (pendingReactions đổi) → thử áp lại các tin đã bị bỏ qua trước đó.
  const pendingReactions = state.pendingReactions;
  useEffect(() => {
    channelRef.current?.flushDeferred();
  }, [pendingReactions]);
  // #endregion learn:cross-tab-flush-deferred
}
