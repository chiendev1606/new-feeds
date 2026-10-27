import { describe, expect, it } from 'vitest';
import { isFeedStale } from './use-stale-feed-prompt';

describe('isFeedStale', () => {
  it('chưa tải lần nào → không cũ', () => {
    expect(isFeedStale(null, 1_000_000, 30_000)).toBe(false);
  });

  it('chỉ cũ khi vượt NGƯỠNG (bằng ngưỡng chưa tính)', () => {
    expect(isFeedStale(1000, 31_000, 30_000)).toBe(false);
    expect(isFeedStale(1000, 31_001, 30_000)).toBe(true);
  });

  it('đổi ngưỡng thì kết quả đổi theo', () => {
    expect(isFeedStale(0, 60_000, 120_000)).toBe(false);
    expect(isFeedStale(0, 60_000, 30_000)).toBe(true);
  });
});
