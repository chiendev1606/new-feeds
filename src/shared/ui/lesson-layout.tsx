/**
 * Khung chung của mọi lesson: tiêu đề, mục RADIO tương ứng, và 2 tab:
 *   🧪 Demo     – "cần quan sát gì", panel mô phỏng mạng, nội dung chính + cột phụ (aside).
 *   📖 Bài học  – docs/lessons/lesson-XX.md với code thật nhúng từ source (src/shared/learn).
 *
 * Tab Demo luôn được giữ mount (chỉ ẩn bằng `hidden`) → chuyển qua lại không mất state của demo.
 * Tab Bài học là chunk tải lười, prefetch khi hover/focus vào tab → mở tab là có ngay.
 */
import { lazy, Suspense, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { LESSONS } from '../../lessons/lesson-registry';
import { prefetchLessonDoc } from '../learn/lesson-content-loader';
import { MockControlPanel } from './mock-control-panel';

const ARTICLE_URL = 'https://www.greatfrontend.com/questions/system-design/news-feed-facebook?format=system-design';

const loadLearnTab = () => import('../learn/lesson-learn-tab');
const LessonLearnTab = lazy(loadLearnTab);

type LessonTab = 'demo' | 'learn';
const TABS: Array<{ id: LessonTab; label: string }> = [
  { id: 'demo', label: '🧪 Demo' },
  { id: 'learn', label: '📖 Bài học' },
];

function readSavedTab(lessonNumber: number): LessonTab {
  try {
    return sessionStorage.getItem(`lesson-tab:${lessonNumber}`) === 'learn' ? 'learn' : 'demo';
  } catch {
    return 'demo';
  }
}

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
  const [tab, setTab] = useState<LessonTab>(() => readSavedTab(number));
  // Chỉ mount tab Bài học sau lần mở đầu tiên, rồi giữ luôn (không tải lại khi chuyển qua lại).
  const [learnOpened, setLearnOpened] = useState(tab === 'learn');
  const tabRefs = useRef<Record<LessonTab, HTMLButtonElement | null>>({ demo: null, learn: null });
  const docName = `lesson-${String(number).padStart(2, '0')}`;

  const selectTab = (next: LessonTab) => {
    setTab(next);
    if (next === 'learn') setLearnOpened(true);
    try {
      sessionStorage.setItem(`lesson-tab:${number}`, next);
    } catch {
      // sessionStorage bị chặn (chế độ riêng tư) → chỉ không nhớ tab, không sao.
    }
  };

  const prefetchLearn = () => {
    void loadLearnTab();
    prefetchLessonDoc(docName);
  };

  // WAI-ARIA tabs: mũi tên trái/phải chuyển tab và chuyển focus.
  const onTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    event.preventDefault();
    const next: LessonTab = tab === 'demo' ? 'learn' : 'demo';
    selectTab(next);
    tabRefs.current[next]?.focus();
  };

  return (
    <div className="lesson">
      <a className="skip-link" href="#lesson-main">
        Bỏ qua tới nội dung chính
      </a>
      <header className="lesson__header">
        <nav aria-label="Điều hướng lesson">
          <a href="#/">← Tất cả lesson</a>
          {number > 1 && <a href={`#/lesson-${String(number - 1).padStart(2, '0')}`}>Lesson trước</a>}
          {number < LESSONS.length && <a href={`#/lesson-${String(number + 1).padStart(2, '0')}`}>Lesson sau →</a>}
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
        <div className="lesson-tabs" role="tablist" aria-label="Chế độ xem lesson">
          {TABS.map((item) => (
            <button
              key={item.id}
              ref={(element) => {
                tabRefs.current[item.id] = element;
              }}
              type="button"
              role="tab"
              id={`lesson-tab-${item.id}`}
              aria-selected={tab === item.id}
              aria-controls={`lesson-panel-${item.id}`}
              tabIndex={tab === item.id ? 0 : -1}
              data-testid={`lesson-tab-${item.id}`}
              onClick={() => selectTab(item.id)}
              onKeyDown={onTabKeyDown}
              onPointerEnter={item.id === 'learn' ? prefetchLearn : undefined}
              onFocus={item.id === 'learn' ? prefetchLearn : undefined}
            >
              {item.label}
            </button>
          ))}
        </div>
      </header>

      <div role="tabpanel" id="lesson-panel-demo" aria-labelledby="lesson-tab-demo" hidden={tab !== 'demo'}>
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
        <div className={aside ? 'lesson__body lesson__body--with-aside' : 'lesson__body'}>
          <main id="lesson-main" tabIndex={-1}>
            {children}
          </main>
          {aside && <aside className="lesson__aside">{aside}</aside>}
        </div>
      </div>

      <div role="tabpanel" id="lesson-panel-learn" aria-labelledby="lesson-tab-learn" hidden={tab !== 'learn'}>
        {learnOpened && (
          <Suspense fallback={<p className="muted">Đang tải bài học…</p>}>
            <LessonLearnTab lessonNumber={number} />
          </Suspense>
        )}
      </div>
    </div>
  );
}
