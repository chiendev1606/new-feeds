/**
 * Các hàm gọi API của feed – "Interface" nhìn từ phía client.
 * Mọi hàm trả đúng type trong shared-contracts, nên server đổi hợp đồng là TypeScript báo lỗi ngay.
 */
import type {
  SessionInfo,
  SinglePostResponse,
  TelemetryBatchRequest,
  TelemetrySummaryResponse,
  CreatePostRequest,
  CreatePostResponse,
  FeedDirection,
  MediaUploadResponse,
  NormalizedFeedResponse,
  OffsetFeedResponse,
  ReactionResponse,
  ReactionType,
} from '../types/feed-entities';
import { ApiError, request, type RequestOptions } from './http-client';

// 📖 Bài học shared-foundations §2 – client gọi trang feed bằng cursor và direction (docs/lessons/shared-foundations.md)
// #region learn:feed-api-fetch-page
export interface FetchFeedPageParams {
  count: number;
  cursor?: string | null;
  direction?: FeedDirection;
  signal?: AbortSignal;
  onRetry?: RequestOptions['onRetry'];
}

export function fetchFeedPage({ count, cursor, direction = 'older', signal, onRetry }: FetchFeedPageParams) {
  const params = new URLSearchParams({ count: String(count), direction });
  if (cursor) params.set('cursor', cursor);
  return request<NormalizedFeedResponse>(`/api/feed?${params}`, { signal, onRetry });
}
// #endregion learn:feed-api-fetch-page

export function fetchFeedPageByOffset(offset: number, count: number) {
  return request<OffsetFeedResponse>(`/api/feed-offset?offset=${offset}&count=${count}`);
}

// 📖 Bài học lesson-05 – reaction không tự retry để thấy rollback (docs/lessons/lesson-05.md)
// #region learn:feed-api-set-reaction
/**
 * Reaction KHÔNG retry tự động (maxAttempts: 1) để lesson 05 thấy rõ rollback khi lỗi.
 * Thực tế PUT/DELETE idempotent nên có thể retry an toàn.
 */
export function setReaction(postId: string, reaction: ReactionType) {
  return request<ReactionResponse>(`/api/posts/${encodeURIComponent(postId)}/reaction`, {
    method: 'PUT',
    body: { reaction },
    maxAttempts: 1,
  });
}
// #endregion learn:feed-api-set-reaction

export function removeReaction(postId: string) {
  return request<ReactionResponse>(`/api/posts/${encodeURIComponent(postId)}/reaction`, { method: 'DELETE', maxAttempts: 1 });
}

// 📖 Bài học lesson-06 – upload ảnh bằng body raw kèm kích thước trong header (docs/lessons/lesson-06.md)
// #region learn:feed-api-upload-media
export interface UploadMediaParams {
  file: Blob;
  width: number;
  height: number;
  alt: string;
}

export function uploadMedia({ file, width, height, alt }: UploadMediaParams) {
  return request<MediaUploadResponse>('/api/media/uploads', {
    method: 'POST',
    body: file,
    headers: {
      'Content-Type': file.type || 'application/octet-stream',
      'X-Image-Width': String(width),
      'X-Image-Height': String(height),
      'X-Image-Alt': encodeURIComponent(alt),
    },
  });
}
// #endregion learn:feed-api-upload-media

// 📖 Bài học lesson-06 – tạo bài luôn kèm idempotency key (docs/lessons/lesson-06.md)
// #region learn:feed-api-create-post
export function createPost(payload: CreatePostRequest, idempotencyKey: string, onRetry?: RequestOptions['onRetry']) {
  return request<CreatePostResponse>('/api/posts', { method: 'POST', body: payload, idempotencyKey, onRetry });
}
// #endregion learn:feed-api-create-post

export function fetchPost(postId: string, signal?: AbortSignal) {
  return request<SinglePostResponse>(`/api/posts/${encodeURIComponent(postId)}`, { signal });
}

// 📖 Bài học lesson-11 – gửi telemetry bằng fetch keepalive và phân loại lỗi (docs/lessons/lesson-11.md)
// #region learn:feed-api-send-telemetry
/**
 * Gửi lô telemetry bằng fetch + keepalive (request vẫn được gửi dù trang đang đóng).
 * Khi trang bị ẩn/đóng, lesson 11 dùng navigator.sendBeacon thay vì hàm này.
 */
export async function sendTelemetry(batch: TelemetryBatchRequest) {
  const response = await fetch('/api/telemetry', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(batch), keepalive: true, credentials: 'same-origin' });
  // Ném ApiError mang status để hàng đợi telemetry phân loại: lỗi mạng/5xx/408/429 → giữ lô gửi lại; 4xx khác → lô sai, bỏ.
  // (Lỗi mạng của fetch ném TypeError, không phải ApiError → coi là lỗi tạm thời.)
  if (!response.ok) throw new ApiError(response.status, 'TELEMETRY_REJECTED', `Gửi telemetry thất bại: HTTP ${response.status}`);
}
// #endregion learn:feed-api-send-telemetry

export const getTelemetrySummary = () => request<TelemetrySummaryResponse>('/api/telemetry/summary');

export const getSession = () => request<SessionInfo>('/api/session/me');

/** Không retry: nếu làm mới session thất bại, người dùng phải đăng nhập lại. */
export const refreshSession = () => request<SessionInfo>('/api/session/refresh', { method: 'POST', maxAttempts: 1 });
