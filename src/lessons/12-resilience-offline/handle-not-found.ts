/**
 * XỬ LÝ 404 THEO TỪNG ENDPOINT – cùng một mã 404 nhưng ý nghĩa (và cách UI phản ứng) khác nhau:
 *
 *   PUT/DELETE /api/posts/:id/reaction → 404 nghĩa là "bài đã bị xoá khi bạn đang xem".
 *        UI: gỡ bài khỏi feed (postRemoved) + toast "Bài viết không còn tồn tại". Không retry (vô ích).
 *   GET /api/posts/:id (trang chi tiết) → 404 là một TRẠNG THÁI hợp lệ của trang: hiện "bài đã bị xoá".
 *   GET /api/feed → 404 KHÔNG có nghĩa nghiệp vụ nào (feed luôn tồn tại): đó là lỗi thường (sai route, deploy lỗi…),
 *        đi theo đường lỗi chung (FeedErrorAlert + nút Thử lại).
 *
 * Gom quyết định này vào một chỗ để không rải `if (status === 404)` khắp component.
 */
import { fetchPost } from '../../shared/api/feed-api';
import { ApiError } from '../../shared/api/http-client';
import type { SinglePostResponse } from '../../shared/types/feed-entities';
import { toErrorMessage } from '../../shared/utils/to-error-message';

// 📖 Bài học lesson-12 §2 – 404 mang nghĩa khác nhau theo từng endpoint (docs/lessons/lesson-12.md)
// #region learn:not-found-by-endpoint
export const POST_GONE_MESSAGE = 'Bài viết không còn tồn tại';

export type PostDetailState =
  | { kind: 'ok'; data: SinglePostResponse }
  | { kind: 'gone' }
  | { kind: 'error'; message: string };

export const isNotFoundError = (error: unknown): error is ApiError => error instanceof ApiError && error.status === 404;

/** GET chi tiết bài: 404 → "gone" (trạng thái bình thường), lỗi khác → "error". */
export async function loadPostDetail(postId: string, fetcher: (postId: string) => Promise<SinglePostResponse> = fetchPost): Promise<PostDetailState> {
  try {
    return { kind: 'ok', data: await fetcher(postId) };
  } catch (error) {
    if (isNotFoundError(error)) return { kind: 'gone' };
    return { kind: 'error', message: toErrorMessage(error) };
  }
}
// #endregion learn:not-found-by-endpoint
