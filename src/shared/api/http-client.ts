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

// 📖 Bài học shared-foundations §3 – ApiError mang status và code để phân loại lỗi (docs/lessons/shared-foundations.md)
// #region learn:http-api-error
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
// #endregion learn:http-api-error

// 📖 Bài học shared-foundations §3 – các tuỳ chọn retry, dedupe, signal của một request (docs/lessons/shared-foundations.md)
// #region learn:http-request-options
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
  /** GET không có signal mặc định được gộp với request giống hệt đang bay; đặt false để luôn gửi request riêng. */
  dedupe?: boolean;
}
// #endregion learn:http-request-options

const SESSION_REFRESH_URL = '/api/session/refresh';

/**
 * Sự kiện của data access layer để UI quan sát (lesson 12 ghi log):
 *   'session-refresh' – vừa làm mới session sau 401; 'request-deduped' – một GET được gộp vào request đang bay.
 */
export const httpClientEvents = new EventTarget();

const BASE_DELAY_MS = 300;
const MAX_DELAY_MS = 5000;

// 📖 Bài học shared-foundations §3 – chỉ retry khi an toàn và lỗi là lỗi tạm thời (docs/lessons/shared-foundations.md)
// #region learn:http-retry-policy
export function isRetryableStatus(status: number) {
  return status === 0 || status === 408 || status === 429 || status >= 500;
}

export function isSafeToRetry(method: string, idempotencyKey: string | undefined) {
  return method === 'GET' || Boolean(idempotencyKey);
}
// #endregion learn:http-retry-policy

// 📖 Bài học shared-foundations §3 – Retry-After hoặc exponential backoff với equal jitter (docs/lessons/shared-foundations.md)
// #region learn:http-backoff-jitter
/**
 * attempt bắt đầu từ 1 (lần retry đầu tiên).
 * Có Retry-After → dùng đúng giá trị server yêu cầu. Không có → backoff luỹ thừa với "equal jitter" (ngẫu nhiên trong nửa trên [n/2, n]).
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
// #endregion learn:http-backoff-jitter

// 📖 Bài học lesson-04 – chờ có thể huỷ bằng AbortSignal (docs/lessons/lesson-04.md)
// #region learn:http-sleep-abortable
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
// #endregion learn:http-sleep-abortable

async function toApiError(response: Response): Promise<ApiError> {
  try {
    const body = (await response.json()) as ApiErrorBody;
    return new ApiError(response.status, body.error.code, body.error.message);
  } catch {
    return new ApiError(response.status, 'HTTP_ERROR', `HTTP ${response.status}`);
  }
}

// 📖 Bài học shared-foundations §4 – epoch đếm số lần refresh để xử lý 401 tới muộn (docs/lessons/shared-foundations.md)
// #region learn:http-session-epoch
const REFRESH_MAX_ATTEMPTS = 3;

/**
 * "Session epoch": đếm số lần làm mới session ĐÃ HOÀN TẤT. Mỗi request ghi lại epoch lúc nó BẮT ĐẦU gửi; nhận 401 mà epoch
 * đã tăng nghĩa là session đã được làm mới sau khi request này rời đi (401 tới muộn) → chỉ cần gửi lại, KHÔNG refresh lần nữa.
 * Single-flight một mình chỉ đúng trong cửa sổ các request trùng nhau; 401 tới sau khi refresh xong sẽ gọi refresh lần hai,
 * mà với refresh-token rotation thật thì token cũ đã bị thu hồi → đăng xuất oan.
 */
let sessionEpoch = 0;
// #endregion learn:http-session-epoch

