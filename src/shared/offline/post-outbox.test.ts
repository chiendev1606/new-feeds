import { describe, expect, it } from 'vitest';
import { ApiError } from '../api/http-client';
import type { CreatePostRequest, CreatePostResponse } from '../types/feed-entities';
import type { KeyValueStore } from './indexed-db-store';
import { createPostOutbox, type OutboxEvent, type OutboxItem } from './post-outbox';

/** Store in-memory thay IndexedDB (môi trường test là node). */
function createMemoryStore(): KeyValueStore<OutboxItem> {
  const data = new Map<string, OutboxItem>();
  return {
    get: async (key) => data.get(key),
    put: async (key, value) => void data.set(key, structuredClone(value)),
    delete: async (key) => void data.delete(key),
    getAll: async () => [...data.values()].map((item) => structuredClone(item)),
  };
}

/** Nhường một macrotask: store in-memory chỉ dùng microtask nên flush sẽ chạy tới chỗ chờ `gate`. */
const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
const payloadOf = (text: string): CreatePostRequest => ({ body: { text, entities: [] }, mediaIds: [] });
const responseFor = (text: string) => ({ post: { id: `post-${text}` } }) as unknown as CreatePostResponse;

function setup(send: (payload: CreatePostRequest, key: string) => Promise<CreatePostResponse>) {
  const store = createMemoryStore();
  const events: OutboxEvent[] = [];
  let clock = 0;
  const outbox = createPostOutbox({ store, send, onEvent: (event) => events.push(event), now: () => (clock += 1) });
  return { store, outbox, events };
}

