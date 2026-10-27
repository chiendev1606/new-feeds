/**
 * Theo dõi trạng thái mạng của trình duyệt qua sự kiện 'online' / 'offline'.
 *
 * Lưu ý cho system design: navigator.onLine chỉ nói "có card mạng/kết nối tới router" – `true`
 * KHÔNG đảm bảo tới được server (captive portal, server sập). Vì vậy online là gợi ý để thử flush
 * outbox sớm; còn "đã gửi được hay chưa" luôn do kết quả request thật quyết định.
 */
// 📖 Bài học lesson-12 – useSyncExternalStore theo sự kiện online và offline (docs/lessons/lesson-12.md)
// #region learn:use-online-status
import { useSyncExternalStore } from 'react';

export const getOnlineStatus = () => (typeof navigator === 'undefined' ? true : navigator.onLine);

function subscribe(onChange: () => void) {
  window.addEventListener('online', onChange);
  window.addEventListener('offline', onChange);
  return () => {
    window.removeEventListener('online', onChange);
    window.removeEventListener('offline', onChange);
  };
}

export function useOnlineStatus(): boolean {
  return useSyncExternalStore(subscribe, getOnlineStatus, () => true);
}
// #endregion learn:use-online-status
