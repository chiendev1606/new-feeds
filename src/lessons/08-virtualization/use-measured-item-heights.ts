/**
 * Đo chiều cao thật của từng item bằng ResizeObserver và cache theo post id.
 * Item bị unmount (ra khỏi viewport) vẫn giữ chiều cao đã đo → cuộn ngược lại không bị nhảy.
 *
 * Chiều cao đổi sau khi render (ảnh tải xong, bấm "Xem thêm") → ResizeObserver báo → cập nhật cache.
 * Nếu item đó nằm PHÍA TRÊN viewport, nội dung bên dưới bị đẩy xuống → gọi onShiftAboveViewport
 * để list bù lại scroll (scroll anchoring thủ công).
 *
 * Hai cái bẫy đã gặp khi viết hook này:
 *   1. Phần tử vừa bị gỡ khỏi DOM vẫn có thể nhận callback ResizeObserver với chiều cao = 0.
 *      Nếu ghi số 0 đó vào cache, list tưởng các bài đã cuộn qua chỉ cao 0px → khoảng render nhảy loạn.
 *      → Bỏ qua (và unobserve) mọi phần tử không còn isConnected.
 *   2. React gọi ref(null) TRƯỚC khi gỡ node khỏi DOM, nên lúc đó isConnected vẫn = true.
 *      → Lưu phần tử theo id để unobserve chắc chắn, không dựa vào isConnected.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

type RefCallback = (element: HTMLElement | null) => void;

export function useMeasuredItemHeights(onShiftAboveViewport: (deltaPx: number) => void) {
  const heightsRef = useRef(new Map<string, number>());
  const elementByIdRef = useRef(new Map<string, HTMLElement>());
  const idByElementRef = useRef(new WeakMap<Element, string>());
  const refCallbacksRef = useRef(new Map<string, RefCallback>());
  const observerRef = useRef<ResizeObserver | null>(null);
  const [version, setVersion] = useState(0);
  const shiftRef = useRef(onShiftAboveViewport);
  shiftRef.current = onShiftAboveViewport;

  // Observer tạo trong effect (không trong render) và quan sát lại các phần tử đang mount.
  useEffect(() => {
    // 📖 Bài học lesson-08 §3 – đo chiều cao, bỏ qua phần tử đã gỡ, bù scroll (docs/lessons/lesson-08.md)
    // #region learn:resize-observer-measure
    const observer = new ResizeObserver((entries) => {
      let changed = false;
      for (const entry of entries) {
        const id = idByElementRef.current.get(entry.target);
        if (!id) continue;
        if (!entry.target.isConnected) {
          observer.unobserve(entry.target);
          continue;
        }
        const height = entry.borderBoxSize[0]?.blockSize ?? entry.contentRect.height;
        const previous = heightsRef.current.get(id);
        if (previous === height) continue;
        heightsRef.current.set(id, height);
        changed = true;
        // Item đã đo trước đó, nằm hẳn trên mép trên màn hình, vừa đổi chiều cao → bù scroll.
        if (previous !== undefined && entry.target.getBoundingClientRect().bottom < 0) {
          shiftRef.current(height - previous);
        }
      }
      if (changed) setVersion((value) => value + 1);
    });
    // #endregion learn:resize-observer-measure
    observerRef.current = observer;
    elementByIdRef.current.forEach((element) => observer.observe(element));
    return () => {
      observer.disconnect();
      observerRef.current = null;
    };
  }, []);

  // 📖 Bài học lesson-08 §3 – cache callback ref theo id (docs/lessons/lesson-08.md)
  // #region learn:measure-ref-cache
  /** Gắn vào item: <div ref={measureRef(postId)}>. Callback được cache theo id → React không detach/attach mỗi lần render. */
  const measureRef = useCallback((id: string): RefCallback => {
    let callback = refCallbacksRef.current.get(id);
    if (!callback) {
      callback = (element) => {
        const previous = elementByIdRef.current.get(id);
        if (previous && previous !== element) {
          observerRef.current?.unobserve(previous);
          elementByIdRef.current.delete(id);
        }
        if (element) {
          elementByIdRef.current.set(id, element);
          idByElementRef.current.set(element, id);
          observerRef.current?.observe(element);
        }
      };
      refCallbacksRef.current.set(id, callback);
    }
    return callback;
  }, []);
  // #endregion learn:measure-ref-cache

  const getHeight = useCallback((id: string) => heightsRef.current.get(id), []);

  return { measureRef, getHeight, version };
}
