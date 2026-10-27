/** GET /api/posts/:id và POST /api/posts (bắt buộc Idempotency-Key). */
import { Router } from 'express';
import type { CreatePostRequest, CreatePostResponse, Post, PostBody, TextEntity } from '../../../shared-contracts/feed-api-contracts.js';
import { createEmptyEngagementSummary } from '../../../shared-contracts/feed-api-contracts.js';
import { IDEMPOTENCY_KEY_HEADER, IDEMPOTENT_REPLAYED_HEADER } from '../../../shared-contracts/feed-api-contracts.js';
import type { AppContext } from '../app-context.js';
import { FeedRepository } from '../data/feed-repository.js';
import { buildNormalizedEntities } from '../services/feed-query-service.js';
import { HttpError } from '../services/http-error.js';
import { hashRequestBody, isUniqueViolation } from '../services/idempotency-store.js';

export const MAX_POST_TEXT_LENGTH = 5000;
export const MAX_MEDIA_PER_POST = 10;
const MAX_ENTITIES = 100;
const MAX_ALT_LENGTH = 300;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const invalidEntity = (message: string) => new HttpError(400, 'INVALID_ENTITY', message);

/**
 * Validate một entity và TẠO LẠI object sạch – không bao giờ lưu nguyên object client gửi
 * (tránh field lạ, type lạ lọt vào DB rồi làm hỏng client khác khi render).
 */
