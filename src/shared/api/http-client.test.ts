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

describe('gộp request trùng (dedupe)', () => {
  const okJson = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });

  it('2 GET cùng URL cùng lúc → 1 request mạng, cùng kết quả', async () => {
    const fetchMock = vi.fn().mockImplementation(() => new Promise((resolve) => setTimeout(() => resolve(okJson({ id: 1 })), 5)));
    vi.stubGlobal('fetch', fetchMock);
    const [a, b] = await Promise.all([request('/api/posts/1'), request('/api/posts/1')]);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(a).toEqual(b);
  });

  it('xong rồi thì request sau gửi mới; dedupe:false luôn gửi riêng', async () => {
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(okJson({ ok: true })));
    vi.stubGlobal('fetch', fetchMock);
    await request('/api/posts/2');
    await request('/api/posts/2');
    await Promise.all([request('/api/posts/3', { dedupe: false }), request('/api/posts/3', { dedupe: false })]);
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });
});

describe('401 SESSION_EXPIRED → làm mới session một lần', () => {
  const expired = () => new Response(JSON.stringify({ error: { code: 'SESSION_EXPIRED', message: 'x' } }), { status: 401, headers: { 'content-type': 'application/json' } });
  const ok = () => new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'content-type': 'application/json' } });

  it('3 request đồng thời nhận 401 → đúng 1 lần refresh, cả 3 gửi lại thành công', async () => {
    let refreshed = false;
    const fetchMock = vi.fn().mockImplementation(async (url: string) => {
      if (url === '/api/session/refresh') {
        await new Promise((resolve) => setTimeout(resolve, 5));
        refreshed = true;
        return ok();
      }
      return refreshed ? ok() : expired();
    });
    vi.stubGlobal('fetch', fetchMock);
    const results = await Promise.all([request('/api/a', { dedupe: false }), request('/api/b', { method: 'POST', body: {} }), request('/api/c', { method: 'DELETE' })]);
    expect(results).toEqual([{ ok: true }, { ok: true }, { ok: true }]);
    expect(fetchMock.mock.calls.filter(([url]) => url === '/api/session/refresh')).toHaveLength(1);
  });

  it('refresh thất bại → ApiError REAUTH_REQUIRED', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async (url: string) => (url === '/api/session/refresh' ? new Response('', { status: 401 }) : expired())));
    await expect(request('/api/a')).rejects.toMatchObject({ status: 401, code: 'REAUTH_REQUIRED' });
  });

  it('401 tới MUỘN (request gửi trước khi refresh xong) → gửi lại luôn, không refresh lần hai', async () => {
    let refreshed = false;
    let slowCalls = 0;
    let releaseSlow: () => void = () => {};
    const slowGate = new Promise<void>((resolve) => (releaseSlow = resolve));
    const fetchMock = vi.fn().mockImplementation(async (url: string) => {
      if (url === '/api/session/refresh') {
        refreshed = true;
        return ok();
      }
      if (url === '/api/slow') {
        slowCalls += 1;
        if (slowCalls > 1) return ok(); // lần gửi lại: session hợp lệ
        await slowGate; // lần đầu: 401 chỉ tới SAU khi refresh của request khác đã xong
        return expired();
      }
      return refreshed ? ok() : expired();
    });
    vi.stubGlobal('fetch', fetchMock);

    const slow = request('/api/slow', { dedupe: false }); // gửi trước, 401 tới muộn
    await request('/api/fast', { dedupe: false }); // 401 ngay → refresh → xong
    expect(fetchMock.mock.calls.filter(([url]) => url === '/api/session/refresh')).toHaveLength(1);

    releaseSlow();
    await expect(slow).resolves.toEqual({ ok: true });
    expect(slowCalls).toBe(2);
    expect(fetchMock.mock.calls.filter(([url]) => url === '/api/session/refresh')).toHaveLength(1); // vẫn chỉ 1
  });

  it('refresh gặp 503 rồi thành công → retry refresh, KHÔNG báo REAUTH_REQUIRED', async () => {
    vi.useFakeTimers();
    let refreshCalls = 0;
    const fetchMock = vi.fn().mockImplementation(async (url: string) => {
      if (url === '/api/session/refresh') {
        refreshCalls += 1;
        return refreshCalls < 3 ? new Response('', { status: 503, headers: { 'Retry-After': '0' } }) : ok();
      }
      return refreshCalls >= 3 ? ok() : expired();
    });
    vi.stubGlobal('fetch', fetchMock);
    const pending = request('/api/a', { dedupe: false });
    await vi.runAllTimersAsync();
    await expect(pending).resolves.toEqual({ ok: true });
    expect(refreshCalls).toBe(3);
  });

  it('refresh lỗi tạm thời hết lượt → ném lỗi mang status thật (không phải REAUTH_REQUIRED)', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockImplementation(async (url: string) => (url === '/api/session/refresh' ? new Response('', { status: 503, headers: { 'Retry-After': '0' } }) : expired()));
    vi.stubGlobal('fetch', fetchMock);
    const pending = request('/api/a', { dedupe: false });
    const assertion = expect(pending).rejects.toMatchObject({ status: 503, code: 'SESSION_REFRESH_UNAVAILABLE' });
    await vi.runAllTimersAsync();
    await assertion;
    expect(fetchMock.mock.calls.filter(([url]) => url === '/api/session/refresh')).toHaveLength(3);
  });

  it('refresh bị server từ chối (403) → REAUTH_REQUIRED ngay, không retry', async () => {
    const fetchMock = vi.fn().mockImplementation(async (url: string) => (url === '/api/session/refresh' ? new Response('', { status: 403 }) : expired()));
    vi.stubGlobal('fetch', fetchMock);
    await expect(request('/api/a', { dedupe: false })).rejects.toMatchObject({ code: 'REAUTH_REQUIRED' });
    expect(fetchMock.mock.calls.filter(([url]) => url === '/api/session/refresh')).toHaveLength(1);
  });
});
