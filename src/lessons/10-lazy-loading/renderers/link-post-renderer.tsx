/** Renderer bài có link: chữ + thẻ xem trước link đầu tiên. Chunk riêng, chỉ tải khi có bài loại này. */
import { PostBodyText, toSafeHref } from '../../../shared/post-rendering/render-post-body-with-entities';
import type { PostRendererProps } from '../post-renderer-registry';

export default function LinkPostRenderer({ post, usersById }: PostRendererProps) {
  const firstLink = post.body.entities.find((entity) => entity.type === 'link');
  const href = firstLink ? toSafeHref(firstLink.url) : null;
  return (
    <div data-post-kind="link">
      <p className="post-text">
        <PostBodyText body={post.body} usersById={usersById} />
      </p>
      {href && (
        <a className="link-preview-card" href={href} target="_blank" rel="noopener noreferrer">
          <span aria-hidden="true">🔗</span> {new URL(href).hostname}
        </a>
      )}
    </div>
  );
}
