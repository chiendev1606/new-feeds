/**
 * Card bài viết của lesson 12: có reaction (optimistic, lesson 05) + kiểm tra "bài đã bị xoá".
 *
 * Không dùng FeedPostArticle vì hook reaction của nó không để lesson lắng nghe sự kiện rollback,
 * mà ta cần biết khi reaction thất bại để kiểm tra xem có phải do bài đã bị xoá (404) hay không.
 * Bài tạm (id 'temp-…') KHÔNG có reaction: server chưa biết bài đó.
 */
import { memo, useState } from 'react';
import type { OutboxItem } from '../../shared/offline/post-outbox';
import { PostCardBasic } from '../../shared/ui/post-card-basic';
import { useFeedState, usePostView } from '../03-normalized-store/feed-store-context';
import { ReactionPicker } from '../05-optimistic-reaction/reaction-picker';
import type { ReactionAwareFeedState } from '../05-optimistic-reaction/reaction-reducer-with-rollback';
import { useToggleReaction, type ReactionEvent } from '../05-optimistic-reaction/use-toggle-reaction';
import { loadPostDetail, type PostDetailState } from './handle-not-found';
import { TEMP_POST_PREFIX } from './use-offline-outbox';

export interface ResilientPostCardProps {
  postId: string;
  /** Mục outbox tương ứng nếu đây là bài tạm đang chờ mạng. */
  outboxItem: OutboxItem | undefined;
  onReactionEvent: (event: ReactionEvent) => void;
}

export const ResilientPostCard = memo(function ResilientPostCard({ postId, outboxItem, onReactionEvent }: ResilientPostCardProps) {
  const { post, author, media } = usePostView(postId);
  const isPending = Boolean(useFeedState<ReactionAwareFeedState>().pendingReactions[postId]);
  const toggleReaction = useToggleReaction(onReactionEvent);
  const [detail, setDetail] = useState<PostDetailState | null>(null);
  if (!post) return null;

  if (postId.startsWith(TEMP_POST_PREFIX)) {
    const rejected = outboxItem?.state === 'rejected';
    return (
      <div className="post-card--pending" aria-busy={!rejected} data-testid="temp-post" data-post-id={postId}>
        <p className="muted">
          {rejected ? '⛔ Server từ chối bài này (xem outbox)' : outboxItem ? '⏳ chờ mạng – đã lưu trong outbox, sẽ tự đăng khi có mạng' : '⏳ đang đăng…'}
        </p>
        <PostCardBasic post={post} author={author} media={media} />
      </div>
    );
  }

  const checkDetail = async () => setDetail(await loadPostDetail(postId));

  return (
    <PostCardBasic
      post={post}
      author={author}
      media={media}
      footer={
        <div className="l12-card-footer">
          <ReactionPicker viewerReaction={post.viewerReaction} summary={post.engagementSummary} isPending={isPending} onReact={(reaction) => void toggleReaction(post.id, reaction)} />
          <button type="button" className="l12-detail-button" onClick={() => void checkDetail()}>
            Kiểm tra chi tiết (GET /api/posts/…)
          </button>
          {detail?.kind === 'gone' && (
            <span role="status" data-testid="post-gone" className="error-text">
              🗑 Bài viết đã bị xoá (404)
            </span>
          )}
          {detail?.kind === 'ok' && <span role="status" className="muted">✅ Bài còn tồn tại</span>}
          {detail?.kind === 'error' && <span role="status" className="error-text">Lỗi: {detail.message}</span>}
        </div>
      }
    />
  );
});
