/**
 * Điều khiển service worker – CHỈ dùng trong lesson 12 (ở app thật SW được đăng ký tự động lúc khởi động).
 *
 * Vòng đời cần nhớ: register → install → activate → (clients.claim) → tab trở thành "controlled".
 * Gỡ đăng ký KHÔNG làm tab thôi bị điều khiển ngay: controller còn đó cho tới khi tải lại trang.
 * SW đăng ký ở scope '/' nên mọi request của MỌI lesson đều đi qua nó cho tới khi gỡ. Feed là network-first nên online
 * mọi lesson vẫn thấy dữ liệu mới; cache (tách theo viewer) chỉ được dùng khi mất mạng.
 * Dev + HMR: sw.js bỏ qua /src/, /@vite/… nên không cản HMR; tuy vậy khi sửa sw.js hãy "Gỡ đăng ký" rồi đăng ký lại.
 */
import { useCallback, useEffect, useState } from 'react';
import { getSession } from '../../shared/api/feed-api';
import { toErrorMessage } from '../../shared/utils/to-error-message';

// Phải khớp CACHE_PREFIX trong public/sw.js.
const CACHE_PREFIX = 'newsfeed-v2-';

// 📖 Bài học lesson-12 §6 – tab báo viewer cho service worker để cache tách theo người dùng (docs/lessons/lesson-12.md)
// #region learn:announce-viewer-to-sw
/**
 * Báo cho service worker biết ai đang dùng app: SW dùng viewerId làm tên cache feed (cache tách theo người dùng) và
 * KHÔNG cache feed khi chưa biết viewer. Gọi lại mỗi khi SW vừa active/giành quyền điều khiển, vì SW có thể là bản mới.
 * Lỗi (chưa có session, mạng rớt) thì bỏ qua: hậu quả chỉ là feed chưa được cache, không phải sai dữ liệu.
 */
async function announceViewerToServiceWorker(target: ServiceWorker | null | undefined): Promise<void> {
  if (!target) return;
  try {
    const { viewerId } = await getSession();
    target.postMessage({ type: 'set-viewer', viewerId });
  } catch {
    /* chưa có viewer → SW không cache feed, đúng ý */
  }
}
// #endregion learn:announce-viewer-to-sw

/** Nhờ SW xoá cache (message 'clear-caches'); không có controller thì tự xoá từ trang. Trả về số cache đã xoá. */
async function clearCaches(): Promise<number> {
  const controller = navigator.serviceWorker?.controller;
  if (controller) {
    return new Promise<number>((resolve, reject) => {
      const channel = new MessageChannel();
      const timer = setTimeout(() => reject(new Error('Service worker không phản hồi')), 3000);
      channel.port1.onmessage = (event: MessageEvent<{ deleted: number }>) => {
        clearTimeout(timer);
        resolve(event.data.deleted);
      };
      controller.postMessage({ type: 'clear-caches' }, [channel.port2]);
    });
  }
  const names = (await caches.keys()).filter((name) => name.startsWith(CACHE_PREFIX));
  await Promise.all(names.map((name) => caches.delete(name)));
  return names.length;
}

export function ServiceWorkerControls({ onLog }: { onLog: (line: string) => void }) {
  const supported = typeof navigator !== 'undefined' && 'serviceWorker' in navigator;
  const [registered, setRegistered] = useState(false);
  const [controlled, setControlled] = useState(supported && Boolean(navigator.serviceWorker.controller));
  const [busy, setBusy] = useState(false);

  const syncState = useCallback(async () => {
    if (!supported) return;
    setRegistered(Boolean(await navigator.serviceWorker.getRegistration()));
    setControlled(Boolean(navigator.serviceWorker.controller));
  }, [supported]);

  useEffect(() => {
    if (!supported) return;
    void syncState();
    const onControllerChange = () => {
      void syncState();
      void announceViewerToServiceWorker(navigator.serviceWorker.controller);
    };
    // Trang đã được SW điều khiển từ trước (vd sau khi tải lại) → báo viewer ngay, không chờ controllerchange.
    void announceViewerToServiceWorker(navigator.serviceWorker.controller);
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);
    return () => navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
  }, [supported, syncState]);

  const run = async (label: string, action: () => Promise<string>) => {
    setBusy(true);
    try {
      onLog(`🛠 ${label}: ${await action()}`);
    } catch (error) {
      onLog(`⚠️ ${label} lỗi: ${toErrorMessage(error)}`);
    } finally {
      setBusy(false);
      await syncState();
    }
  };

  if (!supported) {
    return (
      <div className="panel" data-testid="sw-controls">
        <h2>Service worker</h2>
        <p className="muted">Trình duyệt (hoặc ngữ cảnh không an toàn – cần HTTPS/localhost) không hỗ trợ service worker.</p>
      </div>
    );
  }

  return (
    <div className="panel" data-testid="sw-controls">
      <h2>Service worker</h2>
      <p data-testid="sw-status">
        Đăng ký: <strong>{registered ? 'có' : 'chưa'}</strong> · <code>navigator.serviceWorker.controller</code>:{' '}
        <strong data-testid="sw-controller">{controlled ? 'có (trang đang được SW điều khiển)' : 'null'}</strong>
      </p>
      <div className="l12-actions">
        <button
          type="button"
          data-testid="sw-register"
          disabled={busy}
          onClick={() =>
            void run('đăng ký', async () => {
              await navigator.serviceWorker.register('/sw.js', { scope: '/' });
              const registration = await navigator.serviceWorker.ready;
              await announceViewerToServiceWorker(registration.active);
              return 'SW đã active. Tải lại trang để các request của lần tải đầu cũng đi qua SW (và được cache).';
            })
          }
        >
          Đăng ký SW
        </button>
        <button
          type="button"
          data-testid="sw-unregister"
          disabled={busy}
          onClick={() =>
            void run('gỡ đăng ký', async () => {
              const registration = await navigator.serviceWorker.getRegistration();
              const done = registration ? await registration.unregister() : false;
              return done ? 'đã gỡ. Controller còn tới khi tải lại trang.' : 'không có gì để gỡ';
            })
          }
        >
          Gỡ đăng ký
        </button>
        <button type="button" data-testid="sw-clear-caches" disabled={busy} onClick={() => void run('xoá cache', async () => `đã xoá ${await clearCaches()} cache ${CACHE_PREFIX}*`)}>
          Xoá cache
        </button>
      </div>
    </div>
  );
}
