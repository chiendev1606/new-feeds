/**
 * Đăng ký Background Sync tag 'flush-outbox' – BEST-EFFORT.
 *
 * Background Sync (Chromium) cho phép trình duyệt đánh thức service worker khi có mạng lại, kể cả khi tab đã
 * đóng. Safari/Firefox không có → hàm trả false và mọi thứ vẫn chạy nhờ vòng flush trong tab
 * (sự kiện 'online' + khi load trang + interval). Vì vậy KHÔNG BAO GIỜ được phụ thuộc vào Background Sync
 * để đảm bảo bài được gửi; nó chỉ là đường tăng tốc thêm.
 */
// 📖 Bài học lesson-12 §6 – Background Sync chỉ là phần thêm, không được phụ thuộc (docs/lessons/lesson-12.md)
// #region learn:register-background-sync
type SyncCapableRegistration = ServiceWorkerRegistration & { sync?: { register(tag: string): Promise<void> } };

export const FLUSH_OUTBOX_SYNC_TAG = 'flush-outbox';

export async function registerBackgroundSync(): Promise<boolean> {
  try {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return false;
    const registration = (await navigator.serviceWorker.getRegistration()) as SyncCapableRegistration | undefined;
    if (!registration?.sync) return false;
    await registration.sync.register(FLUSH_OUTBOX_SYNC_TAG);
    return true;
  } catch {
    return false; // bị từ chối quyền / SW chưa active… → im lặng, đường flush trong tab vẫn đúng
  }
}
// #endregion learn:register-background-sync
