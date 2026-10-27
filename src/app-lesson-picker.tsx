/**
 * SPA tối giản: điều hướng bằng hash (#/lesson-04) để không cần thư viện router.
 * Bài viết khuyên dùng SPA cho feed: chuyển trang không mất store, cache, vị trí scroll.
 */
import { Suspense, useEffect, useState } from 'react';
import { findLessonByHash, LESSONS } from './lessons/lesson-registry';

function useLocationHash() {
  const [hash, setHash] = useState(() => window.location.hash);
  useEffect(() => {
    const onHashChange = () => {
      setHash(window.location.hash);
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);
  return hash;
}

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

  return (
    <main className="lesson-picker">
      <header>
        <h1>News Feed — System Design qua 8 lesson</h1>
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