// 📖 Bài học shared-foundations §4 – refresh retry lỗi tạm thời, chỉ 4xx mới yêu cầu đăng nhập lại (docs/lessons/shared-foundations.md)
// #region learn:http-refresh-with-retry
/**
 * Một lần gọi refresh, có retry cho lỗi TẠM THỜI. Refresh nằm sau middleware mô phỏng lỗi nên có thể nhận 503/mất mạng;
 * đó không có nghĩa phiên đã hết hạn. Chỉ 4xx (server từ chối) mới là "cần đăng nhập lại" → REAUTH_REQUIRED ngay, không retry.
 * Lỗi tạm thời hết lượt thì ném lỗi mang status thật (0 = mạng) để nơi gọi coi như lỗi tạm, không bắt người dùng đăng nhập lại.
 */
async function refreshWithRetry(): Promise<void> {
  for (let attempt = 1; ; attempt += 1) {
    let transient: ApiError;
    let retryAfter: string | null = null;
    try {
      const response = await fetch(SESSION_REFRESH_URL, { method: 'POST', credentials: 'same-origin' });
      if (response.ok) return;
      if (!isRetryableStatus(response.status)) throw new ApiError(401, 'REAUTH_REQUIRED', 'Phiên đăng nhập hết hạn – cần đăng nhập lại');
      transient = new ApiError(response.status, 'SESSION_REFRESH_UNAVAILABLE', 'Server tạm thời không làm mới được phiên đăng nhập');
      retryAfter = response.headers.get('Retry-After');
    } catch (cause) {
      if (cause instanceof ApiError) throw cause;
      transient = new ApiError(0, 'SESSION_REFRESH_UNAVAILABLE', 'Không kết nối được tới server để làm mới phiên đăng nhập');
    }
    if (attempt >= REFRESH_MAX_ATTEMPTS) throw transient;
    await sleep(computeBackoffDelayMs(attempt, retryAfter));
  }
}
// #endregion learn:http-refresh-with-retry

// 📖 Bài học shared-foundations §4 – nhiều request cùng 401 chỉ gọi refresh một lần (docs/lessons/shared-foundations.md)
// #region learn:http-refresh-single-flight
/**
 * Làm mới session KHI GẶP 401 – single-flight: 3 request cùng nhận 401 thì chỉ gọi refresh một lần,
 * cả 3 chờ chung một Promise rồi gửi lại. Refresh bị server từ chối (4xx) → người dùng phải đăng nhập lại.
 * Giới hạn của single-flight: chỉ gộp các request nhận 401 TRONG lúc refresh đang bay – phần còn lại do sessionEpoch lo.
 */
let refreshInFlight: Promise<void> | null = null;
function refreshSessionOnce(): Promise<void> {
  refreshInFlight ??= refreshWithRetry()
    .then(() => {
      sessionEpoch += 1;
      httpClientEvents.dispatchEvent(new Event('session-refresh'));
    })
    .finally(() => {
      refreshInFlight = null;
    });
  return refreshInFlight;
}
// #endregion learn:http-refresh-single-flight

// 📖 Bài học shared-foundations §4 – gộp GET trùng URL đang bay thành một request mạng (docs/lessons/shared-foundations.md)
// #region learn:http-dedupe-get
/**
 * Gộp request trùng (request deduplication): hai component cùng cần GET /api/posts/1 cùng lúc
 * → chỉ 1 request mạng, cả hai nhận chung kết quả. Xong (thành công hay lỗi) thì xoá khỏi map.
 *
 * GIỚI HẠN cần biết:
 *   - Khoá chỉ là URL: caller thứ hai dùng lại request của caller đầu nên KHÔNG nhận onRetry/maxAttempts của mình
 *     (nếu cần tiến độ retry riêng, truyền dedupe:false).
 *   - Đọc-sau-ghi: GET bắt đầu TRƯỚC khi một PUT/POST xong vẫn đang bay; caller gọi GET sau lúc ghi xong sẽ được gộp vào
 *     request cũ và nhận dữ liệu CŨ. Đường đọc ngay sau khi ghi nên đặt dedupe:false.
 *   - Có signal thì không gộp (abort của caller này không được lan sang caller khác).
 */
const inFlightGets = new Map<string, Promise<unknown>>();

