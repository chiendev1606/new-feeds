import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TelemetryEvent } from '../../../shared-contracts/feed-api-contracts';
import { ImpressionTracker, type SentBatchLog, type VisibilityEntry } from './impression-tracker';

/** Observer giả: test chủ động "bắn" callback như IntersectionObserver thật. */
function setup(options: { shouldRetry?: (error: unknown) => boolean } = {}) {
  const disconnect = vi.fn();
  const dropped: TelemetryEvent[][] = [];
  let emit: (entries: VisibilityEntry[]) => void = () => undefined;
  const sendBatch = vi.fn<(events: TelemetryEvent[]) => Promise<void>>(async () => undefined);
  const sendBeacon = vi.fn<(events: TelemetryEvent[]) => boolean>(() => true);
  const logs: SentBatchLog[] = [];
  const impressed: string[] = [];
  const tracker = new ImpressionTracker({
    now: () => Date.now(),
    createObserver: (callback) => {
      emit = callback;
      return { observe: () => undefined, unobserve: () => undefined, disconnect };
    },
    setTimeout: (callback, ms) => setTimeout(callback, ms),
    clearTimeout: (handle) => clearTimeout(handle),
    sendBatch,
    sendBeacon,
    onImpression: (postId) => impressed.push(postId),
    onBatchSent: (log) => logs.push(log),
    shouldRetry: options.shouldRetry,
    onBatchDropped: (events) => dropped.push(events),
  });
  const addPost = (postId: string) => {
    const element = { postId } as unknown as Element;
    tracker.observe(element, postId);
    return {
      show: () => emit([{ target: element, isIntersecting: true, intersectionRatio: 0.6 }]),
      hide: () => emit([{ target: element, isIntersecting: false, intersectionRatio: 0 }]),
      /** Còn giao nhau nhưng dưới 50% → vẫn phải coi là rời. */
      partial: () => emit([{ target: element, isIntersecting: true, intersectionRatio: 0.3 }]),
    };
  };
  return { tracker, addPost, sendBatch, sendBeacon, logs, impressed, disconnect, dropped };
}

const sentEvents = (mock: { calls: Array<[TelemetryEvent[]]> }) => mock.calls.flatMap(([events]) => events);

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-27T10:00:00.000Z'));
});
afterEach(() => vi.useRealTimers());

