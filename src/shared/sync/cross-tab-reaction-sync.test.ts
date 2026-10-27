import { beforeEach, describe, expect, it } from 'vitest';
import type { EngagementSummary, ReactionResponse } from '../types/feed-entities';
import {
  channelNameForViewer,
  ConfirmedAtTracker,
  DeferredPatchBuffer,
  isReactionSyncMessage,
  openReactionSyncChannel,
  publishReactionConfirmed,
  setActiveReactionSyncChannel,
  type ChannelLike,
  type ReactionSyncLogEntry,
  type ReactionSyncMessage,
} from './cross-tab-reaction-sync';

/** BroadcastChannel giả: postMessage gửi cho MỌI instance cùng tên TRỪ chính nó (đúng hành vi thật). */
class FakeBroadcastChannel implements ChannelLike {
  static instances: FakeBroadcastChannel[] = [];
  onmessage: ((event: { data: unknown }) => void) | null = null;
  closed = false;
  constructor(readonly name: string) {
    FakeBroadcastChannel.instances.push(this);
  }
  postMessage(message: unknown) {
    for (const other of FakeBroadcastChannel.instances) {
      if (other !== this && !other.closed && other.name === this.name) other.onmessage?.({ data: structuredClone(message) });
    }
  }
  close() {
    this.closed = true;
  }
}

const summary: EngagementSummary = {
  totalReactions: 5,
  reactionCounts: { like: 5, love: 0, haha: 0, wow: 0, sad: 0, angry: 0 },
  commentCount: 0,
  shareCount: 0,
} as EngagementSummary;

const response = (confirmedAt: string, postId = 'p1'): ReactionResponse => ({ postId, engagementSummary: summary, viewerReaction: 'like', confirmedAt });

beforeEach(() => {
  FakeBroadcastChannel.instances = [];
  setActiveReactionSyncChannel(null);
});

describe('ConfirmedAtTracker', () => {
  it('chỉ coi là mới khi confirmedAt lớn hơn bản đã ghi nhận', () => {
    const tracker = new ConfirmedAtTracker();
    expect(tracker.isNewer('p1', '2026-01-01T00:00:10.000Z')).toBe(true);
    tracker.record('p1', '2026-01-01T00:00:10.000Z');
    expect(tracker.isNewer('p1', '2026-01-01T00:00:05.000Z')).toBe(false);
    expect(tracker.isNewer('p1', '2026-01-01T00:00:10.000Z')).toBe(false);
    expect(tracker.isNewer('p1', '2026-01-01T00:00:11.000Z')).toBe(true);
    expect(tracker.isNewer('p2', '2026-01-01T00:00:01.000Z')).toBe(true); // bài khác độc lập
  });

  it('chuỗi thời gian hỏng không bao giờ là "mới"', () => {
    expect(new ConfirmedAtTracker().isNewer('p1', 'không phải ngày')).toBe(false);
  });
});

describe('isReactionSyncMessage', () => {
  it('chấp nhận tin đúng hình dạng và từ chối phần còn lại', () => {
    const valid: ReactionSyncMessage = { type: 'reaction', postId: 'p1', engagementSummary: summary, viewerReaction: null, confirmedAt: '2026-01-01T00:00:00.000Z' };
    expect(isReactionSyncMessage(valid)).toBe(true);
    expect(isReactionSyncMessage(null)).toBe(false);
    expect(isReactionSyncMessage({ ...valid, type: 'other' })).toBe(false);
    expect(isReactionSyncMessage({ ...valid, confirmedAt: 'x' })).toBe(false);
    expect(isReactionSyncMessage({ ...valid, postId: 5 })).toBe(false);
  });
});

