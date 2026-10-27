/**
 * Registry renderer theo LOẠI BÀI – ý tưởng tương tự Relay `@match` / "data-driven dependencies".
 *
 * Server (hoặc client, ở đây) cho biết bài thuộc loại nào; mỗi loại có một renderer là một CHUNK JS riêng.
 * Feed toàn bài chữ thì không bao giờ tải renderer ảnh/link → bundle nhỏ hơn.
 *
 * Tránh waterfall dữ liệu → code: nếu chờ render tới bài ảnh mới bắt đầu tải renderer thì thời gian là
 * (fetch data) + (fetch code). preloadRenderersFor(posts) được gọi NGAY khi trang đầu về store, nên code
 * của mọi loại có trong trang tải song song, thay vì lần lượt theo từng bài.
 */
import type { ComponentType } from 'react';
import { lazyWithPreload, type PreloadableLazyComponent } from '../../shared/lazy/lazy-with-preload';
import type { Media, Post, User } from '../../shared/types/feed-entities';

export type PostKind = 'photo' | 'link' | 'text';

export interface PostRendererProps {
  post: Post;
  media: Media[];
  usersById: Record<string, User>;
  priority?: boolean;
}

// 📖 Bài học lesson-10 §2 – loại bài quyết định renderer, mỗi loại là một chunk riêng (docs/lessons/lesson-10.md)
// #region learn:post-kind-and-renderers
/** photo: có ảnh; link: không ảnh nhưng có link entity; còn lại là text. Ảnh được ưu tiên hơn link. */
export function getPostKind(post: Pick<Post, 'mediaIds' | 'body'>): PostKind {
  if (post.mediaIds.length > 0) return 'photo';
  if (post.body.entities.some((entity) => entity.type === 'link')) return 'link';
  return 'text';
}

export const POST_RENDERERS: Record<PostKind, PreloadableLazyComponent<ComponentType<PostRendererProps>>> = {
  photo: lazyWithPreload(() => import('./renderers/photo-post-renderer')),
  link: lazyWithPreload(() => import('./renderers/link-post-renderer')),
  text: lazyWithPreload(() => import('./renderers/text-post-renderer')),
};
// #endregion learn:post-kind-and-renderers

// 📖 Bài học lesson-10 §2 – tải song song renderer của mọi loại bài ngay khi dữ liệu về (docs/lessons/lesson-10.md)
// #region learn:preload-renderers-for
/** Tải song song renderer của mọi loại bài xuất hiện trong `posts`. Mỗi loại chỉ tải một lần. */
export function preloadRenderersFor(posts: readonly Pick<Post, 'mediaIds' | 'body'>[]): Promise<unknown> {
  const kinds = new Set(posts.map(getPostKind));
  return Promise.allSettled([...kinds].map((kind) => POST_RENDERERS[kind].preload()));
}
// #endregion learn:preload-renderers-for
