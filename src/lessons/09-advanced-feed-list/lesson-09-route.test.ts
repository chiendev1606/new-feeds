import { describe, expect, it } from 'vitest';
import { buildPostHash, parseLesson09Route } from './lesson-09-route';

describe('parseLesson09Route', () => {
  it('#/lesson-09 → feed', () => {
    expect(parseLesson09Route('#/lesson-09')).toEqual({ kind: 'feed' });
  });

  it('#/lesson-09/post/:id → chi tiết, giải mã id', () => {
    expect(parseLesson09Route('#/lesson-09/post/post-20')).toEqual({ kind: 'post', postId: 'post-20' });
    expect(parseLesson09Route(buildPostHash('a/b c'))).toEqual({ kind: 'post', postId: 'a/b c' });
  });

  it('route lạ hoặc id hỏng → feed', () => {
    expect(parseLesson09Route('#/lesson-09/post/')).toEqual({ kind: 'feed' });
    expect(parseLesson09Route('#/lesson-09/other/1')).toEqual({ kind: 'feed' });
    expect(parseLesson09Route('#/lesson-09/post/%E0%A4%A')).toEqual({ kind: 'feed' });
  });
});
