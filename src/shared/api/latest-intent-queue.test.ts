import { describe, expect, it } from 'vitest';
import { LatestIntentQueue } from './latest-intent-queue';

/** Promise có thể resolve từ bên ngoài – để điều khiển thời điểm "request" xong. */
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => (resolve = done));
  return { promise, resolve };
}

describe('LatestIntentQueue', () => {
  it('cùng khoá: chạy tuần tự, các ý định trung gian bị gộp, chỉ ý định cuối được chạy tiếp', async () => {
    const queue = new LatestIntentQueue<string>();
    const ran: string[] = [];
    const gate = deferred();
    const run = async (intent: string) => {
      ran.push(intent);
      if (intent === 'a') await gate.promise;
    };

    const first = queue.submit('post-1', 'a', run);
    expect(await queue.submit('post-1', 'b', run)).toBe(false);
    expect(await queue.submit('post-1', 'c', run)).toBe(false);
    gate.resolve();
    expect(await first).toBe(true);
    expect(ran).toEqual(['a', 'c']);
  });

  it('khác khoá: chạy độc lập', async () => {
    const queue = new LatestIntentQueue<string>();
    const ran: string[] = [];
    await Promise.all([queue.submit('p1', 'x', async (i) => void ran.push(i)), queue.submit('p2', 'y', async (i) => void ran.push(i))]);
    expect(ran.sort()).toEqual(['x', 'y']);
  });

  it('run ném lỗi vẫn giải phóng khoá – lần sau chạy được ngay', async () => {
    const queue = new LatestIntentQueue<string>();
    await expect(queue.submit('p1', 'boom', async () => Promise.reject(new Error('x')))).rejects.toThrow('x');
    expect(await queue.submit('p1', 'ok', async () => undefined)).toBe(true);
  });
});
