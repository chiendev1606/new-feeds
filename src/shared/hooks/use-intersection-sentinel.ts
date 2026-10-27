/**
 * Infinite scroll bằng IntersectionObserver (không dùng scroll event).
 *
 * Vì sao không nghe sự kiện scroll?
 *   - scroll bắn hàng chục lần/giây trên main thread; đọc getBoundingClientRect() trong đó gây
 *     "forced layout" → giật. IntersectionObserver được trình duyệt tính toán bất đồng bộ.
 *
 * rootMargin "100% 0px" = mở rộng vùng quan sát thêm 1 viewport phía dưới
 * → bắt đầu tải trang tiếp khi người dùng còn cách cuối list khoảng 1 màn hình (prefetch),
 *   nên thường không bao giờ thấy skeleton khi cuộn bình thường.
 */
import { useEffect, useRef, useState } from 'react';

export interface IntersectionSentinelOptions {
  rootMargin?: string;
  enabled?: boolean;
  /**
   * Đổi giá trị này (vd số bài đã tải) để observe lại. Cần thiết vì IntersectionObserver chỉ báo
   * khi trạng thái giao nhau THAY ĐỔI: nếu tải xong mà sentinel vẫn còn trong vùng quan sát
   * (trang ngắn hơn màn hình) thì sẽ không có callback mới → feed "kẹt". Observe lại = nhận
   * callback ban đầu ngay lập tức.
   */
  observeKey?: unknown;
}

/** Trả về ref callback để gắn vào phần tử sentinel: <div ref={sentinelRef} />. */
export function useIntersectionSentinel(onIntersect: () => void, { rootMargin = '100% 0px', enabled = true, observeKey }: IntersectionSentinelOptions = {}) {
  const [element, setElement] = useState<Element | null>(null);
  const callbackRef = useRef(onIntersect);
  callbackRef.current = onIntersect;

  useEffect(() => {
    if (!enabled || !element) return;
    const observer = new IntersectionObserver((entries) => entries.some((entry) => entry.isIntersecting) && callbackRef.current(), { rootMargin });
    observer.observe(element);
    return () => observer.disconnect();
  }, [element, enabled, rootMargin, observeKey]);

  return setElement;
}
