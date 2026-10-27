/** Panel chỉnh độ trễ / tỉ lệ lỗi / tự sinh bài mới của backend – để thí nghiệm hành vi mạng. */
import { useEffect, useState } from 'react';
import { getSimulationConfig, insertNewPosts, resetDatabase, updateSimulationConfig } from '../api/mock-control-api';
import type { SimulationConfig } from '../types/feed-entities';

export function MockControlPanel() {
  const [config, setConfig] = useState<SimulationConfig | null>(null);
  const [status, setStatus] = useState('');
  const [backendDown, setBackendDown] = useState(false);

  useEffect(() => {
    getSimulationConfig()
      .then(setConfig)
      .catch(() => setBackendDown(true));
  }, []);

  const apply = async (patch: Partial<SimulationConfig>) => {
    setConfig((current) => (current ? { ...current, ...patch } : current));
    setConfig(await updateSimulationConfig(patch));
  };

  if (backendDown) {
    return (
      <p className="mock-panel mock-panel--error" role="alert">
        Không kết nối được backend. Chạy <code>npm run dev</code> (hoặc <code>npm run dev:server</code>) rồi tải lại trang.
      </p>
    );
  }
  if (!config) return null;

  return (
    <fieldset className="mock-panel">
      <legend>Mô phỏng mạng (backend)</legend>
      <label>
        Độ trễ: <strong>{config.latencyMs}ms</strong>
        <input type="range" min={0} max={3000} step={100} value={config.latencyMs} onChange={(event) => void apply({ latencyMs: Number(event.target.value) })} />
      </label>
      <label>
        Tỉ lệ lỗi: <strong>{Math.round(config.failRate * 100)}%</strong>
        <input type="range" min={0} max={1} step={0.1} value={config.failRate} onChange={(event) => void apply({ failRate: Number(event.target.value) })} />
      </label>
      <label>
        Tự sinh bài mới:{' '}
        <select value={config.autoNewPostsEverySec} onChange={(event) => void apply({ autoNewPostsEverySec: Number(event.target.value) })}>
          <option value={0}>Tắt</option>
          <option value={5}>Mỗi 5 giây</option>
          <option value={15}>Mỗi 15 giây</option>
        </select>
      </label>
      <div className="mock-panel__actions">
        <button
          type="button"
          onClick={async () => {
            const result = await insertNewPosts(3);
            setStatus(`Đã chèn ${result.insertedPostIds.length} bài mới lên đầu feed (generation ${result.generation}).`);
          }}
        >
          Chèn 3 bài mới
        </button>
        <button
          type="button"
          onClick={async () => {
            await resetDatabase();
            await apply({ latencyMs: 400, failRate: 0, autoNewPostsEverySec: 0 });
            setStatus('Đã reset dữ liệu – tải lại trang để bắt đầu lại.');
          }}
        >
          Reset dữ liệu
        </button>
      </div>
      <p className="muted" aria-live="polite">
        {status}
      </p>
    </fieldset>
  );
}
