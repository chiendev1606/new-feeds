/** Integration test: HTTP thật vào app chạy trên cổng ngẫu nhiên, dữ liệu thật trong PostgreSQL (newsfeed_test). */
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { CreatePostResponse, NormalizedFeedResponse, ReactionResponse } from '../../../shared-contracts/feed-api-contracts.js';
import type { AppContext } from '../app-context.js';
import { createAppContext } from '../app-context.js';
import { createApp } from '../create-express-app.js';
import { useSeededTestDatabase } from '../test-support/test-database.js';

const db = useSeededTestDatabase();
let context: AppContext;
let server: Server;
let baseUrl: string;

beforeAll(async () => {
  context = createAppContext(db.db, { latencyMs: 0, failRate: 0 });
  server = createApp({ context, logRequests: false }).app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(() => {
  server.close();
});

beforeEach(() => {
  context.simulation = { latencyMs: 0, failRate: 0, autoNewPostsEverySec: 0 };
});

const jsonRequest = (method: string, body: unknown, headers: Record<string, string> = {}) => ({
  method,
  headers: { 'content-type': 'application/json', ...headers },
  body: JSON.stringify(body),
});
const createPost = (body: unknown, key = 'key-1', headers: Record<string, string> = {}) =>
  fetch(`${baseUrl}/api/posts`, jsonRequest('POST', body, { 'Idempotency-Key': key, ...headers }));

describe('GET /api/feed', () => {
  it('trả payload chuẩn hoá + Cache-Control private', async () => {
    const response = await fetch(`${baseUrl}/api/feed?count=3`);
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toContain('private');
    const body = (await response.json()) as NormalizedFeedResponse;
    expect(body.feed.postIds).toHaveLength(3);
    expect(body.feed.olderCursor).toBeTruthy();
  });

  it('cursor hỏng → 400 INVALID_CURSOR', async () => {
    const response = await fetch(`${baseUrl}/api/feed?cursor=rac`);
    expect(response.status).toBe(400);
    expect(((await response.json()) as { error: { code: string } }).error.code).toBe('INVALID_CURSOR');
  });

  it('failRate=1 → 503 kèm Retry-After', async () => {
    context.simulation.failRate = 1;
    const response = await fetch(`${baseUrl}/api/feed`);
    expect(response.status).toBe(503);
    expect(response.headers.get('retry-after')).toBe('1');
  });
});

describe('reaction', () => {
  it('PUT đổi reaction rồi DELETE: count đúng, viewerReaction đúng, lưu bền trong DB', async () => {
    const feed = (await (await fetch(`${baseUrl}/api/feed?count=1`)).json()) as NormalizedFeedResponse;
    const postId = feed.feed.postIds[0]!;
    const before = feed.posts[postId]!;
    const hadReaction = before.viewerReaction !== null;

    const put = (await (await fetch(`${baseUrl}/api/posts/${postId}/reaction`, jsonRequest('PUT', { reaction: 'love' }))).json()) as ReactionResponse;
    expect(put.viewerReaction).toBe('love');
    expect(put.engagementSummary.totalReactions).toBe(before.engagementSummary.totalReactions + (hadReaction ? 0 : 1));

    // PUT lần 2 cùng giá trị: idempotent, count không đổi.
    const putAgain = (await (await fetch(`${baseUrl}/api/posts/${postId}/reaction`, jsonRequest('PUT', { reaction: 'love' }))).json()) as ReactionResponse;
    expect(putAgain.engagementSummary.totalReactions).toBe(put.engagementSummary.totalReactions);

    const stored = (await db.repository.getReactionStats([postId], 'user-1')).get(postId);
    expect(stored?.viewerReaction).toBe('love');

    const removed = (await (await fetch(`${baseUrl}/api/posts/${postId}/reaction`, { method: 'DELETE' })).json()) as ReactionResponse;
    expect(removed.viewerReaction).toBeNull();
    expect(removed.engagementSummary.totalReactions).toBe(put.engagementSummary.totalReactions - 1);
  });

  it('reaction không hợp lệ → 400, bài không tồn tại → 404', async () => {
    expect((await fetch(`${baseUrl}/api/posts/post-0300/reaction`, jsonRequest('PUT', { reaction: 'hate' }))).status).toBe(400);
    expect((await fetch(`${baseUrl}/api/posts/khong-co/reaction`, jsonRequest('PUT', { reaction: 'like' }))).status).toBe(404);
  });
});

describe('POST /api/posts + idempotency', () => {
  const textBody = (text: string) => ({ body: { text, entities: [] }, mediaIds: [] });

  it('thiếu Idempotency-Key → 400', async () => {
    const response = await fetch(`${baseUrl}/api/posts`, jsonRequest('POST', textBody('hi')));
    expect(response.status).toBe(400);
  });

  it('gửi 2 lần cùng key → chỉ tạo 1 bài, lần 2 có header Idempotent-Replayed', async () => {
    const sizeBefore = await db.repository.countPosts();
    const first = await createPost(textBody('Bài test idempotency'), 'key-123');
    const second = await createPost(textBody('Bài test idempotency'), 'key-123');
    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(second.headers.get('idempotent-replayed')).toBe('true');
    const [a, b] = (await Promise.all([first.json(), second.json()])) as CreatePostResponse[];
    expect(a!.post.id).toBe(b!.post.id);
    expect(await db.repository.countPosts()).toBe(sizeBefore + 1);
  });

  it('2 request cùng key gửi SONG SONG → vẫn chỉ 1 bài (khoá chính chặn request thua)', async () => {
    const sizeBefore = await db.repository.countPosts();
    const responses = await Promise.all([createPost(textBody('Song song'), 'key-race'), createPost(textBody('Song song'), 'key-race')]);
    const bodies = (await Promise.all(responses.map((response) => response.json()))) as CreatePostResponse[];
    expect(responses.map((response) => response.status)).toEqual([201, 201]);
    expect(bodies[0]!.post.id).toBe(bodies[1]!.post.id);
    expect(await db.repository.countPosts()).toBe(sizeBefore + 1);
  });

  it('cùng key nhưng khác nội dung → 422', async () => {
    await createPost(textBody('Nội dung A'), 'key-reuse');
    const response = await createPost(textBody('Nội dung B'), 'key-reuse');
    expect(response.status).toBe(422);
  });

  it('upload ảnh rồi tạo bài với mediaIds; ảnh trả về có nosniff', async () => {
    const upload = await fetch(`${baseUrl}/api/media/uploads`, {
      method: 'POST',
      headers: { 'content-type': 'image/png', 'X-Image-Width': '640', 'X-Image-Height': '480' },
      body: new Uint8Array([137, 80, 78, 71]),
    });
    expect(upload.status).toBe(201);
    const { mediaId } = (await upload.json()) as { mediaId: string };

    const created = await createPost({ body: { text: '', entities: [] }, mediaIds: [mediaId] }, 'key-with-media');
    expect(created.status).toBe(201);
    expect(((await created.json()) as CreatePostResponse).media[mediaId]?.width).toBe(640);

    const served = await fetch(`${baseUrl}/media/${mediaId}`);
    expect(served.headers.get('x-content-type-options')).toBe('nosniff');
  });

  it('không gắn được media chưa upload hoặc của người khác → 400', async () => {
    expect((await createPost({ body: { text: 'x', entities: [] }, mediaIds: ['khong-ton-tai'] }, 'k1')).status).toBe(400);
    // Ảnh seed không do user-1 upload.
    expect((await createPost({ body: { text: 'x', entities: [] }, mediaIds: ['post-0299-m1'] }, 'k2')).status).toBe(400);
  });

  it('entity sai kiểu → 400 (không lưu, không 500)', async () => {
    const cases = [[null], [{ type: 'bogus', start: 0, end: 1 }], [{ type: 'hashtag', start: 0, end: 1, tag: ['x'] }], [{ type: 'link', start: 0, end: 1, url: 'javascript:alert(1)' }]];
    for (const [index, entities] of cases.entries()) {
      const response = await createPost({ body: { text: 'abcdef', entities }, mediaIds: [] }, `k-entity-${index}`);
      expect(response.status).toBe(400);
    }
  });

  it('header X-Image-Alt hỏng → 400 thay vì 500', async () => {
    const response = await fetch(`${baseUrl}/api/media/uploads`, {
      method: 'POST',
      headers: { 'content-type': 'image/png', 'X-Image-Alt': '%E0%A4%A' },
      body: new Uint8Array([1]),
    });
    expect(response.status).toBe(400);
  });
});

describe('session', () => {
  it('sid không ứng với user có thật → bị thay bằng session mặc định', async () => {
    const response = await createPost({ body: { text: 'Ma', entities: [] }, mediaIds: [] }, 'k-ghost', { cookie: 'sid=ghost' });
    expect(response.status).toBe(201);
    expect(((await response.json()) as CreatePostResponse).post.authorId).toBe('user-1');
  });
});
