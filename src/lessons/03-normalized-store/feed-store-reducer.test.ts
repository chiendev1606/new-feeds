import { describe, expect, it } from 'vitest';
import type { NormalizedFeedResponse, Post, User } from '../../shared/types/feed-entities';
import { createEmptyEngagementSummary } from '../../shared/types/feed-entities';
import { feedStoreReducer, INITIAL_FEED_STATE, mergeUniqueIds } from './feed-store-reducer';

const user = (id: string, name = id): User => ({ id, name, handle: id, avatarColor: '#000', isVerified: false });
const post = (id: string, authorId = 'u1'): Post => ({
  id,
  authorId,
  body: { text: id, entities: [] },
  mediaIds: [],
  engagementSummary: createEmptyEngagementSummary(),
  viewerReaction: null,
  createdAt: '2026-01-01T00:00:00.000Z',
});

function page(ids: string[], extra: Partial<NormalizedFeedResponse['feed']> = {}): NormalizedFeedResponse {
  return {
    feed: { postIds: ids, olderCursor: `older-${ids.at(-1)}`, newerCursor: `newer-${ids[0]}`, hasOlder: true, hasNewer: false, generation: 1, ...extra },
    posts: Object.fromEntries(ids.map((id) => [id, post(id)])),
    users: { u1: user('u1') },
    media: {},
  };
}

describe('feedStoreReducer', () => {
  it('initial: lưu entity theo id, list chỉ chứa id', () => {
    const state = feedStoreReducer(INITIAL_FEED_STATE, { type: 'feedPageReceived', direction: 'initial', response: page(['p1', 'p2']), receivedAt: 1 });
    expect(state.feed.postIds).toEqual(['p1', 'p2']);
    expect(state.postsById.p1?.authorId).toBe('u1');
    expect(state.usersById.u1).toBeDefined();
    expect(state.feed.olderCursor).toBe('older-p2');
  });

  it('older: nối vào cuối, khử trùng, cập nhật olderCursor', () => {
    let state = feedStoreReducer(INITIAL_FEED_STATE, { type: 'feedPageReceived', direction: 'initial', response: page(['p1', 'p2']), receivedAt: 1 });
    state = feedStoreReducer(state, { type: 'feedPageReceived', direction: 'older', response: page(['p2', 'p3']), receivedAt: 2 });
    expect(state.feed.postIds).toEqual(['p1', 'p2', 'p3']);
    expect(state.feed.olderCursor).toBe('older-p3');
    expect(state.feed.newerCursor).toBe('newer-p1');
  });

  it('newer: chèn lên đầu, dời newerCursor', () => {
    let state = feedStoreReducer(INITIAL_FEED_STATE, { type: 'feedPageReceived', direction: 'initial', response: page(['p1']), receivedAt: 1 });
    state = feedStoreReducer(state, { type: 'feedPageReceived', direction: 'newer', response: page(['n1', 'n2'], { generation: 3 }), receivedAt: 2 });
    expect(state.feed.postIds).toEqual(['n1', 'n2', 'p1']);
    expect(state.feed.newerCursor).toBe('newer-n1');
    expect(state.feed.generation).toBe(3);
  });

  it('newer rỗng: giữ nguyên newerCursor cũ', () => {
    let state = feedStoreReducer(INITIAL_FEED_STATE, { type: 'feedPageReceived', direction: 'initial', response: page(['p1']), receivedAt: 1 });
    state = feedStoreReducer(state, { type: 'feedPageReceived', direction: 'newer', response: page([]), receivedAt: 2 });
    expect(state.feed.newerCursor).toBe('newer-p1');
  });

  it('entitiesMerged: đổi tên user ở 1 chỗ', () => {
    let state = feedStoreReducer(INITIAL_FEED_STATE, { type: 'feedPageReceived', direction: 'initial', response: page(['p1', 'p2']), receivedAt: 1 });
    state = feedStoreReducer(state, { type: 'entitiesMerged', entities: { users: { u1: user('u1', 'Tên mới') } } });
    expect(state.usersById.u1?.name).toBe('Tên mới');
  });

  it('postReplaced: id tạm → id thật, giữ vị trí', () => {
    let state = feedStoreReducer(INITIAL_FEED_STATE, { type: 'feedPageReceived', direction: 'initial', response: page(['p1']), receivedAt: 1 });
    state = feedStoreReducer(state, { type: 'postPrepended', post: post('temp-1') });
    state = feedStoreReducer(state, { type: 'postReplaced', previousId: 'temp-1', post: post('real-1') });
    expect(state.feed.postIds).toEqual(['real-1', 'p1']);
    expect(state.postsById['temp-1']).toBeUndefined();
  });

  it('mergeUniqueIds giữ thứ tự xuất hiện đầu', () => {
    expect(mergeUniqueIds(['a', 'b'], ['b', 'c', 'a'])).toEqual(['a', 'b', 'c']);
  });
});
