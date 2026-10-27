import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, computeBackoffDelayMs, isRetryableStatus, isSafeToRetry, request } from './http-client';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('computeBackoffDelayMs', () => {
  it('có Retry-After (giây) → dùng đúng giá trị đó', () => {
    expect(computeBackoffDelayMs(1, '2')).toBe(2000);
  });

  it('không có Retry-After → luỹ thừa 2, có jitter trong [n/2, n]', () => {
    expect(computeBackoffDelayMs(1, null, () => 0)).toBe(150);
    expect(computeBackoffDelayMs(1, null, () => 1)).toBe(300);
    expect(computeBackoffDelayMs(3, null, () => 1)).toBe(1200);
  });

  it('bị chặn trên bởi 5s', () => {
    expect(computeBackoffDelayMs(20, null, () => 1)).toBe(5000);
    expect(computeBackoffDelayMs(1, '999')).toBe(5000);
  });
});

describe('chính sách retry', () => {
  it('chỉ retry lỗi tạm thời', () => {
    expect(isRetryableStatus(0)).toBe(true);
    expect(isRetryableStatus(503)).toBe(true);
    expect(isRetryableStatus(429)).toBe(true);
    expect(isRetryableStatus(400)).toBe(false);
    expect(isRetryableStatus(404)).toBe(false);
  });

  it('chỉ retry khi an toàn: GET hoặc có idempotency key', () => {
    expect(isSafeToRetry('GET', undefined)).toBe(true);
    expect(isSafeToRetry('POST', undefined)).toBe(false);
    expect(isSafeToRetry('POST', 'key')).toBe(true);
  });
});

describe('request()', () => {
  const jsonResponse = (status: number, body: unknown, headers: Record<string, string> = {}) =>
    new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });

  it('GET lỗi 503 rồi thành công → retry và trả dữ liệu', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(503, { error: { code: 'X', message: 'x' } }, { 'Retry-After': '0' }))
      .mockResolvedValueOnce(jsonResponse(200, { ok: true }));
    vi.stubGlobal('fetch', fetchMock);
    const onRetry = vi.fn();
    await expect(request('/api/x', { onRetry })).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('POST không có idempotency key → KHÔNG retry', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(503, { error: { code: 'X', message: 'x' } }, { 'Retry-After': '0' }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(request('/api/x', { method: 'POST', body: {} })).rejects.toBeInstanceOf(ApiError);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('POST có idempotency key → retry, gửi cùng một key mọi lần', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(503, { error: { code: 'X', message: 'x' } }, { 'Retry-After': '0' }))
      .mockResolvedValueOnce(jsonResponse(201, { id: 1 }));
    vi.stubGlobal('fetch', fetchMock);
    await request('/api/posts', { method: 'POST', body: {}, idempotencyKey: 'k-1' });
    const keys = fetchMock.mock.calls.map(([, init]) => (init as RequestInit & { headers: Record<string, string> }).headers['Idempotency-Key']);
    expect(keys).toEqual(['k-1', 'k-1']);
  });

  it('lỗi 400 → không retry, ném ApiError có code từ server', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(400, { error: { code: 'INVALID_CURSOR', message: 'bad' } })));
    await expect(request('/api/feed')).rejects.toMatchObject({ status: 400, code: 'INVALID_CURSOR' });
  });
});
