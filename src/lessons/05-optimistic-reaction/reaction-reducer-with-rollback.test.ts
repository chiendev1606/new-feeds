import { describe, expect, it } from 'vitest';
import type { EngagementSummary, Post, ReactionResponse, ReactionType } from '../../shared/types/feed-entities';
import { INITIAL_FEED_STATE } from '../03-normalized-store/feed-store-reducer';
import type { ReactionAwareFeedState } from './reaction-reducer-with-rollback';
import { applyReactionChangeToSummary, feedWithReactionsReducer } from './reaction-reducer-with-rollback';

const summary = (like: number, love = 0): EngagementSummary => ({
  reactionCounts: { like, love, haha: 0, wow: 0, sad: 0, angry: 0 },
  totalReactions: like + love,
  commentCount: 0,
  shareCount: 0,
});

const post: Post = {
  id: 'p1',
  authorId: 'u1',
  body: { text: '', entities: [] },
  mediaIds: [],
  engagementSummary: summary(5),
  viewerReaction: null,
  createdAt: '',
};

const initial: ReactionAwareFeedState = { ...INITIAL_FEED_STATE, postsById: { p1: post }, pendingReactions: {} };

const response = (reaction: ReactionType | null, total: EngagementSummary): ReactionResponse => ({ postId: 'p1', viewerReaction: reaction, engagementSummary: total });

describe('applyReactionChangeToSummary', () => {
  it('thêm, đổi, bỏ reaction', () => {
    expect(applyReactionChangeToSummary(summary(5), null, 'like').totalReactions).toBe(6);
    const changed = applyReactionChangeToSummary(summary(6), 'like', 'love');
    expect(changed.reactionCounts.like).toBe(5);
    expect(changed.reactionCounts.love).toBe(1);
    expect(changed.totalReactions).toBe(6);
    expect(applyReactionChangeToSummary(summary(6), 'like', null).totalReactions).toBe(5);
  });
});

describe('reaction reducer', () => {
  it('optimistic → UI đổi ngay; confirmed → dùng số của server', () => {
    let state = feedWithReactionsReducer(initial, { type: 'reactionOptimisticApplied', postId: 'p1', reaction: 'like', requestSeq: 1 });
    expect(state.postsById.p1?.viewerReaction).toBe('like');
    expect(state.postsById.p1?.engagementSummary.totalReactions).toBe(6);
    expect(state.pendingReactions.p1).toBeDefined();

    // Server biết thêm 1 người khác vừa like → tổng 7.
    state = feedWithReactionsReducer(state, { type: 'reactionConfirmed', postId: 'p1', requestSeq: 1, response: response('like', summary(7)) });
    expect(state.postsById.p1?.engagementSummary.totalReactions).toBe(7);
    expect(state.pendingReactions.p1).toBeUndefined();
  });

  it('lỗi → rollback về đúng trạng thái trước khi bấm', () => {
    let state = feedWithReactionsReducer(initial, { type: 'reactionOptimisticApplied', postId: 'p1', reaction: 'love', requestSeq: 1 });
    state = feedWithReactionsReducer(state, { type: 'reactionRolledBack', postId: 'p1', requestSeq: 1 });
    expect(state.postsById.p1?.viewerReaction).toBeNull();
    expect(state.postsById.p1?.engagementSummary).toEqual(summary(5));
    expect(state.pendingReactions.p1).toBeUndefined();
  });

  it('response về sai thứ tự: response cũ không ghi đè ý định mới nhất', () => {
    // Bấm like (#1) rồi bỏ like (#2)
    let state = feedWithReactionsReducer(initial, { type: 'reactionOptimisticApplied', postId: 'p1', reaction: 'like', requestSeq: 1 });
    state = feedWithReactionsReducer(state, { type: 'reactionOptimisticApplied', postId: 'p1', reaction: null, requestSeq: 2 });
    expect(state.postsById.p1?.viewerReaction).toBeNull();

    // #1 về trễ hơn: không đổi UI
    state = feedWithReactionsReducer(state, { type: 'reactionConfirmed', postId: 'p1', requestSeq: 1, response: response('like', summary(6)) });
    expect(state.postsById.p1?.viewerReaction).toBeNull();
    expect(state.pendingReactions.p1?.confirmed.viewerReaction).toBe('like');

    // #2 lỗi → rollback về trạng thái server xác nhận gần nhất (= kết quả của #1)
    state = feedWithReactionsReducer(state, { type: 'reactionRolledBack', postId: 'p1', requestSeq: 2 });
    expect(state.postsById.p1?.viewerReaction).toBe('like');
    expect(state.postsById.p1?.engagementSummary.totalReactions).toBe(6);
  });

  it('lỗi của request cũ bị bỏ qua khi có request mới hơn', () => {
    let state = feedWithReactionsReducer(initial, { type: 'reactionOptimisticApplied', postId: 'p1', reaction: 'like', requestSeq: 1 });
    state = feedWithReactionsReducer(state, { type: 'reactionOptimisticApplied', postId: 'p1', reaction: 'love', requestSeq: 2 });
    state = feedWithReactionsReducer(state, { type: 'reactionRolledBack', postId: 'p1', requestSeq: 1 });
    expect(state.postsById.p1?.viewerReaction).toBe('love');
  });

  it('action của feed (lesson 03) vẫn hoạt động và giữ pendingReactions', () => {
    let state = feedWithReactionsReducer(initial, { type: 'reactionOptimisticApplied', postId: 'p1', reaction: 'like', requestSeq: 1 });
    state = feedWithReactionsReducer(state, { type: 'entitiesMerged', entities: { users: {} } });
    expect(state.pendingReactions.p1).toBeDefined();
  });
});