function sanitizeEntity(raw: unknown, textLength: number): TextEntity {
  if (!isRecord(raw)) throw invalidEntity('Entity phải là object');
  const { type, start, end } = raw;
  if (!Number.isInteger(start) || !Number.isInteger(end) || (start as number) < 0 || (end as number) <= (start as number) || (end as number) > textLength) {
    throw invalidEntity('Entity range không hợp lệ');
  }
  const range = { start: start as number, end: end as number };
  switch (type) {
    case 'mention':
      if (typeof raw.userId !== 'string') throw invalidEntity('mention cần userId');
      return { type, ...range, userId: raw.userId };
    case 'hashtag':
      if (typeof raw.tag !== 'string' || !raw.tag) throw invalidEntity('hashtag cần tag');
      return { type, ...range, tag: raw.tag };
    case 'link':
      if (typeof raw.url !== 'string' || !/^https?:\/\//i.test(raw.url)) throw invalidEntity('Chỉ cho phép link http/https');
      return { type, ...range, url: raw.url };
    default:
      throw invalidEntity('type phải là mention, hashtag hoặc link');
  }
}

/** Validate ở server – không tin client: kiểu dữ liệu, độ dài, range không chồng lấn, mention tới user có thật. */
async function validatePostBody(raw: unknown, repository: FeedRepository): Promise<PostBody> {
  if (!isRecord(raw) || typeof raw.text !== 'string') throw new HttpError(400, 'INVALID_BODY', 'body.text là bắt buộc');
  const text = raw.text;
  if (text.length > MAX_POST_TEXT_LENGTH) throw new HttpError(400, 'BODY_TOO_LONG', `Tối đa ${MAX_POST_TEXT_LENGTH} ký tự`);
  const rawEntities = raw.entities ?? [];
  if (!Array.isArray(rawEntities) || rawEntities.length > MAX_ENTITIES) throw invalidEntity('entities phải là mảng (tối đa 100)');

  const entities = rawEntities.map((entity) => sanitizeEntity(entity, text.length)).sort((a, b) => a.start - b.start);
  entities.forEach((entity, index) => {
    if (index > 0 && entity.start < entities[index - 1]!.end) throw invalidEntity('Các entity không được chồng lấn');
  });
  const mentionedIds = [...new Set(entities.flatMap((entity) => (entity.type === 'mention' ? [entity.userId] : [])))];
  const found = await repository.getUsersByIds(mentionedIds);
  if (found.length !== mentionedIds.length) throw invalidEntity('Mention tới user không tồn tại');
  return { text, entities };
}

export function createPostRoutes(context: AppContext) {
  const router = Router();
  const { repository } = context;

  router.get('/posts/:postId', async (req, res) => {
    const post = await repository.getPostById(req.params.postId);
    if (!post) throw new HttpError(404, 'POST_NOT_FOUND', 'Không tìm thấy bài viết');
    const { posts, users, media } = await buildNormalizedEntities(repository, [post], req.viewerId);
    res.set('Cache-Control', 'private, no-store').json({ post: posts[post.id], users, media });
  });

  router.post('/posts', async (req, res) => {
    const idempotencyKey = req.header(IDEMPOTENCY_KEY_HEADER);
    if (!idempotencyKey || idempotencyKey.length > 200) throw new HttpError(400, 'IDEMPOTENCY_KEY_REQUIRED', `Thiếu header ${IDEMPOTENCY_KEY_HEADER}`);
    const requestHash = hashRequestBody(req.body);

    const replay = async () => {
      const previous = await repository.findIdempotentResponse(req.viewerId, idempotencyKey);
      if (!previous) return false;
      if (previous.requestHash !== requestHash) {
        throw new HttpError(422, 'IDEMPOTENCY_KEY_REUSED', 'Key này đã được dùng cho một request có nội dung khác');
      }
      // Đã xử lý key này rồi → trả lại đúng kết quả cũ, KHÔNG tạo bài mới.
      res.status(previous.status).set(IDEMPOTENT_REPLAYED_HEADER, 'true').json(previous.response);
      return true;
    };
    if (await replay()) return;

    const request = (req.body ?? {}) as Partial<CreatePostRequest>;
    const body = await validatePostBody(request.body, repository);
    const mediaIds = Array.isArray(request.mediaIds) ? request.mediaIds : [];
    if (mediaIds.length > MAX_MEDIA_PER_POST || mediaIds.some((id) => typeof id !== 'string')) {
      throw new HttpError(400, 'INVALID_MEDIA', `mediaIds phải là mảng chuỗi, tối đa ${MAX_MEDIA_PER_POST}`);
    }
    const notOwned = await repository.findMediaNotOwnedBy(mediaIds, req.viewerId);
    if (notOwned.length > 0) throw new HttpError(400, 'MEDIA_NOT_FOUND', `Media ${notOwned.join(', ')} chưa được bạn upload`);
    if (!body.text.trim() && mediaIds.length === 0) throw new HttpError(400, 'EMPTY_POST', 'Bài viết cần có chữ hoặc ảnh');
    // Chuẩn hoá một lần: chỉ alt của ảnh thuộc bài này, đã trim và giới hạn độ dài.
    const altTexts = Object.entries(isRecord(request.altTexts) ? request.altTexts : {}).flatMap(([mediaId, alt]) =>
      mediaIds.includes(mediaId) && typeof alt === 'string' && alt.trim() ? [[mediaId, alt.trim().slice(0, MAX_ALT_LENGTH)] as const] : [],
    );

    const post: Post = {
      id: FeedRepository.newId('post-user'),
      authorId: req.viewerId,
      body,
      mediaIds,
      engagementSummary: createEmptyEngagementSummary(),
      viewerReaction: null,
      createdAt: new Date().toISOString(),
    };

    try {
      // Tạo bài + lưu key trong CÙNG transaction: hoặc cả hai cùng thành công, hoặc không có gì được ghi.
      const responseBody = await context.db.transaction(async (tx) => {
        await repository.insertPost(tx, post);
        for (const [mediaId, alt] of altTexts) await repository.updateMediaAlt(tx, mediaId, alt);
        // Đọc bằng transaction → thấy được alt vừa cập nhật (chưa commit).
        const { posts, users, media } = await buildNormalizedEntities(repository, [post], req.viewerId, tx);
        const created: CreatePostResponse = { post: posts[post.id]!, users, media };
        await repository.saveIdempotentResponse(tx, req.viewerId, idempotencyKey, { status: 201, requestHash, response: created });
        return created;
      });
      res.status(201).json(responseBody);
    } catch (error) {
      // Hai request cùng key chạy SONG SONG: request thua bị khoá chính chặn → transaction của nó rollback
      // (bài của nó không được tạo) → trả về kết quả của request thắng.
      if (isUniqueViolation(error) && (await replay())) return;
      throw error;
    }
  });

  return router;
}
