/**
 * Truy vấn feed bằng CURSOR + đóng gói response CHUẨN HOÁ.
 *
 * Thứ tự feed: (created_at DESC, id DESC) – luôn ổn định, nên "sau bài X" luôn có nghĩa rõ ràng.
 *   direction=older: lấy các bài CŨ hơn cursor (cuộn xuống – infinite scroll).
 *   direction=newer: lấy các bài MỚI hơn cursor (banner "Có bài mới").
 * SQL tương ứng nằm trong FeedRepository.getPostsOlderThan / getPostsNewerThan.
 */
import type { Media, NormalizedFeedResponse, Post, User } from '../../../shared-contracts/feed-api-contracts.js';
import type { QueryExecutor } from '../data/database-pool.js';
import type { FeedRepository } from '../data/feed-repository.js';
import { personalizePosts } from './engagement-summary-builder.js';
import { decodeCursor, encodeCursor } from './feed-cursor-codec.js';
import { HttpError } from './http-error.js';

export const MAX_PAGE_SIZE = 50;
const DEFAULT_PAGE_SIZE = 10;

export interface FeedQuery {
  viewerId: string;
  count?: number;
  cursor?: string | null;
  direction?: 'older' | 'newer';
}

export function clampPageSize(raw: unknown): number {
  const parsed = Number(raw ?? DEFAULT_PAGE_SIZE);
  if (!Number.isFinite(parsed)) throw new HttpError(400, 'INVALID_COUNT', 'count phải là số');
  return Math.min(MAX_PAGE_SIZE, Math.max(1, Math.floor(parsed)));
}

/**
 * Gom post + users/media được tham chiếu thành các map theo id (mỗi entity xuất hiện đúng 1 lần).
 * Tổng cộng 3 query cho cả trang, bất kể trang có bao nhiêu bài (không N+1).
 * Truyền executor (client của transaction) để đọc được dữ liệu chính transaction đó vừa ghi.
 */
export async function buildNormalizedEntities(repository: FeedRepository, posts: readonly Post[], viewerId: string, executor?: QueryExecutor) {
  const userIds = new Set<string>();
  const mediaIds = new Set<string>();
  for (const post of posts) {
    userIds.add(post.authorId);
    for (const entity of post.body.entities) if (entity.type === 'mention') userIds.add(entity.userId);
    for (const mediaId of post.mediaIds) mediaIds.add(mediaId);
  }
  const queries = [
    () => personalizePosts(repository, posts, viewerId, executor),
    () => repository.getUsersByIds([...userIds], executor),
    () => repository.getMediaByIds([...mediaIds], executor),
  ] as const;
  // Pool: 3 query chạy song song trên 3 kết nối. Transaction: chỉ có 1 kết nối → phải chạy lần lượt.
  const [personalized, users, media] = executor
    ? [await queries[0](), await queries[1](), await queries[2]()]
    : await Promise.all([queries[0](), queries[1](), queries[2]()]);
  return {
    posts: Object.fromEntries(personalized.map((post) => [post.id, post])) as Record<string, Post>,
    users: Object.fromEntries(users.map((user) => [user.id, user])) as Record<string, User>,
    media: Object.fromEntries(media.map((item) => [item.id, item])) as Record<string, Media>,
  };
}

export async function getFeedPage(repository: FeedRepository, query: FeedQuery): Promise<NormalizedFeedResponse> {
  const count = clampPageSize(query.count);
  const direction = query.direction ?? 'older';
  const anchor = query.cursor ? decodeCursor(query.cursor) : null;
  // Đọc generation và trang SONG SONG – hai truy vấn độc lập.
  const [generation, result] = await Promise.all([
    repository.getFeedGeneration(),
    !anchor
      ? repository.getPostsOlderThan(null, count) // trang đầu tiên: bài mới nhất
      : direction === 'older'
        ? repository.getPostsOlderThan(anchor, count)
        : repository.getPostsNewerThan(anchor, count),
  ]);
  const page = result.posts;
  const hasOlder = !anchor || direction === 'older' ? result.hasMore : true;
  const hasNewer = !anchor ? false : direction === 'newer' ? result.hasMore : true;

  const first = page[0];
  const last = page[page.length - 1];
  const fallbackCursor = query.cursor ?? null;

  return {
    feed: {
      postIds: page.map((post) => post.id),
      olderCursor: last ? encodeCursor({ createdAt: last.createdAt, id: last.id, generation }) : fallbackCursor,
      newerCursor: first ? encodeCursor({ createdAt: first.createdAt, id: first.id, generation }) : fallbackCursor,
      hasOlder,
      hasNewer,
      generation,
    },
    ...(await buildNormalizedEntities(repository, page, query.viewerId)),
  };
}
