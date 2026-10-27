import { describe, expect, it } from 'vitest';
import { formatCommentCount, formatCompactCount } from './format-compact-count';
import { formatRelativeTime } from './format-relative-time';

const NOW = Date.parse('2026-10-27T12:00:00.000Z');
const ago = (seconds: number) => new Date(NOW - seconds * 1000).toISOString();

describe('formatRelativeTime', () => {
  it('dưới 45 giây → "now"', () => {
    expect(formatRelativeTime(ago(10), NOW, 'en')).toBe('now');
  });

  it('phút / giờ / ngày', () => {
    expect(formatRelativeTime(ago(5 * 60), NOW, 'en')).toBe('5 minutes ago');
    expect(formatRelativeTime(ago(3 * 3600), NOW, 'en')).toBe('3 hours ago');
    expect(formatRelativeTime(ago(86_400), NOW, 'en')).toBe('yesterday');
  });

  it('quá 7 ngày → ngày cụ thể', () => {
    expect(formatRelativeTime(ago(30 * 86_400), NOW, 'en')).toMatch(/Sep/);
  });

  it('đổi locale là đổi ngôn ngữ', () => {
    expect(formatRelativeTime(ago(5 * 60), NOW, 'vi')).toContain('phút');
  });
});

describe('formatCompactCount / formatCommentCount', () => {
  it('103000 → 103K (en)', () => {
    expect(formatCompactCount(103_000, 'en')).toBe('103K');
    expect(formatCompactCount(1_250_000, 'en')).toBe('1.3M');
  });

  it('plural rules tiếng Anh', () => {
    expect(formatCommentCount(1, 'en')).toBe('1 comment');
    expect(formatCommentCount(2, 'en')).toBe('2 comments');
  });

  it('tiếng Việt không có số nhiều', () => {
    expect(formatCommentCount(1, 'vi')).toBe('1 bình luận');
    expect(formatCommentCount(5, 'vi')).toBe('5 bình luận');
  });
});
