/**
 * NORMALIZED STORE (D – Data model, phía client)
 *
 * Thay vì lưu "danh sách post, mỗi post lồng sẵn author và media", ta lưu theo id:
 *
 *   postsById   { 'post-1': Post, ... }       Post chỉ chứa authorId, mediaIds
 *   usersById   { 'user-3': User, ... }
 *   mediaById   { 'post-1-m1': Media, ... }
 *   feed        { postIds: [...], cursors, ... }   chỉ là danh sách id theo thứ tự
 *
 * Lợi ích:
 *   - Một user xuất hiện ở 50 bài → chỉ có 1 bản sao. Cập nhật 1 chỗ, mọi nơi đổi theo.
 *   - Cập nhật 1 post (vd reaction) không phải tìm trong mảng lồng nhau.
 *   - Nhiều màn hình (feed, chi tiết bài, profile) dùng chung cùng entity.
 *
 * Các lesson sau tái dùng reducer này (04: infinite scroll, 05: reaction, 06: composer, 08: virtualization).
 */
import type { Media, NormalizedEntities, NormalizedFeedResponse, Post, User } from '../../shared/types/feed-entities';

// 📖 Bài học lesson-03 §1 – hình dạng state chuẩn hoá (docs/lessons/lesson-03.md)
// #region learn:store-state-shape
export interface FeedListState {
  postIds: string[];
  olderCursor: string | null;
  newerCursor: string | null;
  hasOlder: boolean;
  hasNewer: boolean;
  generation: number;
  lastFetchedAt: number | null;
}

export interface FeedState {
  postsById: Record<string, Post>;
  usersById: Record<string, User>;
  mediaById: Record<string, Media>;
  feed: FeedListState;
}

export const INITIAL_FEED_STATE: FeedState = {
  postsById: {},
  usersById: {},
  mediaById: {},
  feed: { postIds: [], olderCursor: null, newerCursor: null, hasOlder: true, hasNewer: false, generation: 0, lastFetchedAt: null },
};
// #endregion learn:store-state-shape

// 📖 Bài học lesson-03 §3 – các action của store (docs/lessons/lesson-03.md)
// #region learn:store-action-types
export type FeedStoreAction =
  /** initial: thay toàn bộ list; older: nối vào cuối; newer: chèn lên đầu. */
  | { type: 'feedPageReceived'; direction: 'initial' | 'older' | 'newer'; response: NormalizedFeedResponse; receivedAt: number }
  /** Merge entity từ bất kỳ response nào (chi tiết bài, tạo bài, ...). */
  | { type: 'entitiesMerged'; entities: Partial<NormalizedEntities> }
  /** Chèn 1 post lên đầu feed (bài vừa đăng). */
  | { type: 'postPrepended'; post: Post }
  /** Thay post tạm (id tạm) bằng post thật từ server. */
  | { type: 'postReplaced'; previousId: string; post: Post }
  | { type: 'postRemoved'; postId: string };
// #endregion learn:store-action-types

// 📖 Bài học lesson-03 §2 – merge entity và khử id trùng (docs/lessons/lesson-03.md)
// #region learn:store-merge-helpers
/** Bản sao object không có khoá `key`. */
export function withoutKey<T>(record: Record<string, T>, key: string): Record<string, T> {
  const { [key]: _removed, ...rest } = record;
  return rest;
}

/** Ghép mảng id, bỏ id trùng (giữ lần xuất hiện đầu). Phòng thủ cả khi server trả trùng. */
export function mergeUniqueIds(first: readonly string[], second: readonly string[]): string[] {
  return [...new Set([...first, ...second])];
}

function mergeEntities(state: FeedState, entities: Partial<NormalizedEntities>): FeedState {
  return {
    ...state,
    postsById: entities.posts ? { ...state.postsById, ...entities.posts } : state.postsById,
    usersById: entities.users ? { ...state.usersById, ...entities.users } : state.usersById,
    mediaById: entities.media ? { ...state.mediaById, ...entities.media } : state.mediaById,
  };
}
// #endregion learn:store-merge-helpers

export function feedStoreReducer(state: FeedState, action: FeedStoreAction): FeedState {
  switch (action.type) {
    // 📖 Bài học lesson-03 §2 – nhận một trang feed (docs/lessons/lesson-03.md)
    // #region learn:store-feed-page-received
    case 'feedPageReceived': {
      const { response, direction } = action;
      const merged = mergeEntities(state, response);
      const pageInfo = response.feed;

      if (direction === 'initial') {
        return {
          ...merged,
          feed: { ...pageInfo, postIds: mergeUniqueIds([], pageInfo.postIds), lastFetchedAt: action.receivedAt },
        };
      }
      if (direction === 'older') {
        return {
          ...merged,
          feed: {
            ...state.feed,
            postIds: mergeUniqueIds(state.feed.postIds, pageInfo.postIds),
            olderCursor: pageInfo.olderCursor,
            hasOlder: pageInfo.hasOlder,
            generation: Math.max(state.feed.generation, pageInfo.generation),
          },
        };
      }
      // newer: bài mới lên đầu; chỉ dời newerCursor khi thật sự có bài.
      return {
        ...merged,
        feed: {
          ...state.feed,
          postIds: mergeUniqueIds(pageInfo.postIds, state.feed.postIds),
          newerCursor: pageInfo.postIds.length > 0 ? pageInfo.newerCursor : state.feed.newerCursor,
          hasNewer: pageInfo.hasNewer,
          generation: Math.max(state.feed.generation, pageInfo.generation),
          lastFetchedAt: action.receivedAt,
        },
      };
    }
    // #endregion learn:store-feed-page-received

    // 📖 Bài học lesson-03 §3 – cập nhật một chỗ, mọi nơi đổi theo (docs/lessons/lesson-03.md)
    // #region learn:store-entity-actions
    case 'entitiesMerged':
      return mergeEntities(state, action.entities);

    case 'postPrepended':
      return {
        ...state,
        postsById: { ...state.postsById, [action.post.id]: action.post },
        feed: { ...state.feed, postIds: mergeUniqueIds([action.post.id], state.feed.postIds) },
      };

    case 'postReplaced':
      return {
        ...state,
        postsById: { ...withoutKey(state.postsById, action.previousId), [action.post.id]: action.post },
        // Khử trùng: nếu bài thật đã có trong feed (vd gửi lại cùng idempotency key), không hiện 2 lần.
        feed: { ...state.feed, postIds: mergeUniqueIds([], state.feed.postIds.map((id) => (id === action.previousId ? action.post.id : id))) },
      };

    case 'postRemoved':
      return { ...state, postsById: withoutKey(state.postsById, action.postId), feed: { ...state.feed, postIds: state.feed.postIds.filter((id) => id !== action.postId) } };
    // #endregion learn:store-entity-actions
  }
}
