/**
 * Bài viết "production-grade" – gom các tối ưu của lesson 07, dùng lại ở lesson 08.
 *
 * A11y theo WAI-ARIA feed pattern:
 *   - Mỗi bài là role="article", aria-labelledby → tên tác giả, aria-describedby → nội dung.
 *   - aria-posinset / aria-setsize: vị trí bài trong feed (setsize = -1 khi chưa biết tổng – infinite scroll).
 *   - tabIndex={-1}: cho phép chuyển focus vào bài bằng code, không thêm tab stop CỦA CHÍNH bài.
 *   - Có ĐÚNG MỘT tab stop mỗi bài ở tên tác giả (<button> của AuthorName): bàn phím phải tới được nó để mở hover card
 *     (focus = mở card). Đây là đánh đổi có chủ ý: người dùng bàn phím mất thêm một lần Tab mỗi bài, đổi lại không bị
 *     bỏ rơi khỏi tính năng mà người dùng chuột có. Nó cũng là thay đổi hành vi bàn phím so với lesson 07/08 trước khi có card.
 *   - CHƯA làm: phím Page Down/Page Up để nhảy giữa các bài – WAI-ARIA feed pattern yêu cầu, bài viết
 *     coi là "enhancement". Muốn làm: lắng nghe keydown trên role="feed", focus article kế tiếp.
 * Hiệu năng: `memo` chỉ chặn re-render do component cha; nó KHÔNG chặn được re-render do store, vì
 * useFeedState() đọc cả context → mọi article re-render mỗi khi store đổi. Production dùng store có selector (Redux/Zustand/Relay) để chỉ bài thay đổi mới render lại.
 * Cần store có reaction reducer (lesson 05) vì có ReactionPicker.
 */
import { memo, useId } from 'react';
import { useFeedState, usePostView } from '../../lessons/03-normalized-store/feed-store-context';
import { AuthorName } from '../../lessons/10-lazy-loading/author-name-with-hover-card';
import { ReactionPicker } from '../../lessons/05-optimistic-reaction/reaction-picker';
import type { ReactionAwareFeedState } from '../../lessons/05-optimistic-reaction/reaction-reducer-with-rollback';
import { useToggleReaction } from '../../lessons/05-optimistic-reaction/use-toggle-reaction';
import { UserAvatar } from '../ui/post-card-basic';
import { ExpandablePostText } from './expandable-post-text';
import { formatCommentCount, formatCompactCount } from './format-compact-count';
import { formatFullDateTime, formatRelativeTime } from './format-relative-time';
import { formatReactorList } from './format-reactor-list';
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

// 📖 Bài học lesson-07 – role article, aria-posinset, aria-setsize theo WAI-ARIA feed pattern và tên người react lấy từ store (docs/lessons/lesson-07.md)
// #region learn:feed-post-article
export const FeedPostArticle = memo(function FeedPostArticle({ postId, posInSet, setSize, locale, now, priority }: FeedPostArticleProps) {
  const { post, author, media } = usePostView(postId);
  const state = useFeedState<ReactionAwareFeedState>();
  const toggleReaction = useToggleReaction();
  const headingId = useId();
  const bodyId = useId();
  if (!post) return null;

  // Tên người react: chỉ lấy người ĐÃ có trong store (response PUT reaction không kèm users → có thể thiếu; hiện raw id là
  // lộ chi tiết nội bộ). Người thiếu tên tự rơi vào "N người khác". `totalOthers` không tính chính viewer vì server
  // không đưa viewer vào danh sách mẫu.
  const reactorNames = (post.engagementSummary.sampleReactorIds ?? []).flatMap((id) => {
    const name = state.usersById[id]?.name;
    return name ? [name] : [];
  });
  const totalOtherReactors = post.engagementSummary.totalReactions - (post.viewerReaction ? 1 : 0);

  return (
    <article className="post-card" role="article" aria-posinset={posInSet} aria-setsize={setSize} aria-labelledby={headingId} aria-describedby={bodyId} tabIndex={-1} data-post-id={postId}>
      {/* #endregion learn:feed-post-article */}
      <header className="post-card__header">
        <UserAvatar user={author} />
        <div>
          <h3 id={headingId} className="post-card__author">
            <AuthorName author={author} />
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
        {reactorNames.length > 0 && <span className="muted post-card__reactors">{formatReactorList(reactorNames, totalOtherReactors, locale)}</span>}
      </footer>
    </article>
  );
});
