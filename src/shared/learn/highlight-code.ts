/**
 * Tô màu cú pháp bằng highlight.js bản "core" + đúng vài ngôn ngữ cần dùng (nhẹ hơn nhiều so với bản đầy đủ ~190 ngôn ngữ).
 * Import động: chỉ tải khi tab "Bài học" hiển thị khối code đầu tiên.
 */
import type { HLJSApi } from 'highlight.js';

let highlighterPromise: Promise<HLJSApi> | null = null;

function loadHighlighter(): Promise<HLJSApi> {
  highlighterPromise ??= (async () => {
    const [{ default: hljs }, typescript, javascript, sql, css] = await Promise.all([
      import('highlight.js/lib/core'),
      import('highlight.js/lib/languages/typescript'),
      import('highlight.js/lib/languages/javascript'),
      import('highlight.js/lib/languages/sql'),
      import('highlight.js/lib/languages/css'),
    ]);
    hljs.registerLanguage('typescript', typescript.default);
    hljs.registerLanguage('javascript', javascript.default);
    hljs.registerLanguage('sql', sql.default);
    hljs.registerLanguage('css', css.default);
    return hljs;
  })();
  return highlighterPromise;
}

export function languageForPath(path: string): string {
  if (/\.(ts|tsx)$/.test(path)) return 'typescript';
  if (/\.(js|mjs)$/.test(path)) return 'javascript';
  if (path.endsWith('.sql')) return 'sql';
  if (path.endsWith('.css')) return 'css';
  return 'plaintext';
}

/** Trả HTML đã escape (highlight.js tự escape nội dung) – an toàn để gán innerHTML. */
export async function highlightCode(code: string, language: string): Promise<string> {
  const hljs = await loadHighlighter();
  if (!hljs.getLanguage(language)) return escapeHtml(code);
  return hljs.highlight(code, { language, ignoreIllegals: true }).value;
}

export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);
}
