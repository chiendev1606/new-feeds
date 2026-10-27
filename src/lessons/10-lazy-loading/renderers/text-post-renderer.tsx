/** Renderer bài chỉ có chữ – nhẹ nhất. Bài rất ngắn được hiển thị cỡ chữ lớn hơn (kiểu "status"). */
import { PostBodyText } from '../../../shared/post-rendering/render-post-body-with-entities';
import type { PostRendererProps } from '../post-renderer-registry';

const SHORT_TEXT_LENGTH = 80;

export default function TextPostRenderer({ post, usersById }: PostRendererProps) {
  const isShort = post.body.text.length <= SHORT_TEXT_LENGTH;
  return (
    <p className={isShort ? 'post-text post-text--status' : 'post-text'} data-post-kind="text">
      <PostBodyText body={post.body} usersById={usersById} />
    </p>
  );
}
