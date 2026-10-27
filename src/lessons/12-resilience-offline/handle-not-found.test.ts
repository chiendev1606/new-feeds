import { describe, expect, it } from 'vitest';
import { ApiError } from '../../shared/api/http-client';
import type { SinglePostResponse } from '../../shared/types/feed-entities';
import { isNotFoundError, loadPostDetail } from './handle-not-found';

const fakeResponse = { post: { id: 'post-1' }, users: {}, media: {} } as unknown as SinglePostResponse;

describe('loadPostDetail', () => {
  it('2xx → ok kèm dữ liệu', async () => {
    expect(await loadPostDetail('post-1', async () => fakeResponse)).toEqual({ kind: 'ok', data: fakeResponse });
  });

  it('404 → gone (trạng thái bình thường, không phải lỗi)', async () => {
    const result = await loadPostDetail('post-1', async () => {
      throw new ApiError(404, 'POST_NOT_FOUND', 'Không tìm thấy bài viết');
    });
    expect(result).toEqual({ kind: 'gone' });
  });

  it('lỗi khác (5xx, mạng) → error kèm message', async () => {
    const result = await loadPostDetail('post-1', async () => {
      throw new ApiError(503, 'SERVICE_UNAVAILABLE', 'Server bận');
    });
    expect(result).toEqual({ kind: 'error', message: 'Server bận' });
  });
});

describe('isNotFoundError', () => {
  it('chỉ ApiError 404', () => {
    expect(isNotFoundError(new ApiError(404, 'X', 'x'))).toBe(true);
    expect(isNotFoundError(new ApiError(400, 'X', 'x'))).toBe(false);
    expect(isNotFoundError(new Error('404'))).toBe(false);
  });
});
