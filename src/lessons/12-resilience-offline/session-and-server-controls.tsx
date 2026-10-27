/**
 * Hai thí nghiệm "server đổi ý giữa chừng":
 *   1. Hết hạn session → mọi /api trả 401 SESSION_EXPIRED → http-client làm mới session ĐÚNG MỘT LẦN
 *      (single-flight cho request đồng thời) rồi gửi lại request gốc. UI chỉ quan sát, không tự xử lý 401.
 *   2. Xoá bài ở server → react vào bài đó trả 404 → gỡ bài khỏi feed + toast (xem handle-not-found.ts).
 */
import { useEffect, useRef, useState } from 'react';
import { fetchFeedPage, getSession } from '../../shared/api/feed-api';
import { httpClientEvents } from '../../shared/api/http-client';
import { deletePostOnServer, expireSession } from '../../shared/api/mock-control-api';
import { toErrorMessage } from '../../shared/utils/to-error-message';
import { useFeedState } from '../03-normalized-store/feed-store-context';
import { TEMP_POST_PREFIX } from './use-offline-outbox';

export interface SessionAndServerControlsProps {
  onLog: (line: string) => void;
  onToast: (message: string, tone?: 'info' | 'error') => void;
}

export function SessionAndServerControls({ onLog, onToast }: SessionAndServerControlsProps) {
  const state = useFeedState();
  const [sessionLog, setSessionLog] = useState<string[]>([]);
  const [deletedPostId, setDeletedPostId] = useState<string | null>(null);
  const refreshCount = useRef(0);

  // 📖 Bài học lesson-12 §1 – lắng sự kiện session-refresh để đếm số lần refresh thật (docs/lessons/lesson-12.md)
  // #region learn:observe-session-refresh-event
  // Lắng sự kiện của data access layer: mỗi lần http-client thực sự làm mới session.
  useEffect(() => {
    const onRefresh = () => {
      refreshCount.current += 1;
      const line = `${new Date().toLocaleTimeString()} 🔑 POST /api/session/refresh (lần thứ ${refreshCount.current}) → request gốc được gửi lại`;
      setSessionLog((current) => [line, ...current].slice(0, 20));
    };
    httpClientEvents.addEventListener('session-refresh', onRefresh);
    return () => httpClientEvents.removeEventListener('session-refresh', onRefresh);
  }, []);
  // #endregion learn:observe-session-refresh-event

  const guarded = async (label: string, action: () => Promise<void>) => {
    try {
      await action();
    } catch (error) {
      onLog(`⚠️ ${label}: ${toErrorMessage(error)}`);
    }
  };

  const expire = () =>
    guarded('hết hạn session', async () => {
      await expireSession();
      onLog('⌛ session hết hạn ở server. Request /api kế tiếp (react, đăng bài, tải feed…) sẽ nhận 401 rồi tự refresh.');
    });

  // 📖 Bài học lesson-12 §1 – ba URL khác nhau để thấy single-flight (docs/lessons/lesson-12.md)
  // #region learn:parallel-calls-three-urls
  // 3 URL KHÁC NHAU (GET cùng URL sẽ bị gộp dedupe nên không thấy được single-flight).
  const parallelCalls = () =>
    guarded('gọi song song', async () => {
      const results = await Promise.allSettled([getSession(), fetchFeedPage({ count: 1 }), fetchFeedPage({ count: 2 })]);
      onLog(`🧵 3 request song song xong: ${results.map((result) => result.status).join(', ')} – xem session-log: chỉ 1 lần refresh`);
    });
  // #endregion learn:parallel-calls-three-urls

  const deleteFirstPost = () =>
    guarded('xoá bài', async () => {
      const firstId = state.feed.postIds.find((id) => !id.startsWith(TEMP_POST_PREFIX));
      if (!firstId) return onToast('Chưa có bài nào để xoá', 'error');
      await deletePostOnServer(firstId);
      setDeletedPostId(firstId);
      onLog(`🗑 server đã xoá ${firstId}. Client chưa biết – hãy react vào bài đó.`);
    });

  return (
    <div className="panel">
      <h2>Server đổi ý giữa chừng</h2>
      <div className="l12-actions">
        <button type="button" data-testid="expire-session" onClick={() => void expire()}>
          Hết hạn session
        </button>
        <button type="button" data-testid="parallel-calls" onClick={() => void parallelCalls()}>
          Gọi 3 API song song
        </button>
        <button type="button" data-testid="delete-first-post" onClick={() => void deleteFirstPost()}>
          Xoá bài đầu tiên ở server
        </button>
      </div>
      {deletedPostId && (
        <p className="muted" data-testid="deleted-post-hint">
          Đã xoá <code>{deletedPostId}</code> ở server → react vào bài đó để thấy 404.
        </p>
      )}
      <h3>Session log</h3>
      <ol className="event-log" data-testid="session-log">
        {sessionLog.length === 0 && <li className="muted">Chưa có lần refresh nào.</li>}
        {sessionLog.map((line, index) => (
          <li key={index} className="event-log__item">
            {line}
          </li>
        ))}
      </ol>
    </div>
  );
}
