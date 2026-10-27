/**
 * Bài viết "production-grade" – gom các tối ưu của lesson 07, dùng lại ở lesson 08.
 *
 * A11y theo WAI-ARIA feed pattern:
 *   - Mỗi bài là role="article", aria-labelledby → tên tác giả, aria-describedby → nội dung.
 *   - aria-posinset / aria-setsize: vị trí bài trong feed (setsize = -1 khi chưa biết tổng – infinite scroll).
 *   - tabIndex={-1}: cho phép chuyển focus vào bài bằng code, không thêm tab stop.
 *   - CHƯA làm: phím Page Down/Page Up để nhảy giữa các bài – WAI-ARIA feed pattern yêu cầu, bài viết
 *     coi là "enhancement". Muốn làm: lắng nghe keydown trên role="feed", focus article kế tiếp.
 * Hiệu năng: `memo` chỉ chặn re-render do component cha; nó KHÔNG chặn được re-render do store, vì
 * useFeedState() đọc cả context → mọi article re-render mỗi khi store đổi. Production dùng store có selector (Redux/Zustand/Relay) để chỉ bài thay đổi mới render lại.
 * Cần store có reaction reducer (lesson 05) vì có ReactionPicker.
 */
import { memo, useId } from 'react';
import { useFeedState, usePostView } from '../../lessons/03-normalized-store/feed-store-context';
import { ReactionPicker } from '../../lessons/05-optimistic-reaction/reaction-picker';
import type { ReactionAwareFeedState } from '../../lessons/05-optimistic-reaction/reaction-reducer-with-rollback';
import { useToggleReaction } from '../../lessons/05-optimistic-reaction/use-toggle-reaction';
import { UserAvatar } from '../ui/post-card-basic';
import { ExpandablePostText } from './expandable-post-text';
import { formatCommentCount, formatCompactCount } from './format-compact-count';
import { formatFullDateTime, formatRelativeTime } from './format-relative-time';
import { PostBodyText } from './render-post-body-with-entities';
import { PostMediaGrid } from './responsive-post-image';

export interface FeedPostArticleProps {
  postId: string;
  /** Vị trí 1-based trong feed. */
  posInSet: number;
  /** Tổng số bài; -1 = chưa biết. */
  setSize: number;
  locale: string;
  now: number;
  priority?: boolean;
}

export const FeedPostArticle = memo(function FeedPostArticle({ postId, posInSet, setSize, locale, now, priority }: FeedPostArticleProps) {
  const { post, author, media } = usePostView(postId);
  const state = useFeedState<ReactionAwareFeedState>();
  const toggleReaction = useToggleReaction();
  const headingId = useId();
  const bodyId = useId();
  if (!post) return null;

  return (
    <article className="post-card" role="article" aria-posinset={posInSet} aria-setsize={setSize} aria-labelledby={headingId} aria-describedby={bodyId} tabIndex={-1} data-post-id={postId}>
      <header className="post-card__header">
        <UserAvatar user={author} />
        <div>
          <h3 id={headingId} className="post-card__author">
            {author?.name ?? 'Người dùng'}
            {author?.isVerified && (
              <span className="verified" role="img" aria-label="đã xác minh">
                ✔
              </span>
            )}
          </h3>
          <time className="muted" dateTime={post.createdAt} title={formatFullDateTime(post.createdAt, locale)}>
            {formatRelativeTime(post.createdAt, now, locale)}
          </time>
        </div>
      </header>

      <div id={bodyId}>
        <ExpandablePostText text={post.body.text}>
          <PostBodyText body={post.body} usersById={state.usersById} />
        </ExpandablePostText>
      </div>

      <PostMediaGrid media={media} priority={priority} />

      <footer className="post-card__footer">
        <ReactionPicker
          viewerReaction={post.viewerReaction}
          summary={post.engagementSummary}
          isPending={Boolean(state.pendingReactions[postId])}
          formatCount={(value) => formatCompactCount(value, locale)}
          onReact={(reaction) => void toggleReaction(post.id, reaction)}
        />
        <span className="muted">
          {formatCommentCount(post.engagementSummary.commentCount, locale)} · {formatCompactCount(post.engagementSummary.shareCount, locale)} ↗
        </span>
      </footer>
    </article>
  );
});
