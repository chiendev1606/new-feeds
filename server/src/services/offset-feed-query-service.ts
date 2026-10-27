/**
 * Phân trang bằng OFFSET – chỉ tồn tại để so sánh trong lesson 02.
 *
 * Vấn đề: offset là "bỏ qua N bài đầu". Nếu giữa 2 lần tải có K bài mới chèn lên đầu,
 * thì K bài cuối của trang trước bị đẩy xuống và xuất hiện LẠI ở trang sau (trùng lặp).
 * Ngược lại nếu có bài bị xoá, sẽ bị SÓT bài. Ngoài ra OFFSET lớn buộc DB đọc rồi bỏ qua N dòng.
 */
import type { OffsetFeedResponse } from '../../../shared-contracts/feed-api-contracts.js';
import type { FeedRepository } from '../data/feed-repository.js';
import { buildNormalizedEntities, clampPageSize } from './feed-query-service.js';
import { HttpError } from './http-error.js';

// 📖 Bài học lesson-02 – endpoint offset để so sánh với cursor (docs/lessons/lesson-02.md)
// #region learn:offset-feed-query
export async function getFeedPageByOffset(repository: FeedRepository, viewerId: string, rawOffset: unknown, rawCount: unknown): Promise<OffsetFeedResponse> {
  const offset = Number(rawOffset ?? 0);
  if (!Number.isInteger(offset) || offset < 0) throw new HttpError(400, 'INVALID_OFFSET', 'offset phải là số nguyên ≥ 0');
  const count = clampPageSize(rawCount);
  const { posts, hasMore } = await repository.getPostsByOffset(offset, count);
  return {
    postIds: posts.map((post) => post.id),
    nextOffset: offset + posts.length,
    hasMore,
    ...(await buildNormalizedEntities(repository, posts, viewerId)),
  };
}
// #endregion learn:offset-feed-query
