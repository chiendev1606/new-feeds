/**
 * DATA ACCESS LAYER – lớp duy nhất biết về HTTP.
 * View/Store không gọi fetch trực tiếp; chúng gọi các hàm trong feed-api.ts.
 *
 * Chính sách retry (theo bài):
 * - Chỉ retry khi AN TOÀN: request GET, hoặc request có Idempotency-Key.
 * - Chỉ retry lỗi tạm thời: mất mạng, 408, 429, 5xx.
 * - Exponential backoff + jitter (tránh mọi client cùng retry một lúc → "thundering herd").
 * - Tôn trọng header Retry-After của server.
 * - Có giới hạn số lần thử.
 */
import type { ApiErrorBody } from '../types/feed-entities';
import { IDEMPOTENCY_KEY_HEADER } from '../types/feed-entities';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  /** Object → gửi JSON; Blob/ArrayBuffer → gửi raw. */
  body?: unknown;
  headers?: Record<string, string>;
  idempotencyKey?: string;
  signal?: AbortSignal;
  /** Số lần thử tối đa (gồm lần đầu). Mặc định 3 nếu request an toàn để retry, ngược lại 1. */
  maxAttempts?: number;
  /** Callback để UI hiển thị "đang thử lại lần N". */
  onRetry?: (info: { attempt: number; delayMs: number; error: ApiError }) => void;
}

const BASE_DELAY_MS = 300;
const MAX_DELAY_MS = 5000;

export function isRetryableStatus(status: number) {
  return status === 0 || status === 408 || status === 429 || status >= 500;
}

export function isSafeToRetry(method: string, idempotencyKey: string | undefined) {
  return method === 'GET' || Boolean(idempotencyKey);
}

/**
 * attempt bắt đầu từ 1 (lần retry đầu tiên).
 * Có Retry-After → dùng đúng giá trị server yêu cầu. Không có → backoff luỹ thừa với "full jitter".
 */
export function computeBackoffDelayMs(attempt: number, retryAfterHeader: string | null, random: () => number = Math.random): number {
  if (retryAfterHeader) {
    const seconds = Number(retryAfterHeader);
    if (Number.isFinite(seconds) && seconds >= 0) return Math.min(MAX_DELAY_MS, seconds * 1000);
    const date = Date.parse(retryAfterHeader);
    if (!Number.isNaN(date)) return Math.min(MAX_DELAY_MS, Math.max(0, date - Date.now()));
  }
  const exponential = Math.min(MAX_DELAY_MS, BASE_DELAY_MS * 2 ** (attempt - 1));
  return Math.round(exponential / 2 + random() * (exponential / 2));
}

function sleep(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason);
    const onAbort = () => {
      clearTimeout(timer);
      reject(signal!.reason);
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

async function toApiError(response: Response): Promise<ApiError> {
  try {
    const body = (await response.json()) as ApiErrorBody;
    return new ApiError(response.status, body.error.code, body.error.message);
  } catch {
    return new ApiError(response.status, 'HTTP_ERROR', `HTTP ${response.status}`);
  }
}

export async function request<T>(url: string, options: RequestOptions = {}): Promise<T> {
  const method = options.method ?? 'GET';
  const headers: Record<string, string> = { ...options.headers };
  let body: BodyInit | undefined;
  if (options.body instanceof Blob || options.body instanceof ArrayBuffer) {
    body = options.body;
  } else if (options.body !== undefined) {
    body = JSON.stringify(options.body);
    headers['Content-Type'] = 'application/json';
  }
  if (options.idempotencyKey) headers[IDEMPOTENCY_KEY_HEADER] = options.idempotencyKey;

  const maxAttempts = options.maxAttempts ?? (isSafeToRetry(method, options.idempotencyKey) ? 3 : 1);

  for (let attempt = 1; ; attempt += 1) {
    let error: ApiError;
    let retryAfter: string | null = null;
    try {
      const response = await fetch(url, { method, headers, body, signal: options.signal, credentials: 'same-origin' });
      if (response.ok) return (await response.json()) as T;
      error = await toApiError(response);
      retryAfter = response.headers.get('Retry-After');
    } catch (cause) {
      if (options.signal?.aborted) throw cause;
      error = new ApiError(0, 'NETWORK_ERROR', 'Không kết nối được tới server');
    }

    if (attempt >= maxAttempts || !isRetryableStatus(error.status)) throw error;
    const delayMs = computeBackoffDelayMs(attempt, retryAfter);
    options.onRetry?.({ attempt, delayMs, error });
    await sleep(delayMs, options.signal);
  }
}

/** Sinh idempotency key: tạo MỘT LẦN khi người dùng bấm gửi, giữ nguyên qua mọi lần retry. */
export function createIdempotencyKey() {
  return crypto.randomUUID();
}
