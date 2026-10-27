/**
 * Hook gửi reaction: dispatch optimistic → gọi API → confirmed / rolledBack.
 *
 * GỬI TUẦN TỰ THEO TỪNG BÀI (serialize per post) + gộp ý định:
 *   Nếu gửi song song "Thích" rồi "Bỏ thích", mạng/server có thể xử lý chúng SAI THỨ TỰ
 *   → server lưu "Thích" trong khi UI hiện "Bỏ thích". requestSeq ở client chỉ sắp thứ tự RESPONSE,
 *   không kiểm soát được thứ tự server GHI. Vì vậy mỗi bài chỉ có tối đa 1 request đang bay
 *   (LatestIntentQueue ở tầng data access); các lần bấm trong lúc chờ chỉ ghi đè "ý định mới nhất".
 *   5 lần bấm nhanh → 2 request, và server luôn kết thúc ở ý định cuối cùng.
 * UI vẫn đổi ngay ở MỌI lần bấm (optimistic), nên người dùng không thấy độ trễ này.
 *
 * onEvent cho phép lesson hiển thị "event log" theo thời gian.
 */
import { useCallback } from 'react';
import { removeReaction, setReaction } from '../../shared/api/feed-api';
import { LatestIntentQueue } from '../../shared/api/latest-intent-queue';
import { publishReactionConfirmed } from '../../shared/sync/cross-tab-reaction-sync';
import type { ReactionResponse, ReactionType } from '../../shared/types/feed-entities';
import { toErrorMessage } from '../../shared/utils/to-error-message';
import { useFeedDispatch } from '../03-normalized-store/feed-store-context';
import type { ReactionAction } from './reaction-reducer-with-rollback';

interface ReactionIntent {
  reaction: ReactionType | null;
  requestSeq: number;
}

// 📖 Bài học lesson-05 §2 – số thứ tự toàn cục và hàng đợi theo bài (docs/lessons/lesson-05.md)
// #region learn:request-seq-and-queue
/** Số thứ tự tăng dần toàn cục – reducer dùng để biết thao tác nào là "mới nhất". */
let requestSeqCounter = 0;
/** Dùng chung mọi component: mỗi bài một hàng đợi. */
const reactionQueue = new LatestIntentQueue<ReactionIntent>();
// #endregion learn:request-seq-and-queue

export type ReactionEvent =
  | { kind: 'optimistic'; postId: string; requestSeq: number; reaction: ReactionType | null }
  | { kind: 'queued'; postId: string; requestSeq: number; reaction: ReactionType | null }
  | { kind: 'confirmed'; postId: string; requestSeq: number; reaction: ReactionType | null; total: number }
  | { kind: 'rolledBack'; postId: string; requestSeq: number; message: string };

export function useToggleReaction(onEvent?: (event: ReactionEvent) => void) {
  const dispatch = useFeedDispatch<ReactionAction>();

  // 📖 Bài học lesson-05 §1 – gọi API rồi confirmed hoặc rolledBack (docs/lessons/lesson-05.md)
  // #region learn:send-intent-confirm-rollback
  const sendIntent = useCallback(
    async (postId: string, { reaction, requestSeq }: ReactionIntent) => {
      let response: ReactionResponse;
      try {
        response = reaction ? await setReaction(postId, reaction) : await removeReaction(postId);
      } catch (error) {
        dispatch({ type: 'reactionRolledBack', postId, requestSeq });
        onEvent?.({ kind: 'rolledBack', postId, requestSeq, message: toErrorMessage(error) });
        return;
      }
      dispatch({ type: 'reactionConfirmed', postId, requestSeq, response });
      publishReactionConfirmed(response); // báo các tab khác (no-op nếu lesson không bật đồng bộ)
      onEvent?.({ kind: 'confirmed', postId, requestSeq, reaction: response.viewerReaction, total: response.engagementSummary.totalReactions });
    },
    [dispatch, onEvent],
  );
  // #endregion learn:send-intent-confirm-rollback

  // 📖 Bài học lesson-05 §2 – optimistic ngay, request đi qua hàng đợi (docs/lessons/lesson-05.md)
  // #region learn:toggle-submit-intent
  return useCallback(
    async (postId: string, reaction: ReactionType | null) => {
      requestSeqCounter += 1;
      const intent: ReactionIntent = { reaction, requestSeq: requestSeqCounter };
      dispatch({ type: 'reactionOptimisticApplied', postId, ...intent });
      onEvent?.({ kind: 'optimistic', postId, ...intent });
      const started = await reactionQueue.submit(postId, intent, (next) => sendIntent(postId, next));
      if (!started) onEvent?.({ kind: 'queued', postId, ...intent });
    },
    [dispatch, onEvent, sendIntent],
  );
  // #endregion learn:toggle-submit-intent
}
