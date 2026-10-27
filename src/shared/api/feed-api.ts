/**
 * Các hàm gọi API của feed – "Interface" nhìn từ phía client.
 * Mọi hàm trả đúng type trong shared-contracts, nên server đổi hợp đồng là TypeScript báo lỗi ngay.
 */
import type {
  CreatePostRequest,
  CreatePostResponse,
  FeedDirection,
  MediaUploadResponse,
  NormalizedFeedResponse,
  OffsetFeedResponse,
  ReactionResponse,
  ReactionType,
} from '../types/feed-entities';
import { request, type RequestOptions } from './http-client';

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

export function fetchFeedPageByOffset(offset: number, count: number) {
  return request<OffsetFeedResponse>(`/api/feed-offset?offset=${offset}&count=${count}`);
}

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

export function removeReaction(postId: string) {
  return request<ReactionResponse>(`/api/posts/${encodeURIComponent(postId)}/reaction`, { method: 'DELETE', maxAttempts: 1 });
}

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

export function createPost(payload: CreatePostRequest, idempotencyKey: string, onRetry?: RequestOptions['onRetry']) {
  return request<CreatePostResponse>('/api/posts', { method: 'POST', body: payload, idempotencyKey, onRetry });
}