describe('ImpressionTracker', () => {
  it('hiện dưới 1 giây thì không tính impression và không có dwell', async () => {
    const { tracker, addPost, impressed, sendBatch } = setup();
    const post = addPost('p1');
    post.show();
    vi.advanceTimersByTime(900);
    post.hide();
    vi.advanceTimersByTime(10_000);
    expect(impressed).toEqual([]);
    expect(sendBatch).not.toHaveBeenCalled();
    await tracker.flush();
    expect(sendBatch).not.toHaveBeenCalled();
  });

  it('hiện đủ 1 giây thì tính đúng 1 lần, ra vào lại không tính trùng', async () => {
    const { tracker, addPost, impressed, sendBatch } = setup();
    const post = addPost('p1');
    post.show();
    vi.advanceTimersByTime(1000);
    expect(impressed).toEqual(['p1']);
    post.hide();
    post.show();
    vi.advanceTimersByTime(3000);
    post.hide();
    await tracker.flush();
    const events = sentEvents(sendBatch.mock);
    expect(events.filter((event) => event.type === 'impression')).toHaveLength(1);
    expect(impressed).toEqual(['p1']);
  });

  it('dwell cộng dồn theo từng đoạn và gửi khi rời viewport', async () => {
    const { tracker, addPost, sendBatch } = setup();
    const post = addPost('p1');
    post.show();
    vi.advanceTimersByTime(2500);
    post.hide(); // đoạn 1: 2500ms
    vi.advanceTimersByTime(500);
    post.show();
    vi.advanceTimersByTime(1500);
    post.partial(); // tụt dưới 50% = rời; đoạn 2: 1500ms
    await tracker.flush();
    const dwell = sentEvents(sendBatch.mock).filter((event) => event.type === 'dwell');
    expect(dwell.map((event) => (event.type === 'dwell' ? event.durationMs : 0))).toEqual([2500, 1500]);
  });

  it('flush khi đủ 20 sự kiện (không cần chờ 5s)', () => {
    const { addPost, sendBatch } = setup();
    for (let index = 0; index < 20; index += 1) addPost(`p${index}`).show();
    vi.advanceTimersByTime(1000); // 20 impression cùng đến hạn
    expect(sendBatch).toHaveBeenCalledTimes(1);
    expect(sendBatch.mock.calls[0]?.[0]).toHaveLength(20);
  });

  it('flush mỗi 5 giây kể từ sự kiện đầu tiên trong hàng đợi', () => {
    const { addPost, sendBatch } = setup();
    addPost('p1').show();
    vi.advanceTimersByTime(1000); // impression vào hàng đợi, bắt đầu đếm 5s
    vi.advanceTimersByTime(4999);
    expect(sendBatch).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(sendBatch).toHaveBeenCalledTimes(1);
    expect(sendBatch.mock.calls[0]?.[0]).toEqual([expect.objectContaining({ type: 'impression', postId: 'p1' })]);
  });

  it('trang hidden: chốt dwell bài đang xem và gửi bằng beacon, không dùng fetch', () => {
    const { tracker, addPost, sendBatch, sendBeacon, logs } = setup();
    addPost('p1').show();
    vi.advanceTimersByTime(4000);
    tracker.handlePageHidden();
    expect(sendBatch).not.toHaveBeenCalled();
    expect(sendBeacon).toHaveBeenCalledTimes(1);
    const types = sendBeacon.mock.calls[0]?.[0].map((event) => event.type);
    expect(types).toEqual(['impression', 'dwell']);
    expect(logs).toEqual([expect.objectContaining({ method: 'beacon', size: 2, ok: true })]);
  });

  it('trang hiện lại: bài vẫn trong viewport tiếp tục đo dwell', () => {
    const { tracker, addPost, sendBeacon } = setup();
    addPost('p1').show();
    vi.advanceTimersByTime(1000);
    tracker.handlePageHidden();
    vi.advanceTimersByTime(60_000); // thời gian tab ẩn không được tính vào dwell
    tracker.handlePageVisible();
    vi.advanceTimersByTime(2000);
    tracker.handlePageHidden();
    const dwell = sendBeacon.mock.calls.flatMap(([events]) => events).filter((event) => event.type === 'dwell');
    expect(dwell.map((event) => (event.type === 'dwell' ? event.durationMs : 0))).toEqual([1000, 2000]);
  });

  it('beacon bị từ chối thì dự phòng bằng fetch; lỗi fetch thì lô quay lại hàng đợi', async () => {
    const { tracker, addPost, sendBatch, sendBeacon } = setup();
    sendBeacon.mockReturnValueOnce(false);
    addPost('p1').show();
    vi.advanceTimersByTime(1000);
    tracker.handlePageHidden();
    expect(sendBatch).toHaveBeenCalledTimes(1);

    sendBatch.mockRejectedValueOnce(new Error('offline'));
    tracker.enqueue({ type: 'web-vital', name: 'LCP', value: 1200, at: new Date().toISOString() });
    await tracker.flush();
    await tracker.flush(); // lần sau gửi lại đúng lô đã lỗi
    expect(sendBatch).toHaveBeenCalledTimes(3);
    expect(sendBatch.mock.calls[2]?.[0]).toEqual([expect.objectContaining({ type: 'web-vital', name: 'LCP' })]);
  });

  it('lô bị server từ chối kiểu không retry được (4xx) thì BỎ, không xếp lại hàng đợi', async () => {
    const { tracker, sendBatch, logs, dropped } = setup({ shouldRetry: (error) => (error as { status?: number }).status !== 400 });
    sendBatch.mockRejectedValueOnce({ status: 400 });
    tracker.enqueue({ type: 'web-vital', name: 'LCP', value: 1200, at: new Date().toISOString() });
    await tracker.flush();
    expect(dropped).toHaveLength(1);
    expect(logs.at(-1)).toMatchObject({ ok: false, dropped: true });

    await vi.advanceTimersByTimeAsync(60_000); // không có timer hẹn gửi lại
    await tracker.flush();
    expect(sendBatch).toHaveBeenCalledTimes(1); // hàng đợi trống: lô hỏng không quay lại chặn lô sau
  });

  it('lỗi mạng/5xx (shouldRetry = true) vẫn giữ lô để gửi lại', async () => {
    const { tracker, sendBatch, dropped } = setup({ shouldRetry: () => true });
    sendBatch.mockRejectedValueOnce({ status: 503 });
    tracker.enqueue({ type: 'web-vital', name: 'LCP', value: 1200, at: new Date().toISOString() });
    await tracker.flush();
    await tracker.flush();
    expect(sendBatch).toHaveBeenCalledTimes(2);
    expect(dropped).toHaveLength(0);
  });

  it('dispose: ngắt observer và huỷ timer impression/flush còn treo', async () => {
    const { tracker, addPost, impressed, sendBatch, disconnect } = setup();
    addPost('p1').show(); // timer 1s chờ tính impression
    tracker.enqueue({ type: 'web-vital', name: 'LCP', value: 1, at: new Date().toISOString() }); // hẹn flush 5s
    tracker.dispose();
    expect(disconnect).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(impressed).toEqual([]);
    expect(sendBatch).not.toHaveBeenCalled();
  });
});
