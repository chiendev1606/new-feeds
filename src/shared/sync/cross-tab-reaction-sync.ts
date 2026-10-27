/**
 * ĐỒNG BỘ GIỮA CÁC TAB (O – Feed list): react ở tab A thì tab B cập nhật mà không cần gọi lại server.
 *
 * Vì sao BroadcastChannel?
 *   - Cùng origin, không cần server push (WebSocket/SSE) cho chuyện "chính mình mở nhiều tab".
 *   - Không gửi lại cho chính tab phát → không có vòng lặp.
 *
 * Hai điểm dễ sai:
 *   1. Tách kênh theo viewerId: nếu trình duyệt đổi tài khoản, tab của người khác không được nhận reaction của mình.
 *   2. Tin nhắn có thể tới SAI THỨ TỰ (tab A bấm Thích rồi Bỏ thích rất nhanh). Server là nguồn sự thật và gắn
 *      `confirmedAt` cho mỗi lần ghi; tab nhận chỉ áp dụng bản có confirmedAt MỚI HƠN bản nó đã biết.
 *
 * File này không phụ thuộc React: chỉ gồm hàm thuần + một lớp bọc mỏng quanh BroadcastChannel (có thể truyền
 * constructor giả khi test). Hook React nằm ở use-cross-tab-reaction-sync.ts.
 */
import type { EngagementSummary, ReactionResponse, ReactionType } from '../types/feed-entities';

// 📖 Bài học lesson-09 – tin nhắn đồng bộ và kênh tách theo viewer (docs/lessons/lesson-09.md)
// #region learn:sync-message-types
export const REACTION_CHANNEL_PREFIX = 'newsfeed';

export interface ReactionSyncMessage {
  type: 'reaction';
  postId: string;
  engagementSummary: EngagementSummary;
  viewerReaction: ReactionType | null;
  /** ISO – thời điểm server ghi xong. */
  confirmedAt: string;
}

export type ReactionSyncLogEntry =
  | { kind: 'sent'; postId: string; confirmedAt: string }
  | { kind: 'received'; postId: string; confirmedAt: string }
  | { kind: 'applied'; postId: string; confirmedAt: string }
  | { kind: 'ignored-stale'; postId: string; confirmedAt: string }
  | { kind: 'skipped'; postId: string; confirmedAt: string; reason: string }
  | { kind: 'ignored-invalid' };

export const channelNameForViewer = (viewerId: string) => `${REACTION_CHANNEL_PREFIX}:${viewerId}`;
// #endregion learn:sync-message-types

export function toReactionSyncMessage(response: ReactionResponse): ReactionSyncMessage {
  return {
    type: 'reaction',
    postId: response.postId,
    engagementSummary: response.engagementSummary,
    viewerReaction: response.viewerReaction,
    confirmedAt: response.confirmedAt,
  };
}

// 📖 Bài học lesson-09 – dữ liệu từ kênh là đầu vào ngoài nên phải kiểm tra hình dạng (docs/lessons/lesson-09.md)
// #region learn:sync-message-validate
/** Dữ liệu từ kênh là "đầu vào bên ngoài" (tab khác, có thể là bản code cũ) → kiểm tra hình dạng trước khi dùng. */
export function isReactionSyncMessage(data: unknown): data is ReactionSyncMessage {
  if (typeof data !== 'object' || data === null) return false;
  const message = data as Record<string, unknown>;
  return (
    message.type === 'reaction' &&
    typeof message.postId === 'string' &&
    typeof message.confirmedAt === 'string' &&
    !Number.isNaN(Date.parse(message.confirmedAt)) &&
    typeof message.engagementSummary === 'object' &&
    message.engagementSummary !== null &&
    (message.viewerReaction === null || typeof message.viewerReaction === 'string')
  );
}
// #endregion learn:sync-message-validate

