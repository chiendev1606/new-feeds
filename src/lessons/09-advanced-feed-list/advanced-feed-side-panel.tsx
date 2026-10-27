/** Cột phụ của lesson 09: anchor đang lưu, tuổi của feed (+ ngưỡng stale chỉnh được), log BroadcastChannel. */
import type { ReactionSyncLogEntry } from '../../shared/sync/cross-tab-reaction-sync';
import type { RestorePhase, RestoreReport } from './use-scroll-restoration';
import type { StoredScrollAnchor } from './scroll-anchor';

export interface SyncLogItem {
  id: number;
  at: number;
  entry: ReactionSyncLogEntry;
}

const PHASE_LABEL: Record<RestorePhase, string> = {
  idle: 'rảnh',
  'loading-anchor-post': 'đang tải thêm bài để tìm bài neo',
  settling: 'đang bù vị trí (đo lại chiều cao)',
};

export function describeSyncEntry(entry: ReactionSyncLogEntry): string {
  switch (entry.kind) {
    case 'sent':
      return `Đã phát ${entry.postId} (${entry.confirmedAt})`;
    case 'received':
      return `Nhận ${entry.postId} (${entry.confirmedAt})`;
    case 'applied':
      return `Đã áp dụng vào store: ${entry.postId}`;
    case 'ignored-stale':
      return `Bỏ qua bản cũ hơn: ${entry.postId} (${entry.confirmedAt})`;
    case 'skipped':
      return `Không áp dụng ${entry.postId}: ${entry.reason}`;
    case 'ignored-invalid':
      return 'Bỏ qua tin nhắn sai định dạng';
  }
}

export interface AdvancedFeedSidePanelProps {
  anchor: StoredScrollAnchor | null;
  phase: RestorePhase;
  report: RestoreReport | null;
  postCount: number;
  generation: number;
  /** Tuổi feed (ms) tính từ lúc nhận trang đầu; null = chưa tải. */
  feedAgeMs: number | null;
  staleAfterSec: number;
  onStaleAfterSecChange: (seconds: number) => void;
  syncLog: readonly SyncLogItem[];
  onOpenNewTab: () => void;
  onClearAnchor: () => void;
}

export function AdvancedFeedSidePanel(props: AdvancedFeedSidePanelProps) {
  const { anchor, phase, report, postCount, generation, feedAgeMs, staleAfterSec, onStaleAfterSecChange, syncLog, onOpenNewTab, onClearAnchor } = props;
  return (
    <div className="lesson09-panel">
      <div className="panel" data-testid="anchor-panel" data-anchor-post-id={anchor?.postId ?? ''} data-restore-phase={phase}>
        <h2>Anchor scroll đang lưu</h2>
        <dl>
          <dt>Bài neo</dt>
          <dd data-testid="anchor-post-id">{anchor?.postId ?? '— (chưa có)'}</dd>
          <dt>Lệch mép trên</dt>
          <dd data-testid="anchor-offset">{anchor ? `${Math.round(anchor.offsetPx)}px` : '—'}</dd>
          <dt>Hết hạn lúc</dt>
          <dd data-testid="anchor-expires">{anchor ? new Date(anchor.expiresAt).toLocaleTimeString() : '—'}</dd>
          <dt>Generation của feed</dt>
          <dd>{generation} (chỉ để xem – anchor không phụ thuộc generation)</dd>
          <dt>Trạng thái</dt>
          <dd>{PHASE_LABEL[phase]}</dd>
          <dt>Khôi phục gần nhất</dt>
          <dd data-testid="restore-report" data-drift={report?.driftPx ?? ''}>
            {report ? `${report.postId}: lệch ${report.driftPx}px sau ${report.frames} frame${report.interrupted ? ' (bị người dùng ngắt)' : ''}` : '—'}
          </dd>
        </dl>
        <button type="button" onClick={onClearAnchor} disabled={!anchor}>
          Xoá anchor
        </button>
        <p className="muted">Lưu ở ref của lesson (SPA) và sessionStorage (tải lại trang).</p>
      </div>

      <div className="panel" data-testid="stale-panel">
        <h2>Tuổi của feed</h2>
        <p>
          Đã tải <strong>{postCount}</strong> bài · tuổi: <strong data-testid="feed-age">{feedAgeMs === null ? '—' : `${Math.floor(feedAgeMs / 1000)}s`}</strong>
        </p>
        <label>
          Cũ sau (giây)
          <input
            type="number"
            min={1}
            max={86_400}
            value={staleAfterSec}
            data-testid="stale-threshold"
            onChange={(event) => {
              const seconds = Number(event.target.value);
              if (Number.isFinite(seconds) && seconds >= 1) onStaleAfterSecChange(Math.floor(seconds));
            }}
          />
        </label>
        <p className="muted">Demo 30 giây; production thường vài giờ. Chỉ kiểm tra khi quay lại tab/cửa sổ (visibilitychange, focus).</p>
      </div>

      <div className="panel" data-testid="sync-panel">
        <h2>Đồng bộ giữa các tab</h2>
        <p>
          <button type="button" className="primary" data-testid="open-new-tab" onClick={onOpenNewTab}>
            Mở tab mới
          </button>
        </p>
        {syncLog.length === 0 ? (
          <p className="muted">Chưa có tin nhắn. Bấm reaction ở một tab, xem tab kia.</p>
        ) : (
          <ol className="lesson09-sync-log" data-testid="sync-log" reversed>
            {syncLog.map((item) => (
              <li key={item.id} data-kind={item.entry.kind}>
                {new Date(item.at).toLocaleTimeString('vi-VN')} – {describeSyncEntry(item.entry)}
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
