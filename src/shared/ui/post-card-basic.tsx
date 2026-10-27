/**
 * Card bài viết ĐƠN GIẢN cho lesson 01–03 (chưa tối ưu gì).
 * Lesson 07 sẽ thay bằng feed-post-article.tsx với ảnh responsive, a11y, entity rendering...
 */
import type { ReactNode } from 'react';
import type { Media, Post, User } from '../types/feed-entities';

export interface PostCardBasicProps {
  post: Post;
  author: User | undefined;
  media: Media[];
  highlight?: boolean;
  /** Thay footer mặc định (lesson 05 gắn thanh reaction vào đây). */
  footer?: ReactNode;
}

export function UserAvatar({ user, size = 40 }: { user: User | undefined; size?: number }) {
  return (
    <span className="avatar" aria-hidden="true" style={{ background: user?.avatarColor ?? '#999', width: size, height: size, fontSize: size * 0.42 }}>
      {user?.name.split(' ').pop()?.[0] ?? '?'}
    </span>
  );
}

export function PostCardBasic({ post, author, media, highlight, footer }: PostCardBasicProps) {
  return (
    <article className={highlight ? 'post-card post-card--highlight' : 'post-card'} data-post-id={post.id}>
      <header className="post-card__header">
        <UserAvatar user={author} />
        <div>
          <strong>{author?.name ?? 'Người dùng không xác định'}</strong>
          <div className="muted">
            <time dateTime={post.createdAt}>{new Date(post.createdAt).toLocaleString('vi-VN')}</time> · <code>{post.id}</code>
          </div>
        </div>
      </header>
      {/* Chỉ render text thuần – React tự escape, an toàn. Lesson 07 mới render mention/hashtag. */}
      <p className="post-card__text">{post.body.text}</p>
      {media.length > 0 && (
        <div className="post-card__media-basic">
          {media.map((item) => (
            <img key={item.id} src={`${item.src}?w=320`} alt={item.alt} />
          ))}
        </div>
      )}
      {footer ?? (
        <footer className="muted">
          {post.engagementSummary.totalReactions} cảm xúc · {post.engagementSummary.commentCount} bình luận
        </footer>
      )}
    </article>
  );
}