describe('openReactionSyncChannel', () => {
  const open = (viewerId: string, patches: ReactionSyncMessage[], log: ReactionSyncLogEntry[] = [], accept = true) =>
    openReactionSyncChannel(viewerId, { onPatch: (message) => (patches.push(message), accept), onLog: (entry) => log.push(entry) }, FakeBroadcastChannel)!;

  it('tên kênh tách theo viewerId', () => {
    open('u1', []);
    expect(FakeBroadcastChannel.instances[0]?.name).toBe(channelNameForViewer('u1'));
    expect(channelNameForViewer('u1')).not.toBe(channelNameForViewer('u2'));
  });

  it('tab A phát → tab B nhận và áp dụng; tab A không nhận lại tin của chính mình', () => {
    const patchesA: ReactionSyncMessage[] = [];
    const patchesB: ReactionSyncMessage[] = [];
    const a = open('u1', patchesA);
    open('u1', patchesB);
    a.publish(response('2026-01-01T00:00:10.000Z'));
    expect(patchesB).toHaveLength(1);
    expect(patchesB[0]).toMatchObject({ postId: 'p1', viewerReaction: 'like', confirmedAt: '2026-01-01T00:00:10.000Z' });
    expect(patchesA).toHaveLength(0);
  });

  it('bỏ qua patch có confirmedAt cũ hơn (hoặc bằng) bản tab đã biết', () => {
    const patches: ReactionSyncMessage[] = [];
    const log: ReactionSyncLogEntry[] = [];
    const a = open('u1', []);
    open('u1', patches, log);
    a.publish(response('2026-01-01T00:00:20.000Z'));
    a.publish(response('2026-01-01T00:00:10.000Z')); // tới trễ, cũ hơn
    a.publish(response('2026-01-01T00:00:20.000Z')); // trùng
    expect(patches).toHaveLength(1);
    expect(log.filter((entry) => entry.kind === 'ignored-stale')).toHaveLength(2);
    a.publish(response('2026-01-01T00:00:30.000Z'));
    expect(patches).toHaveLength(2);
  });

  it('bản do chính tab xác nhận cũng làm mốc: tin cũ hơn từ tab khác bị bỏ', () => {
    const patches: ReactionSyncMessage[] = [];
    const a = open('u1', patches);
    const b = open('u1', []);
    a.publish(response('2026-01-01T00:00:20.000Z')); // A tự xác nhận lúc :20
    b.publish(response('2026-01-01T00:00:10.000Z')); // tin cũ hơn từ B
    expect(patches).toHaveLength(0);
  });

  it('onPatch từ chối (vd bài đang chờ server) thì không ghi nhận → bản sau cùng confirmedAt vẫn được xét', () => {
    const log: ReactionSyncLogEntry[] = [];
    const a = open('u1', []);
    open('u1', [], log, false);
    a.publish(response('2026-01-01T00:00:10.000Z'));
    a.publish(response('2026-01-01T00:00:10.000Z'));
    expect(log.filter((entry) => entry.kind === 'skipped')).toHaveLength(2);
    expect(log.some((entry) => entry.kind === 'ignored-stale')).toBe(false);
  });

  it('viewer khác không nhận tin', () => {
    const patches: ReactionSyncMessage[] = [];
    const a = open('u1', []);
    open('u2', patches);
    a.publish(response('2026-01-01T00:00:10.000Z'));
    expect(patches).toHaveLength(0);
  });

  it('tin sai định dạng bị bỏ và ghi log', () => {
    const patches: ReactionSyncMessage[] = [];
    const log: ReactionSyncLogEntry[] = [];
    open('u1', patches, log);
    FakeBroadcastChannel.instances[0]?.onmessage?.({ data: { type: 'reaction' } });
    expect(patches).toHaveLength(0);
    expect(log).toEqual([{ kind: 'ignored-invalid' }]);
  });

  it('không có BroadcastChannel → trả null, không ném lỗi', () => {
    expect(openReactionSyncChannel('u1', { onPatch: () => true }, null)).toBeNull();
  });

  it('close() ngắt kênh', () => {
    const patches: ReactionSyncMessage[] = [];
    const a = open('u1', []);
    const b = open('u1', patches);
    b.close();
    a.publish(response('2026-01-01T00:00:10.000Z'));
    expect(patches).toHaveLength(0);
  });
});

