/**
 * Hỏi "feed đang lấy từ đâu?" – từ mạng hay từ cache của Service Worker.
 *
 * http-client chỉ trả JSON nên không thấy header. Ta gửi MỘT fetch riêng (cùng đường đi qua service worker)
 * tới /api/feed rồi đọc header X-From-SW-Cache mà sw.js gắn vào response lấy từ cache.
 * Cách xem trực tiếp: DevTools → Network → chọn request /api/feed → Response Headers có "X-From-SW-Cache: 1",
 * cột Size ghi "(ServiceWorker)".
 * SW dùng network-first cho feed nên header CHỈ xuất hiện khi mạng lỗi và SW trả bản cache; online luôn là 'network'.
 * Lưu ý: đây là request thăm dò (count=1), không phải chính request của feed – nhưng cùng chiến lược cache
 * (cache của viewer hiện tại; chưa có thì offline sẽ ra 'unreachable').
 */
import { useCallback, useEffect, useState } from 'react';
import { useOnlineStatus } from '../../shared/offline/use-online-status';

export type CacheSource = 'unknown' | 'network' | 'sw-cache' | 'unreachable';

const PROBE_URL = '/api/feed?count=1&direction=older';

export function useCacheSourceProbe() {
  const online = useOnlineStatus();
  const [source, setSource] = useState<CacheSource>('unknown');

  // 📖 Bài học lesson-12 §5 – đọc header X-From-SW-Cache để biết feed đến từ mạng hay cache (docs/lessons/lesson-12.md)
  // #region learn:probe-cache-source
  const probe = useCallback(async () => {
    try {
      const response = await fetch(PROBE_URL, { credentials: 'same-origin' });
      if (!response.ok) return setSource('unreachable');
      setSource(response.headers.get('X-From-SW-Cache') === '1' ? 'sw-cache' : 'network');
    } catch {
      setSource('unreachable'); // offline và không có service worker/cache
    }
  }, []);
  // #endregion learn:probe-cache-source

  // Thăm dò lại khi trạng thái mạng đổi và khi service worker bắt đầu/ngừng điều khiển trang.
  useEffect(() => {
    void probe();
    const serviceWorker = typeof navigator !== 'undefined' ? navigator.serviceWorker : undefined;
    serviceWorker?.addEventListener('controllerchange', probe);
    return () => serviceWorker?.removeEventListener('controllerchange', probe);
  }, [probe, online]);

  return { source, probe };
}
