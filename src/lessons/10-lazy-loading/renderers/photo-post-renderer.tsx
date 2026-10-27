/** Renderer bài có ảnh: chữ + lưới ảnh responsive. Là chunk riêng – chỉ tải khi feed có bài ảnh. */
import { PostBodyText } from '../../../shared/post-rendering/render-post-body-with-entities';
import { PostMediaGrid } from '../../../shared/post-rendering/responsive-post-image';
import type { PostRendererProps } from '../post-renderer-registry';

export default function PhotoPostRenderer({ post, media, usersById, priority }: PostRendererProps) {
  return (
    <div data-post-kind="photo">
      <p className="post-text">
        <PostBodyText body={post.body} usersById={usersById} />
      </p>
      <PostMediaGrid media={media} priority={priority} />
    </div>
  );
}
