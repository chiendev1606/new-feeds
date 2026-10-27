import { describe, expect, it } from 'vitest';
import type { TextEntity } from '../types/feed-entities';
import { splitTextByEntities, toSafeHref } from './render-post-body-with-entities';

describe('splitTextByEntities', () => {
  it('cắt đúng theo offset UTF-16, kể cả khi có emoji phía trước', () => {
    const text = 'Cà phê ☕🚀 cùng @Lan #saigon';
    const mentionStart = text.indexOf('@');
    const hashtagStart = text.indexOf('#');
    const entities: TextEntity[] = [
      { type: 'hashtag', start: hashtagStart, end: text.length, tag: 'saigon' },
      { type: 'mention', start: mentionStart, end: mentionStart + 4, userId: 'u1' },
    ];
    const segments = splitTextByEntities(text, entities);
    expect(segments.map((segment) => segment.text)).toEqual(['Cà phê ☕🚀 cùng ', '@Lan', ' ', '#saigon']);
    expect(segments.map((segment) => segment.text).join('')).toBe(text);
  });

  it('entity chồng lấn hoặc vượt biên bị bỏ qua, text không mất', () => {
    const text = 'abcdef';
    const segments = splitTextByEntities(text, [
      { type: 'hashtag', start: 0, end: 3, tag: 'x' },
      { type: 'hashtag', start: 2, end: 4, tag: 'overlap' },
      { type: 'hashtag', start: 4, end: 99, tag: 'outside' },
    ]);
    expect(segments.map((segment) => segment.text).join('')).toBe(text);
    expect(segments.filter((segment) => segment.kind === 'entity')).toHaveLength(1);
  });
});

describe('toSafeHref', () => {
  it('cho phép http/https/mailto', () => {
    expect(toSafeHref('https://example.com/a')).toBe('https://example.com/a');
    expect(toSafeHref('mailto:a@b.c')).toBe('mailto:a@b.c');
  });

  it('chặn javascript:, data:, URL hỏng', () => {
    expect(toSafeHref('javascript:alert(1)')).toBeNull();
    expect(toSafeHref('JaVaScRiPt:alert(1)')).toBeNull();
    expect(toSafeHref('data:text/html,<script>alert(1)</script>')).toBeNull();
    expect(toSafeHref('not a url')).toBeNull();
  });
});