// 📖 Bài học lesson-09 – chỉ áp dụng bản có confirmedAt mới hơn bản đã biết (docs/lessons/lesson-09.md)
// #region learn:confirmed-at-tracker
/**
 * Nhớ confirmedAt mới nhất đã biết của từng bài (cả do chính tab này xác nhận lẫn nhận từ tab khác).
 * `isNewer` chỉ kiểm tra, không ghi: tab nhận có thể từ chối áp dụng (vd bài đang chờ server) và khi đó
 * không được coi là "đã biết".
 */
export class ConfirmedAtTracker {
  private readonly latestByPost = new Map<string, number>();

  isNewer(postId: string, confirmedAt: string): boolean {
    const incoming = Date.parse(confirmedAt);
    if (Number.isNaN(incoming)) return false;
    const known = this.latestByPost.get(postId);
    return known === undefined || incoming > known;
  }

  record(postId: string, confirmedAt: string): void {
    const incoming = Date.parse(confirmedAt);
    if (Number.isNaN(incoming)) return;
    this.latestByPost.set(postId, Math.max(this.latestByPost.get(postId) ?? incoming, incoming));
  }
}
// #endregion learn:confirmed-at-tracker

// 📖 Bài học lesson-09 – giữ bản mới nhất theo bài khi chưa áp được để không mất dữ liệu (docs/lessons/lesson-09.md)
// #region learn:deferred-patch-buffer
/**
 * Tin bị bỏ qua vì bài đang chờ server (hoặc chưa tải) KHÔNG được vứt: giữ bản MỚI NHẤT theo từng bài để áp lại sau.
 * Kịch bản mất dữ liệu nếu vứt: tab B ghi lúc t1 (đang chờ), tab A ghi lúc t2 > t1 và tin của A tới B giữa chừng → bị bỏ;
 * rồi response t1 của B được áp → B lệch so với server (t2 mới hơn) cho tới khi tải lại. Giữ tin t2 và áp lại khi hết chờ
 * (nếu confirmedAt của nó vẫn mới hơn bản tab đã biết) thì B hội tụ về t2.
 * Hàm thuần theo nghĩa không phụ thuộc DOM/React: dễ test.
 */
export class DeferredPatchBuffer {
  private readonly latestByPost = new Map<string, ReactionSyncMessage>();

  constructor(private readonly maxEntries = 100) {}

  /** Giữ bản mới hơn (theo confirmedAt) của cùng một bài; quá giới hạn thì bỏ bài được thêm sớm nhất. */
  remember(message: ReactionSyncMessage): void {
    const existing = this.latestByPost.get(message.postId);
    if (existing && Date.parse(existing.confirmedAt) >= Date.parse(message.confirmedAt)) return;
    this.latestByPost.delete(message.postId); // xoá rồi set để bài này thành "mới thêm nhất" trong thứ tự của Map
    this.latestByPost.set(message.postId, message);
    if (this.latestByPost.size > this.maxEntries) {
      const oldest = this.latestByPost.keys().next().value;
      if (oldest !== undefined) this.latestByPost.delete(oldest);
    }
  }

  forget(postId: string): void {
    this.latestByPost.delete(postId);
  }

  pending(): ReactionSyncMessage[] {
    return [...this.latestByPost.values()];
  }

  get size(): number {
    return this.latestByPost.size;
  }
}
// #endregion learn:deferred-patch-buffer

/** Phần tối thiểu của BroadcastChannel mà ta dùng – để test truyền bản giả. */
export interface ChannelLike {
  postMessage(message: unknown): void;
  close(): void;
  onmessage: ((event: { data: unknown }) => void) | null;
}
export type ChannelConstructor = new (name: string) => ChannelLike;

export interface ReactionSyncHandlers {
  /** Trả true nếu đã áp dụng vào store; false nếu bỏ qua (kèm lý do qua onLog nếu muốn). */
  onPatch(message: ReactionSyncMessage): boolean;
  onLog?(entry: ReactionSyncLogEntry): void;
}

