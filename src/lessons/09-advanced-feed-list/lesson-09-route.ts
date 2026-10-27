/**
 * Route con của lesson 09: "#/lesson-09" (feed) và "#/lesson-09/post/:id" (chi tiết bài).
 *
 * Lesson tự đọc hash thay vì có router: app chỉ khớp tiền tố "lesson-09" (lesson-registry) và giữ nguyên
 * component → store, cache chiều cao… không bị mất khi chuyển giữa feed và chi tiết (ưu điểm SPA mà bài nêu).
 */
import { useEffect, useState } from 'react';

export type Lesson09Route = { kind: 'feed' } | { kind: 'post'; postId: string };

export function parseLesson09Route(hash: string): Lesson09Route {
  const [, section, postId] = hash.replace(/^#\/?/, '').split('/');
  if (section === 'post' && postId) {
    try {
      return { kind: 'post', postId: decodeURIComponent(postId) };
    } catch {
      return { kind: 'feed' }; // id hỏng (%E0%A4%A…) → về feed thay vì ném lỗi
    }
  }
  return { kind: 'feed' };
}

export const FEED_HASH = '#/lesson-09';
export const buildPostHash = (postId: string) => `${FEED_HASH}/post/${encodeURIComponent(postId)}`;

// 📖 Bài học lesson-09 §4 – chụp anchor đồng bộ trước khi đổi route con (docs/lessons/lesson-09.md)
// #region learn:route-before-change
/**
 * `onBeforeChange` chạy ĐỒNG BỘ trước khi React đổi view → DOM vẫn là view cũ, kịp chụp anchor của feed.
 */
export function useLesson09Route(onBeforeChange: () => void): Lesson09Route {
  const [route, setRoute] = useState(() => parseLesson09Route(window.location.hash));
  useEffect(() => {
    const onHashChange = () => {
      // Hash của lesson khác (đang rời lesson này): để app unmount lesson, không đổi route ở đây.
      if (window.location.hash.replace(/^#\/?/, '').split('/')[0] !== 'lesson-09') return;
      onBeforeChange();
      setRoute(parseLesson09Route(window.location.hash));
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, [onBeforeChange]);
  return route;
// #endregion learn:route-before-change
}
