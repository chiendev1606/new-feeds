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

// 📖 Bài học lesson-02 – kẹp kích thước trang để chặn client xin quá nhiều (docs/lessons/lesson-02.md)
// #region learn:clamp-page-size
export function clampPageSize(raw: unknown): number {
  const parsed = Number(raw ?? DEFAULT_PAGE_SIZE);
  if (!Number.isFinite(parsed)) throw new HttpError(400, 'INVALID_COUNT', 'count phải là số');
  return Math.min(MAX_PAGE_SIZE, Math.max(1, Math.floor(parsed)));
}
// #endregion learn:clamp-page-size

// 📖 Bài học lesson-03 – gom user/media/post thành map theo id, số query không phụ thuộc số bài (docs/lessons/lesson-03.md)
// #region learn:build-normalized-entities
/**
 * Gom post + users/media được tham chiếu thành các map theo id (mỗi entity xuất hiện đúng 1 lần).
 * Số query không phụ thuộc số bài trong trang (không N+1).
 * Truyền executor (client của transaction) để đọc được dữ liệu chính transaction đó vừa ghi.
 *
 * Độ trễ: với pool, số liệu reaction, users (tác giả + mention) và media là ba việc ĐỘC LẬP nên chạy song song (một vòng DB).
 * Chỉ người react mẫu (sampleReactorIds) phải chờ số liệu reaction mới biết → truy vấn bổ sung, và CHỈ những người chưa có.
 * Trong transaction chỉ có 1 kết nối → mọi truy vấn chạy lần lượt.
 */
export async function buildNormalizedEntities(repository: FeedRepository, posts: readonly Post[], viewerId: string, executor?: QueryExecutor) {
  const userIds = new Set<string>();
  const mediaIds = new Set<string>();
  for (const post of posts) {
    userIds.add(post.authorId);
    for (const entity of post.body.entities) if (entity.type === 'mention') userIds.add(entity.userId);
    for (const mediaId of post.mediaIds) mediaIds.add(mediaId);
  }
  const loadStats = () => personalizePosts(repository, posts, viewerId, executor);
  const loadUsers = (ids: readonly string[]) => repository.getUsersByIds(ids, executor, viewerId);
  const loadMedia = () => repository.getMediaByIds([...mediaIds], executor);
  const [personalized, baseUsers, media] = executor
    ? [await loadStats(), await loadUsers([...userIds]), await loadMedia()]
    : await Promise.all([loadStats(), loadUsers([...userIds]), loadMedia()]);

  // Người react mẫu còn thiếu (thường chỉ vài người) → một truy vấn nhỏ; không có ai thiếu thì bỏ qua hẳn.
  const missingReactorIds = new Set<string>();
  for (const post of personalized) {
    for (const reactorId of post.engagementSummary.sampleReactorIds ?? []) if (!userIds.has(reactorId)) missingReactorIds.add(reactorId);
  }
  const reactorUsers = missingReactorIds.size > 0 ? await loadUsers([...missingReactorIds]) : [];
  const users = [...baseUsers, ...reactorUsers];
  return {
    posts: Object.fromEntries(personalized.map((post) => [post.id, post])) as Record<string, Post>,
    users: Object.fromEntries(users.map((user) => [user.id, user])) as Record<string, User>,
    media: Object.fromEntries(media.map((item) => [item.id, item])) as Record<string, Media>,
  };
}
// #endregion learn:build-normalized-entities

// 📖 Bài học shared-foundations §2 – cursor, direction, generation và response chuẩn hoá của một trang feed (docs/lessons/shared-foundations.md)
// #region learn:get-feed-page
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
// #endregion learn:get-feed-page
