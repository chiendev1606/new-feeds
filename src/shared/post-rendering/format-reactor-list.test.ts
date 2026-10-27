import { describe, expect, it } from 'vitest';
import { formatReactorList } from './format-reactor-list';

describe('formatReactorList', () => {
  it('tiếng Việt và tiếng Anh', () => {
    expect(formatReactorList(['An', 'Bình'], 5, 'vi-VN')).toBe('An, Bình và 3 người khác');
    expect(formatReactorList(['An', 'Bình'], 5, 'en-US')).toBe('An, Bình, and 3 others');
  });

  it('tiếng Anh dùng số ít "1 other"', () => {
    expect(formatReactorList(['An', 'Bình'], 3, 'en-US')).toBe('An, Bình, and 1 other');
    expect(formatReactorList(['An', 'Bình'], 4, 'en-US')).toBe('An, Bình, and 2 others');
    expect(formatReactorList(['An', 'Bình'], 3, 'vi-VN')).toBe('An, Bình và 1 người khác');
  });

  it('tên bị bỏ (chưa có trong store) rơi vào "người khác" thay vì hiện id', () => {
    // 3 người khác (không tính viewer), chỉ biết tên 1 người → 2 người còn lại là "người khác".
    expect(formatReactorList(['An'], 3, 'vi-VN')).toBe('An và 2 người khác');
  });

  it('không còn ai khác → chỉ liệt kê tên', () => {
    expect(formatReactorList(['An', 'Bình'], 2, 'vi-VN')).toBe('An và Bình');
    expect(formatReactorList(['An'], 1, 'en-US')).toBe('An');
  });

  it('không có tên → chuỗi rỗng', () => {
    expect(formatReactorList([], 10, 'vi-VN')).toBe('');
  });
});
