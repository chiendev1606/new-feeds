/**
 * Thẻ bài viết của lesson 10: khung (header + footer) là Tier 1, PHẦN THÂN do renderer tải lười quyết định
 * theo loại bài (getPostKind → POST_RENDERERS). Hover card và reaction menu là Tier 3 nằm trong
 * AuthorName / ReactionPicker.
 *
 * Suspense fallback giữ đúng kích thước: bài ảnh dùng aspect-ratio của ảnh đầu tiên (đã biết từ metadata
 * trong feed response) → renderer tải xong không làm layout nhảy (CLS).
 */
import { Suspense } from 'react';
import { ChunkErrorBoundary } from '../../shared/lazy/chunk-error-boundary';
import { formatCommentCount, formatCompactCount } from '../../shared/post-rendering/format-compact-count';
import { formatFullDateTime, formatRelativeTime } from '../../shared/post-rendering/format-relative-time';
import { UserAvatar } from '../../shared/ui/post-card-basic';
import { useFeedState, usePostView } from '../03-normalized-store/feed-store-context';
import { ReactionPicker } from '../05-optimistic-reaction/reaction-picker';
import type { ReactionAwareFeedState } from '../05-optimistic-reaction/reaction-reducer-with-rollback';
import { useToggleReaction } from '../05-optimistic-reaction/use-toggle-reaction';
import { AuthorName } from './author-name-with-hover-card';
import { getPostKind, POST_RENDERERS } from './post-renderer-registry';
import './lesson-10-lazy-loading.css';

const TEMP_ID_PREFIX = 'temp-';

export function LazyPostCard({ postId, locale, now, priority }: { postId: string; locale: string; now: number; priority?: boolean }) {
  const { post, author, media } = usePostView(postId);
  const state = useFeedState<ReactionAwareFeedState>();
  const toggleReaction = useToggleReaction();
  if (!post) return null;

  // 📖 Bài học lesson-10 §1 – khung giữ chỗ cùng kích thước để không nhảy layout (docs/lessons/lesson-10.md)
  // #region learn:card-fallback-same-size
  const kind = getPostKind(post);
  const Renderer = POST_RENDERERS[kind];
  const firstMedia = media[0];
  const fallbackStyle = kind === 'photo' && firstMedia ? { aspectRatio: `${firstMedia.width} / ${firstMedia.height}`, maxBlockSize: 480 } : { minBlockSize: 72 };
  // #endregion learn:card-fallback-same-size
  const isTemp = postId.startsWith(TEMP_ID_PREFIX);

  return (
    <article className={isTemp ? 'post-card post-card--pending' : 'post-card'} data-post-id={postId} data-post-kind={kind} aria-busy={isTemp}>
      <header className="post-card__header">
        <UserAvatar user={author} />
        <div>
          <h3 className="post-card__author">
            <AuthorName author={author} />
            {author?.isVerified && (
              <span className="verified" role="img" aria-label="đã xác minh">
                ✔
              </span>
            )}
          </h3>
          <time className="muted" dateTime={post.createdAt} title={formatFullDateTime(post.createdAt, locale)}>
            {isTemp ? 'Đang đăng…' : formatRelativeTime(post.createdAt, now, locale)}
          </time>
        </div>
      </header>

      // 📖 Bài học lesson-10 §1 – Suspense và ChunkErrorBoundary bao quanh renderer tải lười (docs/lessons/lesson-10.md)
      // #region learn:card-suspense-boundary
      <ChunkErrorBoundary name={`${kind}-post-renderer`}>
        <Suspense fallback={<div className="lazy-body-fallback" aria-hidden="true" data-testid="renderer-fallback" style={fallbackStyle} />}>
          <Renderer post={post} media={media} usersById={state.usersById} priority={priority} />
        </Suspense>
      </ChunkErrorBoundary>
      // #endregion learn:card-suspense-boundary

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
}
