import { describe, expect, it } from 'vitest';
import { SEED_POST_COUNT } from '../data/seed-data-generator.js';
import type { FeedRepository } from '../data/feed-repository.js';
import { useSeededTestDatabase } from '../test-support/test-database.js';
import { getFeedPage } from './feed-query-service.js';
import { getFeedPageByOffset } from './offset-feed-query-service.js';

const viewerId = 'user-1';
const db = useSeededTestDatabase();

async function collectAllOlderPages(repository: FeedRepository, pageSize: number, beforeEachPage?: (pageIndex: number) => Promise<void>) {
  const seen: string[] = [];
  let cursor: string | null = null;
  for (let pageIndex = 0; pageIndex < 1000; pageIndex += 1) {
    await beforeEachPage?.(pageIndex);
    const page = await getFeedPage(repository, { viewerId, count: pageSize, cursor, direction: 'older' });
    seen.push(...page.feed.postIds);
    if (!page.feed.hasOlder) break;
    cursor = page.feed.olderCursor;
  }
  return seen;
}

describe('getFeedPage (cursor, PostgreSQL)', () => {
  it('lật hết các trang: đủ số bài, không trùng', async () => {
    const ids = await collectAllOlderPages(db.repository, 25);
    expect(ids).toHaveLength(SEED_POST_COUNT);
    expect(new Set(ids).size).toBe(SEED_POST_COUNT);
  });

  it('có bài mới chèn lên đầu giữa các lần tải → vẫn không trùng, không sót bài cũ', async () => {
    const ids = await collectAllOlderPages(db.repository, 20, async (pageIndex) => {
      if (pageIndex > 0) await db.repository.insertRandomNewPosts(3);
    });
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toHaveLength(SEED_POST_COUNT);
  });

  it('direction=newer trả về đúng các bài mới hơn trang đầu', async () => {
    const first = await getFeedPage(db.repository, { viewerId, count: 5 });
    const { posts: inserted } = await db.repository.insertRandomNewPosts(2);
    const newer = await getFeedPage(db.repository, { viewerId, count: 10, cursor: first.feed.newerCursor, direction: 'newer' });
    expect(new Set(newer.feed.postIds)).toEqual(new Set(inserted.map((post) => post.id)));
    expect(newer.feed.generation).toBeGreaterThan(first.feed.generation);
  });

  it('direction=newer có nhiều bài hơn count → lấy các bài gần cursor nhất trước, hasNewer=true', async () => {
    const first = await getFeedPage(db.repository, { viewerId, count: 5 });
    await db.repository.insertRandomNewPosts(5);
    const newer = await getFeedPage(db.repository, { viewerId, count: 3, cursor: first.feed.newerCursor, direction: 'newer' });
    expect(newer.feed.postIds).toHaveLength(3);
    expect(newer.feed.hasNewer).toBe(true);
    const rest = await getFeedPage(db.repository, { viewerId, count: 3, cursor: newer.feed.newerCursor, direction: 'newer' });
    expect(rest.feed.postIds).toHaveLength(2);
    expect(rest.feed.hasNewer).toBe(false);
  });

  it('response chuẩn hoá: mọi authorId/mediaId đều có trong users/media', async () => {
    const page = await getFeedPage(db.repository, { viewerId, count: 30 });
    for (const postId of page.feed.postIds) {
      const post = page.posts[postId]!;
      expect(page.users[post.authorId]).toBeDefined();
      for (const mediaId of post.mediaIds) expect(page.media[mediaId]).toBeDefined();
    }
  });

  it('count bị giới hạn trong 1..50', async () => {
    expect((await getFeedPage(db.repository, { viewerId, count: 999 })).feed.postIds).toHaveLength(50);
    expect((await getFeedPage(db.repository, { viewerId, count: 0 })).feed.postIds).toHaveLength(1);
  });
});

describe('getFeedPageByOffset (để so sánh)', () => {
  it('có bài mới chèn lên đầu giữa 2 trang → offset trả về bài TRÙNG', async () => {
    const firstPage = await getFeedPageByOffset(db.repository, viewerId, 0, 10);
    await db.repository.insertRandomNewPosts(3);
    const secondPage = await getFeedPageByOffset(db.repository, viewerId, firstPage.nextOffset, 10);
    const duplicated = secondPage.postIds.filter((id) => firstPage.postIds.includes(id));
    expect(duplicated).toHaveLength(3);
  });
});
