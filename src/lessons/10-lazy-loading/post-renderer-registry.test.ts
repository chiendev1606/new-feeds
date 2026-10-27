import { describe, expect, it } from 'vitest';
import type { Post } from '../../shared/types/feed-entities';
import { getPostKind, POST_RENDERERS, preloadRenderersFor } from './post-renderer-registry';

const base = (override: Partial<Pick<Post, 'mediaIds' | 'body'>>): Pick<Post, 'mediaIds' | 'body'> => ({ mediaIds: [], body: { text: 'x', entities: [] }, ...override });

describe('getPostKind', () => {
  it('có ảnh → photo (kể cả khi có link)', () => {
    expect(getPostKind(base({ mediaIds: ['m1'] }))).toBe('photo');
    expect(getPostKind(base({ mediaIds: ['m1'], body: { text: 'https://a.io', entities: [{ type: 'link', start: 0, end: 12, url: 'https://a.io' }] } }))).toBe('photo');
  });

  it('không ảnh nhưng có link → link', () => {
    expect(getPostKind(base({ body: { text: 'https://a.io', entities: [{ type: 'link', start: 0, end: 12, url: 'https://a.io' }] } }))).toBe('link');
  });

  it('còn lại → text (mention/hashtag không đổi loại)', () => {
    expect(getPostKind(base({}))).toBe('text');
    expect(getPostKind(base({ body: { text: '#a', entities: [{ type: 'hashtag', start: 0, end: 2, tag: 'a' }] } }))).toBe('text');
  });
});

describe('POST_RENDERERS', () => {
  it('có renderer cho mọi loại và mỗi renderer có preload()', () => {
    for (const kind of ['photo', 'link', 'text'] as const) expect(typeof POST_RENDERERS[kind].preload).toBe('function');
  });
});

describe('preloadRenderersFor', () => {
  it('chỉ tải loại có trong trang, mỗi loại một lần', async () => {
    const before = POST_RENDERERS.text.preload();
    await preloadRenderersFor([base({}), base({}), base({})]);
    expect(POST_RENDERERS.text.preload()).toBe(before); // cùng promise → không tải lại
  });
});