export function request<T>(url: string, options: RequestOptions = {}): Promise<T> {
  const canDedupe = (options.method ?? 'GET') === 'GET' && !options.signal && options.dedupe !== false;
  if (!canDedupe) return sendRequest<T>(url, options);
  const existing = inFlightGets.get(url);
  if (existing) {
    httpClientEvents.dispatchEvent(new CustomEvent('request-deduped', { detail: url }));
    return existing as Promise<T>;
  }
  const pending = sendRequest<T>(url, options).finally(() => inFlightGets.delete(url));
  inFlightGets.set(url, pending);
  return pending;
}
// #endregion learn:http-dedupe-get

async function sendRequest<T>(url: string, options: RequestOptions): Promise<T> {
  // 📖 Bài học shared-foundations §3 – dựng body JSON hoặc raw và gắn Idempotency-Key (docs/lessons/shared-foundations.md)
  // #region learn:http-request-body-and-headers
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
  // #endregion learn:http-request-body-and-headers

  // 📖 Bài học shared-foundations §3 – vòng gửi: 401 refresh một lần, lỗi tạm thì backoff rồi gửi lại (docs/lessons/shared-foundations.md)
  // #region learn:http-retry-loop
  const maxAttempts = options.maxAttempts ?? (isSafeToRetry(method, options.idempotencyKey) ? 3 : 1);
  let sessionRefreshed = false;

  // Từng bước mỗi vòng: (1) ghi epoch rồi gửi; (2) thành công thì trả kết quả; (3) lỗi thì đổi thành ApiError;
  // (4) 401 SESSION_EXPIRED thì refresh (hoặc gửi lại luôn nếu epoch đã đổi) mà không tốn lượt retry;
  // (5) hết lượt hoặc lỗi không tạm thời thì ném; (6) còn lượt thì chờ backoff rồi lặp.
  for (let attempt = 1; ; attempt += 1) {
    let error: ApiError;
    let retryAfter: string | null = null;
    const epochAtSend = sessionEpoch; // ghi trước khi gửi: xem chú thích ở sessionEpoch
    try {
      const response = await fetch(url, { method, headers, body, signal: options.signal, credentials: 'same-origin' });
      if (response.status === 204) return undefined as T;
      if (response.ok) return (await response.json()) as T;
      error = await toApiError(response);
      retryAfter = response.headers.get('Retry-After');
    } catch (cause) {
      if (options.signal?.aborted) throw cause;
      error = new ApiError(0, 'NETWORK_ERROR', 'Không kết nối được tới server');
    }

    // 401 SESSION_EXPIRED: làm mới session MỘT lần rồi gửi lại – không tính vào số lần retry vì đây không phải lỗi tạm thời.
    if (error.status === 401 && error.code === 'SESSION_EXPIRED' && !sessionRefreshed && url !== SESSION_REFRESH_URL) {
      if (sessionEpoch === epochAtSend) {
        sessionRefreshed = true;
        await refreshSessionOnce();
      }
      // else: session đã được làm mới sau khi request này rời đi (401 tới muộn) → gửi lại luôn, không refresh lần hai.
      // Lần gửi lại ghi epoch mới nên không thể lặp vô hạn: 401 tiếp theo mà epoch không đổi sẽ đi nhánh refresh ở trên.
      attempt -= 1;
      continue;
    }

    if (attempt >= maxAttempts || !isRetryableStatus(error.status)) throw error;
    const delayMs = computeBackoffDelayMs(attempt, retryAfter);
    options.onRetry?.({ attempt, delayMs, error });
    await sleep(delayMs, options.signal);
  }
}
  // #endregion learn:http-retry-loop

// 📖 Bài học lesson-06 – sinh key một lần khi bấm gửi và giữ qua mọi lần retry (docs/lessons/lesson-06.md)
// #region learn:http-idempotency-key
/** Sinh idempotency key: tạo MỘT LẦN khi người dùng bấm gửi, giữ nguyên qua mọi lần retry. */
export function createIdempotencyKey() {
  return crypto.randomUUID();
}
// #endregion learn:http-idempotency-key
