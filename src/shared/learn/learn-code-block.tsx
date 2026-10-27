/**
 * Khối "Code thật" trong bài học: lấy đúng region `learn:<id>` từ file source hiện tại,
 * tô màu, ghi file + số dòng, link sang GitHub. Code đổi → bài học tự đổi theo.
 */
import { useEffect, useState } from 'react';
import { highlightCode, languageForPath } from './highlight-code';
import { loadSourceFile } from './lesson-content-loader';
import { extractRegion, stripRegionMarkers } from './source-region-extractor';

const GITHUB_BLOB = 'https://github.com/chiendev1606/new-feeds/blob/main';

type BlockState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; html: string; code: string; startLine: number; endLine: number };

export function LearnCodeBlock({ path, id }: { path: string; id: string }) {
  const [state, setState] = useState<BlockState>({ status: 'loading' });
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const source = await loadSourceFile(path);
      if (source === null) throw new Error(`Không tìm thấy file ${path}`);
      const region = extractRegion(source, id);
      if (!region) throw new Error(`Không tìm thấy "#region learn:${id}" trong ${path}`);
      const code = stripRegionMarkers(region.code);
      const html = await highlightCode(code, languageForPath(path));
      if (!cancelled) setState({ status: 'ready', html, code, startLine: region.startLine, endLine: region.endLine });
    })().catch((error: unknown) => {
      if (!cancelled) setState({ status: 'error', message: error instanceof Error ? error.message : String(error) });
    });
    return () => {
      cancelled = true;
    };
  }, [path, id]);

  const lines = state.status === 'ready' ? `#L${state.startLine}-L${state.endLine}` : '';

  return (
    <figure className="learn-code" data-testid="learn-code" data-learn-ref={`${path}#${id}`}>
      <figcaption className="learn-code__header">
        <code>
          {path}
          {state.status === 'ready' && `:${state.startLine}–${state.endLine}`}
        </code>
        <span className="learn-code__actions">
          {state.status === 'ready' && (
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard?.writeText(state.code).then(() => {
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                });
              }}
            >
              {copied ? 'Đã chép' : 'Chép'}
            </button>
          )}
          <a href={`${GITHUB_BLOB}/${path}${lines}`} target="_blank" rel="noopener noreferrer">
            GitHub ↗
          </a>
        </span>
      </figcaption>
      {state.status === 'loading' && <pre className="learn-code__body muted">Đang tải code…</pre>}
      {state.status === 'error' && (
        <pre className="learn-code__body error-text" role="alert">
          {state.message}
        </pre>
      )}
      {state.status === 'ready' && (
        <pre className="learn-code__body hljs" style={{ counterReset: `line ${state.startLine - 1}` }}>
          {/* highlight.js đã escape nội dung → gán HTML an toàn. */}
          <code dangerouslySetInnerHTML={{ __html: state.html }} />
        </pre>
      )}
    </figure>
  );
}
