import { describe, expect, it } from 'vitest';
import { findDuplicatePostIds } from './find-duplicate-post-ids';

describe('findDuplicatePostIds', () => {
  it('không trùng → set rỗng', () => {
    expect(findDuplicatePostIds(['a', 'b', 'c']).size).toBe(0);
  });

  it('phát hiện id lặp lại', () => {
    expect([...findDuplicatePostIds(['a', 'b', 'c', 'b', 'c', 'd'])]).toEqual(['b', 'c']);
  });
});
