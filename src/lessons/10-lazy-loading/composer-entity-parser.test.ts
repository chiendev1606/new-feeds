import { describe, expect, it } from 'vitest';
import type { TextEntity } from '../../shared/types/feed-entities';
import { buildUsersByHandle, parseComposerText } from './composer-entity-parser';

const users = { an1: { id: 'user-1' }, binh2: { id: 'user-2' } };

/** Quy tắc server: đúng phạm vi, không chồng lấn, offset UTF-16 trên text. */
function expectServerValid(text: string, entities: TextEntity[]) {
  expect(text).toBe(text.normalize('NFC'));
  const sorted = [...entities].sort((a, b) => a.start - b.start);
  sorted.forEach((entity, index) => {
    expect(entity.start).toBeGreaterThanOrEqual(0);
    expect(entity.end).toBeGreaterThan(entity.start);
    expect(entity.end).toBeLessThanOrEqual(text.length);
    if (index > 0) expect(entity.start).toBeGreaterThanOrEqual(sorted[index - 1]!.end);
  });
}

describe('parseComposerText', () => {
  it('tìm mention và hashtag với offset đúng', () => {
    const { text, entities } = parseComposerText('Chào @an1 #frontend', users);
    expect(entities).toEqual([
      { type: 'mention', start: 5, end: 9, userId: 'user-1' },
      { type: 'hashtag', start: 10, end: 19, tag: 'frontend' },
    ]);
    expect(text.slice(5, 9)).toBe('@an1');
    expectServerValid(text, entities);
  });

  it('emoji (2 code unit UTF-16) đứng trước entity vẫn cho offset đúng', () => {
    const { text, entities } = parseComposerText('☕😊 @binh2 #cà_phê', users);
    expect(entities).toHaveLength(2);
    for (const entity of entities) {
      expect(text.slice(entity.start, entity.end)).toMatch(/^[@#]/);
    }
    expect(text.slice(entities[0]!.start, entities[0]!.end)).toBe('@binh2');
    expectServerValid(text, entities);
  });

  it('chuẩn hoá NFC trước khi tính offset (tiếng Việt NFD)', () => {
    const nfd = 'Việt Nam @an1 #việtnam'.normalize('NFD');
    expect(nfd.length).toBeGreaterThan('Việt Nam @an1 #việtnam'.length);
    const { text, entities } = parseComposerText(nfd, users);
    expect(text).toBe('Việt Nam @an1 #việtnam');
    expect(entities).toEqual([
      { type: 'mention', start: 9, end: 13, userId: 'user-1' },
      { type: 'hashtag', start: 14, end: 22, tag: 'việtnam' },
    ]);
    expectServerValid(text, entities);
  });

  it('hashtag nhận chữ Unicode có dấu và hạ chữ thường', () => {
    const { entities } = parseComposerText('#ĐàNẵng #Frontend', users);
    expect(entities.map((entity) => (entity.type === 'hashtag' ? entity.tag : null))).toEqual(['đànẵng', 'frontend']);
  });

  it('@handle không tồn tại bị bỏ qua', () => {
    const { entities } = parseComposerText('Chào @nguoila #tag', users);
    expect(entities).toEqual([{ type: 'hashtag', start: 14, end: 18, tag: 'tag' }]);
  });

  it('nhiều hashtag liền nhau và lặp mention', () => {
    const { text, entities } = parseComposerText('#a1 #b2 #c3 @an1 @an1', users);
    expect(entities.map((entity) => entity.type)).toEqual(['hashtag', 'hashtag', 'hashtag', 'mention', 'mention']);
    expectServerValid(text, entities);
  });

  it('link http(s) thành entity, bỏ dấu câu cuối', () => {
    const { text, entities } = parseComposerText('Xem https://example.com/a?b=1. Và http://x.dev/y, ok', users);
    expect(entities).toEqual([
      { type: 'link', start: 4, end: 4 + 'https://example.com/a?b=1'.length, url: 'https://example.com/a?b=1' },
      { type: 'link', start: text.indexOf('http://x.dev'), end: text.indexOf('http://x.dev') + 'http://x.dev/y'.length, url: 'http://x.dev/y' },
    ]);
    expectServerValid(text, entities);
  });

  it('#tag và @handle nằm trong URL không tạo entity chồng lấn', () => {
    const { text, entities } = parseComposerText('https://example.com/page#section @an1', users);
    expect(entities.map((entity) => entity.type)).toEqual(['link', 'mention']);
    expectServerValid(text, entities);
  });

  it('không bắt email và hashtag toàn số', () => {
    const { entities } = parseComposerText('mail me@an1.com và #123', users);
    expect(entities).toEqual([]);
  });

  it('không có entity cho chuỗi rỗng', () => {
    expect(parseComposerText('', users)).toEqual({ text: '', entities: [] });
  });
});

describe('buildUsersByHandle', () => {
  it('map theo handle viết thường', () => {
    const map = buildUsersByHandle({ 'user-1': { id: 'user-1', name: 'An', handle: 'An1', avatarColor: '#000', isVerified: false } });
    expect(map['an1']?.id).toBe('user-1');
  });
});
