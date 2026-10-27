/**
 * Điền engagementSummary + viewerReaction THEO NGƯỜI XEM cho nhiều bài cùng lúc (1 query).
 * Đây là lý do response feed là "personalized" → phải đặt Cache-Control: private.
 */
import type { Post } from '../../../shared-contracts/feed-api-contracts.js';
import type { QueryExecutor } from '../data/database-pool.js';
import type { FeedRepository } from '../data/feed-repository.js';

// 📖 Bài học lesson-05 – điền số liệu reaction theo người xem nên response phải private (docs/lessons/lesson-05.md)
// #region learn:personalize-posts
export async function personalizePosts(repository: FeedRepository, posts: readonly Post[], viewerId: string, executor?: QueryExecutor): Promise<Post[]> {
  const stats = await repository.getReactionStats(
    posts.map((post) => post.id),
    viewerId,
    executor,
  );
  return posts.map((post) => {
    const postStats = stats.get(post.id)!;
    return {
      ...post,
      engagementSummary: { ...post.engagementSummary, reactionCounts: postStats.counts, totalReactions: postStats.total, sampleReactorIds: postStats.sampleReactorIds },
      viewerReaction: postStats.viewerReaction,
    };
  });
}
// #endregion learn:personalize-posts
