/**
 * Primitive tải lười có "preload" – nền tảng của lesson 10.
 *
 * Ý tưởng system design: tách JS theo MỨC ĐỘ CẦN THIẾT (tier). Code chỉ cần khi người dùng tương tác
 * (menu cảm xúc, hover card, emoji picker) không nên nằm trong bundle đầu. Nhưng "tải lúc bấm" sẽ làm UI
 * khựng một nhịp chờ mạng → ta DỰ ĐOÁN ý định (pointerenter, focus, lúc rảnh, dữ liệu vừa về) và gọi
 * preload() sớm, để tới lúc cần chunk đã nằm sẵn trong cache.
 *
 * Quan trọng: React.lazy và preload() PHẢI dùng chung MỘT Promise của import(). Nếu mỗi nơi gọi factory
 * riêng, trình duyệt vẫn dedupe module nhưng ta mất kiểm soát (gọi factory nhiều lần, khó test, khó đo).
 */
import { lazy, type ComponentType, type LazyExoticComponent } from 'react';

// `any` có chủ đích: đây là ràng buộc generic y hệt chữ ký của React.lazy (ComponentType<any>);
// kiểu props thật được giữ nguyên qua tham số T nên nơi dùng vẫn được kiểm tra chặt.
export type AnyComponent = ComponentType<any>;

export type PreloadableLazyComponent<T extends AnyComponent> = LazyExoticComponent<T> & {
  /** Bắt đầu tải chunk (nếu chưa). Gọi nhiều lần luôn trả CÙNG một Promise. */
  preload: () => Promise<{ default: T }>;
};

// 📖 Bài học lesson-10 – React.lazy và preload dùng chung một Promise của import() (docs/lessons/lesson-10.md)
// #region learn:lazy-with-preload
export function lazyWithPreload<T extends AnyComponent>(factory: () => Promise<{ default: T }>): PreloadableLazyComponent<T> {
  let promise: Promise<{ default: T }> | null = null;
  const load = () => {
    if (!promise) {
      promise = factory();
      // Tải lỗi (mất mạng giữa chừng) → cho phép preload lần sau thử lại thay vì kẹt vĩnh viễn với promise đã reject.
      // (React.lazy tự nó vẫn nhớ lỗi → cần ChunkErrorBoundary + tải lại trang, xem chunk-error-boundary.tsx.)
      promise.catch(() => {
        promise = null;
      });
    }
    return promise;
  };
  const Component = lazy(load) as PreloadableLazyComponent<T>;
  Component.preload = load;
  return Component;
}
// #endregion learn:lazy-with-preload

// 📖 Bài học lesson-10 – prefetch ưu tiên thấp khi trình duyệt rảnh (docs/lessons/lesson-10.md)
// #region learn:preload-on-idle
/**
 * Chạy `task` khi trình duyệt rảnh (requestIdleCallback), không có thì setTimeout.
 * Trả về hàm huỷ – dùng trong cleanup của useEffect.
 * Dùng cho prefetch "ưu tiên thấp": không tranh băng thông/CPU với việc render nội dung chính.
 */
export function preloadOnIdle(task: () => void, timeoutMs = 2000): () => void {
  if (typeof globalThis.requestIdleCallback === 'function') {
    const handle = globalThis.requestIdleCallback(task, { timeout: timeoutMs });
    return () => globalThis.cancelIdleCallback(handle);
  }
  // Safari chưa có requestIdleCallback: setTimeout là phương án thay thế gần đúng.
  const handle = setTimeout(task, 200);
  return () => clearTimeout(handle);
}
// #endregion learn:preload-on-idle
