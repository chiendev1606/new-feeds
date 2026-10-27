import { describe, expect, it } from 'vitest';
import { sanitizePastedText, spliceAtSelection } from './composer-text-utils';

const cp = (code: number) => String.fromCodePoint(code);

describe('sanitizePastedText', () => {
  it('loại ký tự điều khiển và zero-width, giữ xuống dòng/tab', () => {
    const dirty = ['a', cp(0), 'b', cp(0x200b), 'c', cp(0xfeff), 'd', cp(0x2060), 'e', cp(0x202e), 'f\ng\th'].join('');
    expect(sanitizePastedText(dirty)).toBe('abcdef\ng\th');
  });

  it('chuẩn hoá CRLF/CR/LS thành \\n', () => {
    expect(sanitizePastedText(`a\r\nb\rc${cp(0x2028)}d`)).toBe('a\nb\nc\nd');
  });

  it('giữ ZWJ trong emoji ghép và tiếng Việt có dấu', () => {
    expect(sanitizePastedText('👨‍👩‍👧 Chào bạn')).toBe('👨‍👩‍👧 Chào bạn');
  });
});

describe('spliceAtSelection', () => {
  it('chèn tại con trỏ và thay vùng chọn', () => {
    expect(spliceAtSelection('abcdef', 2, 4, 'XY', 100)).toEqual({ value: 'abXYef', caret: 4 });
    expect(spliceAtSelection('abc', 3, 3, '!', 100)).toEqual({ value: 'abc!', caret: 4 });
  });

  it('không vượt maxLength và không cắt đôi cặp surrogate', () => {
    expect(spliceAtSelection('abc', 3, 3, '😊😊', 4)).toEqual({ value: 'abc', caret: 3 });
    expect(spliceAtSelection('abc', 3, 3, 'xyz', 5)).toEqual({ value: 'abcxy', caret: 5 });
  });
});
