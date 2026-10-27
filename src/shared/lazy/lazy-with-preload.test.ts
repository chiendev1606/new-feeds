import { afterEach, describe, expect, it, vi } from 'vitest';
import { lazyWithPreload, preloadOnIdle } from './lazy-with-preload';

const Dummy = () => null;

describe('lazyWithPreload', () => {
  it('preload() gọi factory đúng 1 lần dù gọi nhiều lần và trả cùng một promise', async () => {
    const factory = vi.fn(() => Promise.resolve({ default: Dummy }));
    const Lazy = lazyWithPreload(factory);
    expect(factory).not.toHaveBeenCalled(); // chưa ai cần → chưa tải
    const first = Lazy.preload();
    const second = Lazy.preload();
    expect(second).toBe(first);
    expect(factory).toHaveBeenCalledTimes(1);
    await expect(first).resolves.toEqual({ default: Dummy });
  });

  it('nếu tải lỗi thì preload lần sau thử lại factory', async () => {
    const factory = vi
      .fn<() => Promise<{ default: typeof Dummy }>>()
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce({ default: Dummy });
    const Lazy = lazyWithPreload(factory);
    await expect(Lazy.preload()).rejects.toThrow('network');
    await Promise.resolve(); // chờ handler catch reset promise
    await expect(Lazy.preload()).resolves.toEqual({ default: Dummy });
    expect(factory).toHaveBeenCalledTimes(2);
  });
});

describe('preloadOnIdle', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('dùng setTimeout khi không có requestIdleCallback và huỷ được', () => {
    vi.useFakeTimers();
    vi.stubGlobal('requestIdleCallback', undefined);
    const task = vi.fn();
    const cancel = preloadOnIdle(task);
    cancel();
    vi.runAllTimers();
    expect(task).not.toHaveBeenCalled();
    preloadOnIdle(task);
    vi.runAllTimers();
    expect(task).toHaveBeenCalledTimes(1);
  });

  it('dùng requestIdleCallback khi có', () => {
    const request = vi.fn(() => 7);
    const cancelFn = vi.fn();
    vi.stubGlobal('requestIdleCallback', request);
    vi.stubGlobal('cancelIdleCallback', cancelFn);
    const cancel = preloadOnIdle(() => undefined);
    expect(request).toHaveBeenCalledTimes(1);
    cancel();
    expect(cancelFn).toHaveBeenCalledWith(7);
  });
});
