/**
 * Khung chung của mọi lesson: tiêu đề, mục RADIO tương ứng, "cần quan sát gì",
 * panel điều khiển mô phỏng mạng, và phần nội dung chính + cột phụ (aside).
 */
import type { ReactNode } from 'react';
import { MockControlPanel } from './mock-control-panel';

const ARTICLE_URL = 'https://www.greatfrontend.com/questions/system-design/news-feed-facebook?format=system-design';

export interface LessonLayoutProps {
  number: number;
  title: string;
  radioSections: string;
  /** Các điều nên thử/quan sát trong lesson này. */
  observe: ReactNode[];
  /** File code chính của lesson – để người học mở ra đọc. */
  keyFiles: string[];
  children: ReactNode;
  aside?: ReactNode;
}

export function LessonLayout({ number, title, radioSections, observe, keyFiles, children, aside }: LessonLayoutProps) {
  return (
    <div className="lesson">
      <a className="skip-link" href="#lesson-main">
        Bỏ qua tới nội dung chính
      </a>
      <header className="lesson__header">
        <nav aria-label="Điều hướng lesson">
          <a href="#/">← Tất cả lesson</a>
          {number > 1 && <a href={`#/lesson-${String(number - 1).padStart(2, '0')}`}>Lesson trước</a>}
          {number < 8 && <a href={`#/lesson-${String(number + 1).padStart(2, '0')}`}>Lesson sau →</a>}
        </nav>
        <h1>
          <span className="lesson__number">Lesson {String(number).padStart(2, '0')}</span> {title}
        </h1>
        <p>
          <span className="badge">RADIO: {radioSections}</span>{' '}
          <a href={ARTICLE_URL} target="_blank" rel="noopener noreferrer">
            Mở bài gốc
          </a>
        </p>
        <details className="lesson__observe" open>
          <summary>Cần quan sát gì</summary>
          <ul>
            {observe.map((item, index) => (
              <li key={index}>{item}</li>
            ))}
          </ul>
          <p className="muted">
            Đọc code: {keyFiles.map((file, index) => (
              <span key={file}>
                {index > 0 && ', '}
                <code>{file}</code>
              </span>
            ))}
          </p>
        </details>
        <MockControlPanel />
      </header>
      <div className={aside ? 'lesson__body lesson__body--with-aside' : 'lesson__body'}>
        <main id="lesson-main" tabIndex={-1}>
          {children}
        </main>
        {aside && <aside className="lesson__aside">{aside}</aside>}
      </div>
    </div>
  );
}
