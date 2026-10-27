/** Ba panel quan sát của lesson 11: Web Vitals, các lô đã gửi, và server summary (poll 5 giây). */
import { useEffect, useState } from 'react';
import type { TelemetrySummaryResponse, WebVitalName } from '../../../shared-contracts/feed-api-contracts';
import { getTelemetrySummary } from '../../shared/api/feed-api';
import { toErrorMessage } from '../../shared/utils/to-error-message';
import type { SentBatchLog } from './impression-tracker';
import type { VitalsSnapshot } from './use-impression-tracking';
import { formatVitalValue, rateVital, VITAL_BUDGETS } from './web-vitals-rating';

const RATING_TEXT = { good: 'tốt', 'needs-improvement': 'cần cải thiện', poor: 'kém' } as const;
const SUMMARY_POLL_MS = 5000;

function VitalRow({ name, value }: { name: WebVitalName; value: number | undefined }) {
  const budget = VITAL_BUDGETS[name];
  const rating = value === undefined ? null : rateVital(name, value);
  return (
    <tr data-vital={name} data-rating={rating ?? 'pending'}>
      <th scope="row" title={budget.label}>{name}</th>
      <td className={rating ? `vital-value vital-value--${rating}` : 'muted'}>
        {value === undefined ? 'chưa có' : formatVitalValue(name, value)}
      </td>
      <td>{rating ? RATING_TEXT[rating] : '—'}</td>
      <td className="muted">≤ {budget.good}{budget.unit}</td>
    </tr>
  );
}

export function WebVitalsPanel({ vitals }: { vitals: VitalsSnapshot }) {
  return (
    <div className="panel" data-testid="web-vitals">
      <h2>Web Vitals (đo trên trình duyệt này)</h2>
      <table className="vitals-table">
        <thead>
          <tr><th scope="col">Chỉ số</th><th scope="col">Giá trị</th><th scope="col">Đánh giá</th><th scope="col">Budget</th></tr>
        </thead>
        <tbody>
          <VitalRow name="LCP" value={vitals.LCP} />
          <VitalRow name="CLS" value={vitals.CLS} />
          <VitalRow name="INP" value={vitals.INP} />
          <VitalRow name="long-task" value={vitals.longTaskCount > 0 ? vitals.longTaskMaxMs : undefined} />
        </tbody>
      </table>
      <p className="muted">Long task: {vitals.longTaskCount} lần (dài nhất {Math.round(vitals.longTaskMaxMs)}ms).</p>
      {vitals.unsupported.length > 0 && <p className="muted">Trình duyệt không hỗ trợ: {vitals.unsupported.join(', ')} – các chỉ số này sẽ không có giá trị.</p>}
    </div>
  );
}

export function TelemetryBatchesPanel({ batches, onFlush }: { batches: SentBatchLog[]; onFlush: () => void }) {
  return (
    <div className="panel" data-testid="telemetry-batches">
      <h2>Lô telemetry đã gửi</h2>
      <p>
        <button type="button" onClick={onFlush}>Gửi ngay</button>{' '}
        <span className="muted">Tự gửi khi đủ 20 sự kiện, mỗi 5s, hoặc bằng beacon khi tab bị ẩn.</span>
      </p>
      {batches.length === 0 ? (
        <p className="muted">Chưa có lô nào. Cuộn feed, dừng mỗi bài ≥ 1 giây.</p>
      ) : (
        <ol className="batch-log">
          {batches.map((batch, index) => (
            <li key={`${batch.at}-${index}`} data-method={batch.method} data-ok={batch.ok}>
              <span className="muted">{new Date(batch.at).toLocaleTimeString()}</span> <strong>{batch.method}</strong> · {batch.size} sự kiện
              {!batch.ok && <span className="error-text">{batch.dropped ? ' · server từ chối (4xx) – đã bỏ lô, không gửi lại' : ' · lỗi mạng/5xx (sẽ gửi lại)'}</span>}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

export function ServerSummaryPanel() {
  const [summary, setSummary] = useState<TelemetrySummaryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Poll mỗi 5s: dữ liệu telemetry đến server theo lô nên không cần real-time; poll rẻ và đơn giản.
  useEffect(() => {
    let cancelled = false;
    const load = () => {
      getTelemetrySummary().then(
        (data) => {
          if (cancelled) return;
          setSummary(data);
          setError(null);
        },
        (reason) => {
          if (!cancelled) setError(toErrorMessage(reason));
        },
      );
    };
    load();
    const timer = setInterval(load, SUMMARY_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  return (
    <div className="panel" data-testid="server-summary">
      <h2>Server summary (poll 5s)</h2>
      {error && <p role="alert" className="error-text">{error}</p>}
      {!summary ? (
        <p className="muted">Đang tải…</p>
      ) : (
        <>
          <p>Tổng sự kiện trong DB: <strong data-testid="server-total-events">{summary.totalEvents}</strong></p>
          <p className="muted">
            p75 phía server:{' '}
            {(Object.entries(summary.webVitalsP75) as Array<[WebVitalName, number]>).map(([name, value]) => `${name} ${formatVitalValue(name, value)}`).join(' · ') || 'chưa có'}
          </p>
          <ol className="batch-log">
            {summary.topImpressions.map((row) => (
              <li key={row.postId}><code>{row.postId}</code>: {row.impressions} lượt hiển thị, xem {(row.totalDwellMs / 1000).toFixed(1)}s</li>
            ))}
          </ol>
        </>
      )}
    </div>
  );
}