export interface ReactionSyncChannel {
  /** Phát sau khi server xác nhận. */
  publish(response: ReactionResponse): void;
  /** Thử áp lại các tin từng bị bỏ qua (gọi khi bài hết chờ server / vừa được tải). Tin đã cũ hơn bản tab biết thì bị loại. */
  flushDeferred(): void;
  close(): void;
}

export function openReactionSyncChannel(
  viewerId: string,
  { onPatch, onLog }: ReactionSyncHandlers,
  ChannelImpl: ChannelConstructor | null = (globalThis as { BroadcastChannel?: ChannelConstructor }).BroadcastChannel ?? null,
): ReactionSyncChannel | null {
  // Trình duyệt cũ / môi trường không có BroadcastChannel: bỏ qua đồng bộ, app vẫn chạy bình thường.
  if (!ChannelImpl) return null;
  const channel = new ChannelImpl(channelNameForViewer(viewerId));
  const tracker = new ConfirmedAtTracker();
  const deferred = new DeferredPatchBuffer();

  // 📖 Bài học lesson-09 – nhận tin: kiểm tra, so confirmedAt, áp hoặc giữ lại (docs/lessons/lesson-09.md)
  // #region learn:sync-channel-on-message
  channel.onmessage = ({ data }) => {
    if (!isReactionSyncMessage(data)) {
      onLog?.({ kind: 'ignored-invalid' });
      return;
    }
    const { postId, confirmedAt } = data;
    onLog?.({ kind: 'received', postId, confirmedAt });
    if (!tracker.isNewer(postId, confirmedAt)) {
      onLog?.({ kind: 'ignored-stale', postId, confirmedAt });
      return;
    }
    if (onPatch(data)) {
      tracker.record(postId, confirmedAt);
      deferred.forget(postId);
      onLog?.({ kind: 'applied', postId, confirmedAt });
    } else {
      deferred.remember(data); // không vứt: áp lại ở flushDeferred() khi bài hết chờ
      onLog?.({ kind: 'skipped', postId, confirmedAt, reason: 'bài chưa tải hoặc đang chờ server xác nhận – giữ lại để áp sau' });
    }
  };
  // #endregion learn:sync-channel-on-message

  // 📖 Bài học lesson-09 – phát sau khi server xác nhận, áp lại tin bị hoãn, đóng kênh (docs/lessons/lesson-09.md)
  // #region learn:sync-channel-publish-flush-close
  return {
    publish(response) {
      // Ghi nhận bản của chính mình để bản cũ hơn từ tab khác (tới trễ) không ghi đè lên.
      tracker.record(response.postId, response.confirmedAt);
      channel.postMessage(toReactionSyncMessage(response));
      onLog?.({ kind: 'sent', postId: response.postId, confirmedAt: response.confirmedAt });
    },
    flushDeferred() {
      for (const message of deferred.pending()) {
        const { postId, confirmedAt } = message;
        if (!tracker.isNewer(postId, confirmedAt)) {
          deferred.forget(postId); // trong lúc chờ, tab đã biết bản mới hơn (vd response của chính nó) → tin này cũ rồi
          onLog?.({ kind: 'ignored-stale', postId, confirmedAt });
        } else if (onPatch(message)) {
          deferred.forget(postId);
          tracker.record(postId, confirmedAt);
          onLog?.({ kind: 'applied', postId, confirmedAt });
        } // else: vẫn đang chờ/chưa tải → giữ lại cho lần flush sau
      }
    },
    close() {
      channel.onmessage = null;
      channel.close();
    },
  };
  // #endregion learn:sync-channel-publish-flush-close
}

/**
 * Kênh đang mở của tab này (do useCrossTabReactionSync đặt). use-toggle-reaction chỉ cần gọi
 * publishReactionConfirmed() sau khi server xác nhận; lesson nào không bật đồng bộ thì đây là no-op.
 */
let activeChannel: ReactionSyncChannel | null = null;

export function setActiveReactionSyncChannel(channel: ReactionSyncChannel | null) {
  activeChannel = channel;
}

export function publishReactionConfirmed(response: ReactionResponse) {
  activeChannel?.publish(response);
}
