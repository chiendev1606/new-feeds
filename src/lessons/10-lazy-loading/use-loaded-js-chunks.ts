/**
 * Đọc danh sách file JS đã tải từ Resource Timing API (performance.getEntriesByType('resource')).
 *
 * Mục đích dạy học: THẤY bằng mắt chunk nào được tải, LÚC NÀO (startTime tính từ lúc mở trang), do ĐÂU
 * (hover/focus/idle/dữ liệu). PerformanceObserver (buffered) nhận cả entry đã có lẫn entry mới → không cần polling.
 * Lưu ý môi trường:
 *   - `npm run build`: chunk là /assets/<tên>-<hash>.js.
 *   - `npm run dev` (Vite): mỗi module là một request /src/…tsx (vẫn là JS đã biên dịch) → lọc theo cả đuôi .tsx/.ts.
 *   - Buffer resource timing của trình duyệt mặc định 250 entry; dev có thể tràn → bảng chỉ mang tính minh hoạ.
 */
import { useEffect, useState } from 'react';

export interface LoadedChunk {
  /** Tên ngắn để đọc: phần cuối của pathname. */
  name: string;
  path: string;
  /** ms kể từ lúc điều hướng (performance.timeOrigin). */
  startTime: number;
  durationMs: number;
  transferSize: number;
}

const SCRIPT_PATH = /\.(?:m?js|[jt]sx?)$/;
/** Chỉ giữ file của app (src/ khi dev, assets/ khi build) – bỏ hàng trăm module node_modules gây nhiễu. */
const APP_PATH = /^\/(?:src|assets)\//;

export function toLoadedChunk(entry: PerformanceResourceTiming): LoadedChunk | null {
  let path: string;
  try {
    path = new URL(entry.name).pathname;
  } catch {
    return null;
  }
  if (!SCRIPT_PATH.test(path) || !APP_PATH.test(path)) return null;
  return { name: path.split('/').pop() ?? path, path, startTime: entry.startTime, durationMs: entry.duration, transferSize: entry.transferSize };
}

export function useLoadedJsChunks(): LoadedChunk[] {
  const [chunks, setChunks] = useState<LoadedChunk[]>([]);

  // 📖 Bài học lesson-10 §2 – đọc chunk JS đã tải bằng PerformanceObserver (docs/lessons/lesson-10.md)
  // #region learn:observe-loaded-chunks
  useEffect(() => {
    if (typeof PerformanceObserver === 'undefined') return;
    const append = (entries: PerformanceEntryList) => {
      const found = (entries as PerformanceResourceTiming[]).map(toLoadedChunk).filter((chunk): chunk is LoadedChunk => chunk !== null);
      if (found.length === 0) return;
      setChunks((current) => {
        const seen = new Set(current.map((chunk) => chunk.path + chunk.startTime));
        const fresh = found.filter((chunk) => !seen.has(chunk.path + chunk.startTime));
        return fresh.length === 0 ? current : [...current, ...fresh].sort((a, b) => a.startTime - b.startTime);
      });
    };
    const observer = new PerformanceObserver((list) => append(list.getEntries()));
    observer.observe({ type: 'resource', buffered: true });
    return () => observer.disconnect();
  }, []);
  // #endregion learn:observe-loaded-chunks

  return chunks;
}
