import { describe, expect, it } from 'vitest';
import { decodeCursor, encodeCursor } from './feed-cursor-codec.js';
import { HttpError } from './http-error.js';

describe('feed-cursor-codec', () => {
  it('encode rồi decode trả lại đúng payload', () => {
    const payload = { createdAt: '2026-10-27T10:00:00.000Z', id: 'post-0042', generation: 3 };
    expect(decodeCursor(encodeCursor(payload))).toEqual(payload);
  });

  it('cursor là chuỗi base64url mờ, không lộ JSON thô', () => {
    const cursor = encodeCursor({ createdAt: 'x', id: 'y', generation: 1 });
    expect(cursor).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('cursor hỏng → HttpError 400 INVALID_CURSOR', () => {
    const badDate = Buffer.from(JSON.stringify(['khong-phai-ngay', 'post-1', 1])).toString('base64url');
    for (const bad of ['not-a-cursor', Buffer.from('{"a":1}').toString('base64url'), '', badDate]) {
      try {
        decodeCursor(bad);
        expect.unreachable();
      } catch (error) {
        expect(error).toBeInstanceOf(HttpError);
        expect((error as HttpError).status).toBe(400);
        expect((error as HttpError).code).toBe('INVALID_CURSOR');
      }
    }
  });
});
