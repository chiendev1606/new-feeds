/**
 * Nội dung tab "📖 Bài học" của một lesson: tải docs/lessons/lesson-XX.md, mục lục bên cạnh, nội dung chính.
 * Cả file này là một chunk riêng (React.lazy trong lesson-layout) → xem tab Demo không tốn byte nào cho phần học liệu.
 */
import { useCallback, useEffect, useState } from 'react';
import { loadLessonDoc } from './lesson-content-loader';
import type { TocEntry } from './lesson-markdown-view';
import { LessonMarkdownView } from './lesson-markdown-view';
import './lesson-learn.css';

export function lessonDocName(lessonNumber: number) {
  return `lesson-${String(lessonNumber).padStart(2, '0')}`;
}

/** Bài nền tảng dùng chung (backend, http-client, hợp đồng API…) – mở được từ mọi lesson. */
const FOUNDATIONS_DOC = 'shared-foundations';

export default function LessonLearnTab({ lessonNumber }: { lessonNumber: number }) {
  const [markdown, setMarkdown] = useState<string | null | undefined>(undefined);
  const [toc, setToc] = useState<TocEntry[]>([]);
  const [showFoundations, setShowFoundations] = useState(false);
  const docName = showFoundations ? FOUNDATIONS_DOC : lessonDocName(lessonNumber);

  useEffect(() => {
    let cancelled = false;
    setMarkdown(undefined);
    void loadLessonDoc(docName).then((content) => !cancelled && setMarkdown(content));
    return () => {
      cancelled = true;
    };
  }, [docName]);

  const handleToc = useCallback((entries: TocEntry[]) => setToc(entries), []);

  if (markdown === undefined) return <p className="muted">Đang tải bài học…</p>;
  if (markdown === null) {
    return (
      <p className="panel" data-testid="learn-missing">
        Bài học cho lesson này đang được viết (<code>docs/lessons/{docName}.md</code>).
      </p>
    );
  }

  return (
    <div className="learn-layout" data-testid="learn-tab">
      {toc.length > 0 && (
        <nav className="learn-toc" aria-label="Mục lục bài học">
          <button type="button" className="learn-toc__switch" data-testid="learn-doc-switch" onClick={() => setShowFoundations((value) => !value)}>
            {showFoundations ? `← Về ${lessonDocName(lessonNumber)}` : '📚 Nền tảng dùng chung'}
          </button>
          <strong>Mục lục</strong>
          <ol>
            {toc.map((entry) => (
              <li key={entry.id}>
                <a
                  href={`#${entry.id}`}
                  onClick={(event) => {
                    // Không đổi location.hash (hash đang dùng để điều hướng lesson) – cuộn thẳng tới mục.
                    event.preventDefault();
                    document.getElementById(entry.id)?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
                  }}
                >
                  {entry.text}
                </a>
              </li>
            ))}
          </ol>
        </nav>
      )}
      <article className="learn-article">
        <LessonMarkdownView markdown={markdown} onToc={handleToc} />
      </article>
    </div>
  );
}
