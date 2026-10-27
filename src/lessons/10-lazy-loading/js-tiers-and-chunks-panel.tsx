/**
 * Hai bảng quan sát của lesson 10 (nhận danh sách chunk từ use-loaded-js-chunks):
 *   1. "JS tiers": chia JS theo độ cần thiết, cột trạng thái tự cập nhật theo chunk thực sự đã tải.
 *   2. "Chunk JS đã tải": đọc từ Resource Timing, có thời điểm tải.
 */
import type { LoadedChunk } from './use-loaded-js-chunks';

interface Tier {
  id: string;
  tier: string;
  content: string;
  when: string;
  /** Từ khoá trong tên file để biết chunk đã tải chưa. */
  match: string[];
}

// 📖 Bài học lesson-10 §2 – ba tầng JS và khi nào tải (docs/lessons/lesson-10.md)
// #region learn:tiers-definition
const TIERS: Tier[] = [
  { id: 'tier-1', tier: 'Tier 1 – shell', content: 'Router, layout, feed list, store, khung bài viết', when: 'Ngay khi mở trang (bundle đầu / chunk lesson)', match: ['lesson-10-lazy-loading'] },
  { id: 'tier-2', tier: 'Tier 2 – renderer theo loại bài', content: 'photo / link / text renderer', when: 'Ngay khi trang đầu về (preloadRenderersFor), song song với việc render', match: ['photo-post-renderer', 'link-post-renderer', 'text-post-renderer'] },
  { id: 'tier-3', tier: 'Tier 3 – tương tác', content: 'reaction-menu, author-hover-card, emoji-picker', when: 'Hover thanh reaction · hover/focus tên tác giả · bấm 😊 (preload), hoặc lúc trình duyệt rảnh nếu bật prefetch', match: ['reaction-menu', 'author-hover-card', 'emoji-picker'] },
];
// #endregion learn:tiers-definition

function formatBytes(bytes: number) {
  if (bytes === 0) return 'cache/–';
  return bytes >= 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${bytes} B`;
}

export function JsTiersTable({ chunks }: { chunks: LoadedChunk[] }) {
  return (
    <div className="panel">
      <h2>JS tiers</h2>
    <table className="data-table" data-testid="js-tiers-table">
      <thead>
        <tr>
          <th scope="col">Tầng</th>
          <th scope="col">Gồm</th>
          <th scope="col">Khi nào tải</th>
          <th scope="col">Đã tải</th>
        </tr>
      </thead>
      <tbody>
        {TIERS.map((tier) => {
          const loaded = tier.match.filter((keyword) => chunks.some((chunk) => chunk.name.includes(keyword)));
          return (
            <tr key={tier.tier}>
              <th scope="row">{tier.tier}</th>
              <td>{tier.content}</td>
              <td>{tier.when}</td>
              <td data-testid={`${tier.id}-loaded`}>
                {loaded.length}/{tier.match.length}
                {loaded.length > 0 && <span className="muted"> ({loaded.join(', ')})</span>}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
    </div>
  );
}

export function LoadedChunksTable({ chunks }: { chunks: LoadedChunk[] }) {
  return (
    <div className="panel">
      <h2>Chunk JS đã tải ({chunks.length})</h2>
      <p className="muted">
        Nguồn: <code>performance.getEntriesByType('resource')</code>. <code>t</code> = ms kể từ lúc mở trang.
      </p>
      <ol className="chunk-list" data-testid="loaded-chunks">
        {chunks.map((chunk) => (
          <li key={chunk.path + chunk.startTime} data-chunk={chunk.name}>
            <span className="chunk-list__time">t={Math.round(chunk.startTime)}ms</span> <code>{chunk.name}</code>{' '}
            <span className="muted">
              {Math.round(chunk.durationMs)}ms · {formatBytes(chunk.transferSize)}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
