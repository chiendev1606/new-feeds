/**
 * PUT /api/posts/:id/reaction  { reaction }  → đặt/đổi reaction (UPSERT)
 * DELETE /api/posts/:id/reaction             → bỏ reaction
 *
 * Cả hai đều IDEMPOTENT theo bản chất (PUT cùng giá trị 2 lần = 1 lần), nên client retry thoải mái.
 * Nhưng 2 request KHÁC nhau gửi song song (Thích rồi bỏ Thích) có thể tới server sai thứ tự →
 * client phải gửi tuần tự theo từng bài (xem use-toggle-reaction.ts, lesson 05).
 * Response trả về engagementSummary mới – client dùng nó làm "sự thật" sau khi đã optimistic update.
 */
import { Router, type Request } from 'express';
import type { ReactionResponse, ReactionType, SetReactionRequest } from '../../../shared-contracts/feed-api-contracts.js';
import { REACTION_TYPES } from '../../../shared-contracts/feed-api-contracts.js';
import type { AppContext } from '../app-context.js';
import { personalizePosts } from '../services/engagement-summary-builder.js';
import { HttpError } from '../services/http-error.js';

export function createReactionRoutes(context: AppContext) {
  const router = Router();
  const { repository } = context;

  // 📖 Bài học lesson-05 – ghi reaction rồi trả số liệu mới kèm confirmedAt làm sự thật (docs/lessons/lesson-05.md)
  // #region learn:reaction-write-confirmed-at
  /** Tìm bài (404 nếu không có) → ghi → trả về số liệu mới theo người xem. */
  const writeReaction = async (req: Request<{ postId: string }>, write: (postId: string) => Promise<void>): Promise<ReactionResponse> => {
    const post = await repository.getPostById(req.params.postId);
    if (!post) throw new HttpError(404, 'POST_NOT_FOUND', 'Không tìm thấy bài viết');
    await write(post.id);
    const [updated] = await personalizePosts(repository, [post], req.viewerId);
    return { postId: post.id, engagementSummary: updated!.engagementSummary, viewerReaction: updated!.viewerReaction, confirmedAt: new Date().toISOString() };
  };
  // #endregion learn:reaction-write-confirmed-at

  // 📖 Bài học lesson-05 – PUT reaction: validate rồi UPSERT (docs/lessons/lesson-05.md)
  // #region learn:reaction-put-route
  router.put('/posts/:postId/reaction', async (req, res) => {
    const { reaction } = (req.body ?? {}) as Partial<SetReactionRequest>;
    if (!REACTION_TYPES.includes(reaction as ReactionType)) {
      throw new HttpError(400, 'INVALID_REACTION', `reaction phải là một trong: ${REACTION_TYPES.join(', ')}`);
    }
    res.json(await writeReaction(req, (postId) => repository.setReaction(postId, req.viewerId, reaction as ReactionType)));
  });
  // #endregion learn:reaction-put-route

  router.delete('/posts/:postId/reaction', async (req, res) => {
    res.json(await writeReaction(req, (postId) => repository.removeReaction(postId, req.viewerId)));
  });

  return router;
}
