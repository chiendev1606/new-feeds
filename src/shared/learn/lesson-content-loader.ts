/**
 * Nạp bài học (docs/lessons/*.md) và file source (để trích đoạn code) – đều LƯỜI.
 *
 * import.meta.glob(..., { query: '?raw' }) của Vite: mỗi file thành một chunk nhỏ chứa nội dung dạng chuỗi,
 * chỉ tải khi gọi hàm loader. Mở tab "Bài học" lesson 02 → chỉ tải lesson-02.md + đúng các file nó trích.
 * File trong public/ (vd sw.js) không import được qua bundler → lấy bằng fetch như trình duyệt vẫn làm.
 */
type RawLoader = () => Promise<string>;

const docLoaders = import.meta.glob('/docs/lessons/*.md', { query: '?raw', import: 'default' }) as Record<string, RawLoader>;

const sourceLoaders = import.meta.glob(
  [
    '/src/**/*.{ts,tsx,css}',
    '!/src/**/*.test.{ts,tsx}',
    '/server/src/**/*.ts',
    '!/server/src/**/*.test.ts',
    '/server/db/migrations/*.sql',
    '/shared-contracts/*.ts',
  ],
  { query: '?raw', import: 'default' },
) as Record<string, RawLoader>;

/** "lesson-02" → nội dung docs/lessons/lesson-02.md, hoặc null nếu bài học chưa có. */
export async function loadLessonDoc(name: string): Promise<string | null> {
  const loader = docLoaders[`/docs/lessons/${name}.md`];
  return loader ? loader() : null;
}

/** Đường dẫn tính từ gốc repo, vd "server/src/data/feed-repository.ts". */
export async function loadSourceFile(path: string): Promise<string | null> {
  if (path.startsWith('public/')) {
    const response = await fetch(`/${path.slice('public/'.length)}`, { cache: 'no-store' });
    return response.ok ? response.text() : null;
  }
  const loader = sourceLoaders[`/${path}`];
  return loader ? loader() : null;
}

/** Prefetch khi người học hover/focus tab "Bài học" – mở tab là có ngay. */
export function prefetchLessonDoc(name: string) {
  void loadLessonDoc(name).catch(() => undefined);
}