describe('post outbox', () => {
  it('enqueue lưu mục với attempts = 0, giữ thứ tự theo createdAt', async () => {
    const { outbox } = setup(async () => responseFor('x'));
    await outbox.enqueue(payloadOf('một'), 'key-1');
    await outbox.enqueue(payloadOf('hai'), 'key-2');
    const items = await outbox.list();
    expect(items.map((item) => item.idempotencyKey)).toEqual(['key-1', 'key-2']);
    expect(items[0]).toMatchObject({ attempts: 0, lastError: null, state: 'pending' });
  });

  it('flush gửi tuần tự, mỗi mục với đúng idempotency key của nó; 2xx thì xoá', async () => {
    const calls: Array<{ text: string; key: string; inFlight: number }> = [];
    let inFlight = 0;
    const { outbox, events } = setup(async (payload, key) => {
      inFlight += 1;
      calls.push({ text: payload.body.text, key, inFlight });
      await Promise.resolve();
      inFlight -= 1;
      return responseFor(payload.body.text);
    });
    await outbox.enqueue(payloadOf('a'), 'key-a');
    await outbox.enqueue(payloadOf('b'), 'key-b');

    expect(await outbox.flush()).toEqual({ sent: 2, deferred: 0, rejected: 0 });
    expect(calls).toEqual([
      { text: 'a', key: 'key-a', inFlight: 1 },
      { text: 'b', key: 'key-b', inFlight: 1 }, // inFlight luôn 1 → tuần tự
    ]);
    expect(await outbox.list()).toEqual([]);
    expect(events.map((event) => event.kind)).toEqual(['sent', 'sent']);
  });

  it('lỗi mạng: giữ mục, attempts tăng, dừng flush; lần sau gửi lại CÙNG key', async () => {
    const keys: string[] = [];
    let online = false;
    const { outbox } = setup(async (_payload, key) => {
      keys.push(key);
      if (!online) throw new ApiError(0, 'NETWORK_ERROR', 'Không kết nối được tới server');
      return responseFor('a');
    });
    await outbox.enqueue(payloadOf('a'), 'key-a');
    await outbox.enqueue(payloadOf('b'), 'key-b');

    expect(await outbox.flush()).toEqual({ sent: 0, deferred: 1, rejected: 0 });
    expect(keys).toEqual(['key-a']); // mục b không bị gửi chen ngang → giữ thứ tự
    const [first, second] = await outbox.list();
    expect(first).toMatchObject({ idempotencyKey: 'key-a', attempts: 1, state: 'pending', lastError: 'Không kết nối được tới server' });
    expect(second).toMatchObject({ idempotencyKey: 'key-b', attempts: 0 });

    online = true;
    await outbox.flush();
    expect(keys).toEqual(['key-a', 'key-a', 'key-b']); // retry dùng lại đúng key cũ
    expect(await outbox.list()).toEqual([]);
  });

  it('5xx là lỗi tạm: giữ mục, attempts++', async () => {
    const { outbox } = setup(async () => {
      throw new ApiError(503, 'SERVICE_UNAVAILABLE', 'Server bận');
    });
    await outbox.enqueue(payloadOf('a'), 'key-a');
    await outbox.flush();
    await outbox.flush();
    expect((await outbox.list())[0]).toMatchObject({ attempts: 2, state: 'pending', lastError: 'Server bận' });
  });

  it('4xx không retry được: giữ mục kèm lastError, đánh dấu rejected và KHÔNG tự gửi lại', async () => {
    let sendCount = 0;
    const { outbox, events } = setup(async (_payload, key) => {
      sendCount += 1;
      if (key === 'key-bad') throw new ApiError(400, 'VALIDATION_ERROR', 'Nội dung không hợp lệ');
      return responseFor('ok');
    });
    await outbox.enqueue(payloadOf('bad'), 'key-bad');
    await outbox.enqueue(payloadOf('ok'), 'key-ok');

    expect(await outbox.flush()).toEqual({ sent: 1, deferred: 0, rejected: 1 }); // mục sau vẫn được gửi
    const items = await outbox.list();
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ idempotencyKey: 'key-bad', state: 'rejected', lastError: 'Nội dung không hợp lệ', attempts: 1 });
    expect(events.map((event) => event.kind)).toEqual(['rejected', 'sent']);

    await outbox.flush();
    expect(sendCount).toBe(2); // flush lần hai không đụng lại mục rejected
    await outbox.remove('key-bad');
    expect(await outbox.list()).toEqual([]);
  });

  it('gọi flush hai lần đồng thời chỉ gửi một lần mỗi mục', async () => {
    let sendCount = 0;
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => (release = resolve));
    const { outbox } = setup(async (payload) => {
      sendCount += 1;
      await gate;
      return responseFor(payload.body.text);
    });
    await outbox.enqueue(payloadOf('a'), 'key-a');

    const first = outbox.flush();
    const second = outbox.flush();
    expect(second).toBe(first); // cùng một promise
    release();
    const [firstSummary, secondSummary] = await Promise.all([first, second]);
    expect(sendCount).toBe(1);
    expect(firstSummary).toEqual(secondSummary);

    // Xong rồi thì flush mới được phép chạy lại.
    await outbox.enqueue(payloadOf('b'), 'key-b');
    await outbox.flush();
    expect(sendCount).toBe(2);
  });

  it('bỏ mục khi đang gửi và lỗi tạm: mục KHÔNG sống lại', async () => {
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => (release = resolve));
    const { outbox, events } = setup(async () => {
      await gate;
      throw new ApiError(503, 'SERVICE_UNAVAILABLE', 'Server bận');
    });
    await outbox.enqueue(payloadOf('a'), 'key-a');

    const flushing = outbox.flush();
    await tick(); // để flush kịp vào send()
    await outbox.remove('key-a'); // người dùng bấm "Bỏ mục này" khi send còn đang bay
    release();
    await flushing;

    expect(await outbox.list()).toEqual([]);
    expect(events.map((event) => event.kind)).toEqual(['removed-while-sending']);
    expect(events[0]).toMatchObject({ delivered: false });
  });

  it('bỏ mục khi đang gửi và gửi thành công: báo UI gỡ bài tạm, không phát sự kiện sent', async () => {
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => (release = resolve));
    const { outbox, events } = setup(async (payload) => {
      await gate;
      return responseFor(payload.body.text);
    });
    await outbox.enqueue(payloadOf('a'), 'key-a');

    const flushing = outbox.flush();
    await tick(); // để flush kịp vào send()
    await outbox.remove('key-a');
    release();
    expect(await flushing).toEqual({ sent: 0, deferred: 0, rejected: 0 });

    expect(events.map((event) => event.kind)).toEqual(['removed-while-sending']);
    expect(events[0]).toMatchObject({ delivered: true });
    expect(await outbox.list()).toEqual([]);
  });

  it('mục bị bỏ trước lượt của nó trong cùng vòng flush thì không bị gửi', async () => {
    const sentKeys: string[] = [];
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => (release = resolve));
    const { outbox } = setup(async (payload, key) => {
      sentKeys.push(key);
      if (key === 'key-a') await gate;
      return responseFor(payload.body.text);
    });
    await outbox.enqueue(payloadOf('a'), 'key-a');
    await outbox.enqueue(payloadOf('b'), 'key-b');

    const flushing = outbox.flush();
    await tick(); // để flush kịp vào send()
    await outbox.remove('key-b');
    release();
    await flushing;
    expect(sentKeys).toEqual(['key-a']);
  });
});
