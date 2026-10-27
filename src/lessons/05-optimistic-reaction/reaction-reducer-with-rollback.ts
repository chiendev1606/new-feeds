/**
 * OPTIMISTIC UPDATE + ROLLBACK + XỬ LÝ RACE cho reaction.
 *
 * Luồng một lần bấm:
 *   1. reactionOptimisticApplied: đổi UI NGAY (không đợi mạng), nhớ "trạng thái đã xác nhận" để rollback.
 *   2a. reactionConfirmed: server trả về engagementSummary thật → dùng nó (server là nguồn sự thật).
 *   2b. reactionRolledBack: request lỗi → trả UI về trạng thái đã xác nhận gần nhất.
 *
 * Bấm nhiều lần liên tiếp: mỗi lần bấm mang một số thứ tự (requestSeq) tăng dần; chỉ kết quả của
 * thao tác MỚI NHẤT được quyền thay đổi UI. Kết quả cũ hơn chỉ cập nhật snapshot "đã xác nhận" (mốc rollback).
 * Lưu ý: requestSeq chỉ giải quyết thứ tự RESPONSE ở client. Để server GHI đúng thứ tự, use-toggle-reaction.ts
 * còn gửi request tuần tự theo từng bài – cần cả hai.
 */
import type { EngagementSummary, ReactionResponse, ReactionType } from '../../shared/types/feed-entities';
import type { FeedState, FeedStoreAction } from '../03-normalized-store/feed-store-reducer';
import { feedStoreReducer, INITIAL_FEED_STATE, withoutKey } from '../03-normalized-store/feed-store-reducer';

export interface ConfirmedReactionSnapshot {
  viewerReaction: ReactionType | null;
  engagementSummary: EngagementSummary;
}

export interface PendingReactionRecord {
  /** requestSeq của lần bấm gần nhất trên post này. */
  latestSeq: number;
  /** Trạng thái server đã xác nhận gần nhất – dùng để rollback. */
  confirmed: ConfirmedReactionSnapshot;
}

export interface ReactionAwareFeedState extends FeedState {
  pendingReactions: Record<string, PendingReactionRecord>;
}

export type ReactionAction =
  | { type: 'reactionOptimisticApplied'; postId: string; reaction: ReactionType | null; requestSeq: number }
  | { type: 'reactionConfirmed'; postId: string; requestSeq: number; response: ReactionResponse }
  | { type: 'reactionRolledBack'; postId: string; requestSeq: number };

/** Tính lại số đếm khi viewer đổi từ `previous` sang `next` (null = không react). */
export function applyReactionChangeToSummary(summary: EngagementSummary, previous: ReactionType | null, next: ReactionType | null): EngagementSummary {
  if (previous === next) return summary;
  const reactionCounts = { ...summary.reactionCounts };
  let totalReactions = summary.totalReactions;
  if (previous) {
    reactionCounts[previous] = Math.max(0, reactionCounts[previous] - 1);
    totalReactions -= 1;
  }
  if (next) {
    reactionCounts[next] += 1;
    totalReactions += 1;
  }
  return { ...summary, reactionCounts, totalReactions: Math.max(0, totalReactions) };
}

function patchPost(state: ReactionAwareFeedState, postId: string, snapshot: ConfirmedReactionSnapshot): ReactionAwareFeedState {
  const post = state.postsById[postId];
  if (!post) return state;
  return { ...state, postsById: { ...state.postsById, [postId]: { ...post, ...snapshot } } };
}

function reactionReducer(state: ReactionAwareFeedState, action: ReactionAction): ReactionAwareFeedState {
  const post = state.postsById[action.postId];
  if (!post) return state;
  const record = state.pendingReactions[action.postId];

  switch (action.type) {
    case 'reactionOptimisticApplied': {
      // Lần bấm đầu tiên (không có request nào đang chờ) → chụp lại trạng thái hiện tại làm mốc rollback.
      const confirmed = record?.confirmed ?? { viewerReaction: post.viewerReaction, engagementSummary: post.engagementSummary };
      const optimistic: ConfirmedReactionSnapshot = {
        viewerReaction: action.reaction,
        engagementSummary: applyReactionChangeToSummary(post.engagementSummary, post.viewerReaction, action.reaction),
      };
      return {
        ...patchPost(state, action.postId, optimistic),
        pendingReactions: { ...state.pendingReactions, [action.postId]: { latestSeq: action.requestSeq, confirmed } },
      };
    }

    case 'reactionConfirmed': {
      const serverTruth: ConfirmedReactionSnapshot = {
        viewerReaction: action.response.viewerReaction,
        engagementSummary: action.response.engagementSummary,
      };
      if (!record) return state; // request mới hơn đã kết thúc trước → bỏ qua response cũ này
      if (action.requestSeq !== record.latestSeq) {
        // Response của request CŨ về trễ: không đổi UI (đang hiển thị ý định mới nhất), chỉ cập nhật mốc rollback.
        return { ...state, pendingReactions: { ...state.pendingReactions, [action.postId]: { ...record, confirmed: serverTruth } } };
      }
      return { ...patchPost(state, action.postId, serverTruth), pendingReactions: withoutKey(state.pendingReactions, action.postId) };
    }

    case 'reactionRolledBack': {
      if (!record || action.requestSeq !== record.latestSeq) return state; // lỗi của request cũ: request mới hơn sẽ quyết định
      return { ...patchPost(state, action.postId, record.confirmed), pendingReactions: withoutKey(state.pendingReactions, action.postId) };
    }
  }
}

const REACTION_ACTION_TYPES = new Set<string>(['reactionOptimisticApplied', 'reactionConfirmed', 'reactionRolledBack']);

/** Reducer của lesson 03 + phần reaction → truyền vào <FeedStoreProvider reducer={...}>. */
export function feedWithReactionsReducer(state: ReactionAwareFeedState, action: FeedStoreAction | ReactionAction): ReactionAwareFeedState {
  if (REACTION_ACTION_TYPES.has(action.type)) return reactionReducer(state, action as ReactionAction);
  return { ...feedStoreReducer(state, action as FeedStoreAction), pendingReactions: state.pendingReactions };
}

export const INITIAL_REACTION_FEED_STATE: ReactionAwareFeedState = { ...INITIAL_FEED_STATE, pendingReactions: {} };
