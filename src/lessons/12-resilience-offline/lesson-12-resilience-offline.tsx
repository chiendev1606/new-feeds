/**
 * LESSON 12 – Resilience & offline (O – Networking, resilience, offline)
 *
 * Mạng và server không đáng tin; app tốt xử lý được 4 tình huống:
 *   1. Session hết hạn (401)  → làm mới đúng MỘT lần rồi gửi lại (http-client, lesson chỉ quan sát).
 *   2. 404 tuỳ endpoint       → reaction 404 = "bài đã xoá" (gỡ khỏi feed), khác với lỗi feed thường.
 *   3. Ghi khi offline        → OUTBOX trong IndexedDB + idempotency key: không mất bài, không đăng trùng.
 *   4. Đọc khi offline        → SERVICE WORKER cache (ảnh cache-first, feed network-first, cache feed tách theo viewer).
 */
import { useCallback, useState } from 'react';
import { useOnlineStatus } from '../../shared/offline/use-online-status';
import { LessonLayout } from '../../shared/ui/lesson-layout';
import { ToastStack, useToasts } from '../../shared/ui/toast-stack';
import { ReactionFeedStoreProvider } from '../05-optimistic-reaction/reaction-feed-store-provider';
import './lesson-12-resilience-offline.css';
import { ResilienceFeed } from './resilience-feed';
import { ServiceWorkerControls } from './service-worker-controls';
import { SessionAndServerControls } from './session-and-server-controls';
import { useCacheSourceProbe } from './use-cache-source-probe';

export default function Lesson12ResilienceOffline() {
  const online = useOnlineStatus();
  const { source, probe } = useCacheSourceProbe();
  const { toasts, showToast } = useToasts();
  const [log, setLog] = useState<string[]>([]);
  const [feedKey, setFeedKey] = useState(0);
  const addLog = useCallback((line: string) => setLog((current) => [`${new Date().toLocaleTimeString()} ${line}`, ...current].slice(0, 30)), []);

  return (
    <ReactionFeedStoreProvider>
      <LessonLayout
        number={12}
        title="Resilience & offline"
        radioSections="O – Networking, resilience, offline"
        keyFiles={[
          'src/shared/offline/post-outbox.ts',
          'src/shared/offline/indexed-db-store.ts',
          'public/sw.js',
          'src/lessons/12-resilience-offline/use-offline-outbox.ts',
          'src/lessons/12-resilience-offline/handle-not-found.ts',
          'src/shared/api/http-client.ts (refresh 401)',
        ]}
        observe={[
          'DevTools → Network → chọn "Offline", gõ chữ rồi bấm Đăng: bài tạm "⏳ chờ mạng" hiện ngay, outbox có 1 mục (IndexedDB: Application → IndexedDB → newsfeed-outbox:<viewer>). Bỏ "Offline": mục tự được gửi, bài tạm đổi thành bài thật, DB chỉ có đúng 1 bài.',
          'Đăng lúc offline với 5001 ký tự (nút "Điền 5001 ký tự"), rồi bật mạng: server trả 400 → mục chuyển "⛔ bị từ chối", giữ lại kèm lỗi và KHÔNG bị gửi lại (lỗi 4xx retry vô ích).',
          'Tăng "tỉ lệ lỗi" ở panel mô phỏng rồi đăng: retry dùng CÙNG idempotency key (log bên phải); hết lượt retry mà vẫn lỗi thì bài vào outbox.',
          'Bấm "Hết hạn session" rồi react vào một bài: session-log có đúng 1 dòng "POST /api/session/refresh" và reaction vẫn thành công. "Gọi 3 API song song" cũng chỉ refresh 1 lần (single-flight).',
          'Bấm "Xoá bài đầu tiên ở server" rồi react vào bài đó: reaction rollback, bài biến khỏi feed, toast "Bài viết không còn tồn tại". Nút "Kiểm tra chi tiết" trên bài đã xoá (GET /api/posts/:id → 404) hiện trạng thái "đã xoá". Còn GET /api/feed lỗi 404 thì chỉ là lỗi thường.',
          'Bấm "Đăng ký SW", tải lại trang (Network hiện "(ServiceWorker)"), cuộn/tải feed vài trang cho SW kịp cache. Khi ONLINE, response /api/feed đến từ mạng (nguồn feed: "mạng", không có header X-From-SW-Cache). Chọn Offline rồi bấm "Tải lại feed": feed vẫn hiện từ cache + banner "dữ liệu từ cache" (SW chỉ rơi về cache khi fetch lỗi mạng). Feed production hay dùng stale-while-revalidate + nhãn "dữ liệu cũ" ở tầng ứng dụng; ở đây SW chọn network-first để lesson khác (banner "feed đã cũ", poll bài mới) không bao giờ nhận bản cũ mà tưởng là mới. Cache tách theo viewer (SW nhận message set-viewer) và bị giới hạn 30 entry. Trong DEV, tải lại cả trang khi offline không chạy được vì module Vite cố ý không được cache (chạy `npm run build && npx vite preview` để thử). Học xong nhớ "Gỡ đăng ký SW" – SW đứng giữa mọi lesson.',
        ]}
        aside={
          <>
            <ServiceWorkerControls onLog={addLog} />
            <SessionAndServerControls onLog={addLog} onToast={showToast} />
            <div className="panel">
              <h2>Nhật ký (retry, outbox, SW)</h2>
              <ol className="event-log" data-testid="resilience-log">
                {log.map((line, index) => (
                  <li key={index} className="event-log__item">
                    {line}
                  </li>
                ))}
              </ol>
            </div>
          </>
        }
      >
        <div data-testid="network-banner" data-online={online} role="status" className={online ? 'l12-banner l12-banner--online' : 'l12-banner l12-banner--offline'}>
          {online ? '🟢 Online' : '🔴 Offline – bài đăng sẽ được lưu vào outbox và gửi khi có mạng'}
        </div>
        <div className="l12-banner" data-testid="feed-source">
          <span>
            Nguồn dữ liệu feed:{' '}
            <strong>{{ unknown: 'đang kiểm tra…', network: 'mạng', 'sw-cache': 'cache của service worker', unreachable: 'không tới được (offline, chưa có cache)' }[source]}</strong>
          </span>
          <button type="button" onClick={() => void probe()}>
            Kiểm tra lại
          </button>
          <button type="button" data-testid="reload-feed" onClick={() => setFeedKey((key) => key + 1)} title="Mount lại feed để tải lại trang đầu (đi qua service worker; bài tạm trong outbox được dựng lại sau khi trang đầu về)">
            Tải lại feed
          </button>
        </div>
        {source === 'sw-cache' && (
          <div className="l12-banner l12-banner--cache" data-testid="cache-banner" role="status">
            📦 Đang offline: feed lấy từ cache của service worker (header <code>X-From-SW-Cache: 1</code>) – có thể đã cũ. Có mạng lại thì "Tải lại feed" để lấy bản mới.
          </div>
        )}
        <ResilienceFeed key={feedKey} onLog={addLog} onToast={showToast} />
      </LessonLayout>
      <ToastStack toasts={toasts} />
    </ReactionFeedStoreProvider>
  );
}
