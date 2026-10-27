/**
 * SPA tối giản: điều hướng bằng hash (#/lesson-04) để không cần thư viện router.
 * Bài viết khuyên dùng SPA cho feed: chuyển trang không mất store, cache, vị trí scroll.
 */
import { Suspense, useEffect, useState } from 'react';
import { findLessonByHash, LESSONS } from './lessons/lesson-registry';

/** "#/lesson-09/post/1" → "lesson-09". */
// 📖 Bài học shared-foundations §1 – SPA điều hướng bằng hash để giữ store, cache và vị trí scroll (docs/lessons/shared-foundations.md)
// #region learn:hash-router
const lessonKeyOf = (hash: string) => hash.replace(/^#\/?/, '').split('/')[0] ?? '';

function useLocationHash() {
  const [hash, setHash] = useState(() => window.location.hash);
  useEffect(() => {
    let previousHash = window.location.hash;
    const onHashChange = () => {
      const nextHash = window.location.hash;
      setHash(nextHash);
      // Đổi route con TRONG cùng một lesson (#/lesson-09 → #/lesson-09/post/1): lesson tự quản lý vị trí scroll
      // (vd khôi phục khi quay lại). Chỉ chuyển sang lesson/trang khác mới cuộn lên đầu.
      if (lessonKeyOf(previousHash) !== lessonKeyOf(nextHash)) window.scrollTo(0, 0);
      previousHash = nextHash;
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);
  return hash;
}
// #endregion learn:hash-router

// 📖 Bài học shared-foundations §1 – mỗi lesson là một chunk tải lười bằng React.lazy và Suspense (docs/lessons/shared-foundations.md)
// #region learn:lesson-lazy-suspense
export function AppLessonPicker() {
  const hash = useLocationHash();
  const lesson = findLessonByHash(hash);

  if (lesson) {
    const { Component } = lesson;
    return (
      <Suspense fallback={<p className="page-loading">Đang tải lesson…</p>}>
        <Component key={lesson.id} />
      </Suspense>
    );
  }
// #endregion learn:lesson-lazy-suspense

  return (
    <main className="lesson-picker">
      <header>
        <h1>News Feed — System Design qua 12 lesson</h1>
        <p>
          Dựa trên bài{' '}
          <a href="https://www.greatfrontend.com/questions/system-design/news-feed-facebook?format=system-design" target="_blank" rel="noopener noreferrer">
            News Feed (Facebook) – GreatFrontEnd
          </a>
          . Học theo thứ tự; mỗi lesson thêm đúng một khái niệm. Mở terminal backend để xem log request.
        </p>
      </header>
      <ol className="lesson-picker__list">
        {LESSONS.map((item) => (
          <li key={item.id}>
            <a className="lesson-picker__card" href={`#/${item.id}`}>
              <span className="lesson-picker__number">{String(item.number).padStart(2, '0')}</span>
              <span>
                <strong>{item.title}</strong>
                <span className="badge">{item.radioSections}</span>
                <span className="lesson-picker__summary">{item.summary}</span>
              </span>
            </a>
          </li>
        ))}
      </ol>
    </main>
  );
}