describe('DeferredPatchBuffer', () => {
  const message = (confirmedAt: string, postId = 'p1'): ReactionSyncMessage => ({ type: 'reaction', postId, engagementSummary: summary, viewerReaction: 'like', confirmedAt });

  it('giữ bản MỚI NHẤT theo từng bài', () => {
    const buffer = new DeferredPatchBuffer();
    buffer.remember(message('2026-01-01T00:00:20.000Z'));
    buffer.remember(message('2026-01-01T00:00:10.000Z')); // cũ hơn → bỏ
    buffer.remember(message('2026-01-01T00:00:30.000Z', 'p2'));
    expect(buffer.pending().map((item) => [item.postId, item.confirmedAt])).toEqual([
      ['p1', '2026-01-01T00:00:20.000Z'],
      ['p2', '2026-01-01T00:00:30.000Z'],
    ]);
  });

  it('quá giới hạn thì bỏ bài thêm sớm nhất', () => {
    const buffer = new DeferredPatchBuffer(2);
    buffer.remember(message('2026-01-01T00:00:01.000Z', 'a'));
    buffer.remember(message('2026-01-01T00:00:02.000Z', 'b'));
    buffer.remember(message('2026-01-01T00:00:03.000Z', 'c'));
    expect(buffer.pending().map((item) => item.postId)).toEqual(['b', 'c']);
  });
});

describe('tin bị bỏ qua vì bài đang chờ được áp lại (flushDeferred)', () => {
  /** Tab nhận có cờ "bài đang chờ" bật/tắt được. */
  function openReceiver(patches: ReactionSyncMessage[], log: ReactionSyncLogEntry[] = []) {
    const state = { pending: true };
    const channel = openReactionSyncChannel(
      'u1',
      { onPatch: (message) => (state.pending ? false : (patches.push(message), true)), onLog: (entry) => log.push(entry) },
      FakeBroadcastChannel,
    )!;
    return { state, channel };
  }

  it('B đang chờ t1, tin t2 của A tới giữa chừng → sau khi B xác nhận t1 thì tin t2 được áp lại', () => {
    const patches: ReactionSyncMessage[] = [];
    const a = openReactionSyncChannel('u1', { onPatch: () => true }, FakeBroadcastChannel)!;
    const { state, channel: b } = openReceiver(patches);

    a.publish(response('2026-01-01T00:00:20.000Z')); // t2 của A, B đang chờ → bỏ qua nhưng được giữ
    expect(patches).toHaveLength(0);

    b.publish(response('2026-01-01T00:00:10.000Z')); // B nhận response t1 của chính nó (tracker = t1)
    state.pending = false;
    b.flushDeferred();
    expect(patches).toHaveLength(1);
    expect(patches[0]?.confirmedAt).toBe('2026-01-01T00:00:20.000Z');

    b.flushDeferred(); // áp rồi thì không áp lại lần nữa
    expect(patches).toHaveLength(1);
  });

  it('nếu bản tab đã biết còn mới hơn tin bị giữ (response của chính nó t3 > t2) → bỏ tin, không áp', () => {
    const patches: ReactionSyncMessage[] = [];
    const log: ReactionSyncLogEntry[] = [];
    const a = openReactionSyncChannel('u1', { onPatch: () => true }, FakeBroadcastChannel)!;
    const { state, channel: b } = openReceiver(patches, log);
    a.publish(response('2026-01-01T00:00:20.000Z'));
    b.publish(response('2026-01-01T00:00:30.000Z'));
    state.pending = false;
    b.flushDeferred();
    expect(patches).toHaveLength(0);
    expect(log.some((entry) => entry.kind === 'ignored-stale')).toBe(true);
  });

  it('vẫn đang chờ khi flush → giữ lại, lần flush sau mới áp', () => {
    const patches: ReactionSyncMessage[] = [];
    const a = openReactionSyncChannel('u1', { onPatch: () => true }, FakeBroadcastChannel)!;
    const { state, channel: b } = openReceiver(patches);
    a.publish(response('2026-01-01T00:00:20.000Z'));
    b.flushDeferred();
    expect(patches).toHaveLength(0);
    state.pending = false;
    b.flushDeferred();
    expect(patches).toHaveLength(1);
  });
});

describe('publishReactionConfirmed', () => {
  it('no-op khi chưa có kênh; có kênh thì phát đi', () => {
    expect(() => publishReactionConfirmed(response('2026-01-01T00:00:10.000Z'))).not.toThrow();
    const patches: ReactionSyncMessage[] = [];
    const sender = openReactionSyncChannel('u1', { onPatch: () => true }, FakeBroadcastChannel)!;
    openReactionSyncChannel('u1', { onPatch: (message) => (patches.push(message), true) }, FakeBroadcastChannel);
    setActiveReactionSyncChannel(sender);
    publishReactionConfirmed(response('2026-01-01T00:00:10.000Z'));
    expect(patches).toHaveLength(1);
  });
});
