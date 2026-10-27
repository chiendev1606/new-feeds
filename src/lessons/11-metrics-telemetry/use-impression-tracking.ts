/**
 * Hook nối ImpressionTracker + đo Web Vitals vào React.
 *
 * - `trackRef(postId)` trả về callback ref ổn định (cache theo postId) để gắn vào wrapper của bài.
 *   Nếu tạo hàm mới mỗi lần render, React sẽ gỡ/gắn ref liên tục và observer bị observe lại vô ích.
 * - Tracker (kèm IntersectionObserver, timer) được TẠO TRONG EFFECT và dọn ở cleanup → không rò observer/timer khi rời
 *   lesson. An toàn với StrictMode (effect chạy → cleanup → chạy lại): callback ref không bắn lại sau lần đầu nên ta nhớ
 *   mọi element đang gắn trong `elementsRef` và observe lại chúng khi tracker mới được tạo.
 * - Web vital và impression đi chung MỘT hàng đợi → một lô có thể chứa cả hai loại.
 * - Khi trang ẩn: gửi LCP/CLS/INP chốt (chúng thay đổi dần) NẾU giá trị đã đổi so với lần gửi trước – đổi tab nhiều lần
 *   không sinh nhiều dòng giống hệt – rồi cho tracker beacon toàn bộ hàng đợi.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { TelemetryEvent } from '../../../shared-contracts/feed-api-contracts';
import { sendTelemetry } from '../../shared/api/feed-api';
import { ApiError, isRetryableStatus } from '../../shared/api/http-client';
import { pickChangedFinalVitals, type FinalVitalValues } from './changed-final-vitals';
import { ImpressionTracker, type SentBatchLog } from './impression-tracker';
import { observeWebVitals } from './web-vitals-observer';

export interface VitalsSnapshot {
  LCP?: number;
  CLS?: number;
  INP?: number;
  longTaskCount: number;
  longTaskMaxMs: number;
  /** entryType trình duyệt không hỗ trợ. */
  unsupported: string[];
}

const INITIAL_VITALS: VitalsSnapshot = { longTaskCount: 0, longTaskMaxMs: 0, unsupported: [] };
const MAX_LOGGED_BATCHES = 20;

// 📖 Bài học lesson-11 §2 – beacon dạng text/plain và phân loại lỗi đáng gửi lại (docs/lessons/lesson-11.md)
// #region learn:send-beacon-and-retry-policy
function sendWithBeacon(events: TelemetryEvent[]) {
  if (typeof navigator.sendBeacon !== 'function') return false;
  // text/plain là "CORS-safelisted": không gây preflight; server đã đọc được cả JSON lẫn text/plain.
  return navigator.sendBeacon('/api/telemetry', new Blob([JSON.stringify({ events })], { type: 'text/plain;charset=UTF-8' }));
}

/** Lỗi nào đáng gửi lại lô? Lỗi mạng (không phải ApiError) và 5xx/408/429; 4xx khác = lô bị từ chối vĩnh viễn. */
const isRetryableTelemetryError = (error: unknown) => !(error instanceof ApiError) || isRetryableStatus(error.status);
// #endregion learn:send-beacon-and-retry-policy

export function useImpressionTracking() {
  const [impressedIds, setImpressedIds] = useState<ReadonlySet<string>>(() => new Set());
  const [batches, setBatches] = useState<SentBatchLog[]>([]);
  const [vitals, setVitals] = useState<VitalsSnapshot>(INITIAL_VITALS);
  const vitalsRef = useRef<VitalsSnapshot>(INITIAL_VITALS);
  /** Giá trị LCP/CLS/INP đã gửi lần trước – để chỉ gửi khi đổi. Nằm ở ref nên sống qua việc effect chạy lại (StrictMode). */
  const lastSentFinalVitalsRef = useRef<FinalVitalValues>({});
  const trackerRef = useRef<ImpressionTracker | null>(null);
  const elementsRef = useRef(new Map<Element, string>());
  const refCache = useRef(new Map<string, (element: Element | null) => void>());

  // 📖 Bài học lesson-11 §5 – callback ref ổn định theo postId (docs/lessons/lesson-11.md)
  // #region learn:track-ref-stable-callback
  const trackRef = useCallback((postId: string) => {
    const cached = refCache.current.get(postId);
    if (cached) return cached;
    let current: Element | null = null;
    const callbackRef = (element: Element | null) => {
      if (current) {
        trackerRef.current?.unobserve(current);
        elementsRef.current.delete(current);
      }
      current = element;
      if (element) {
        elementsRef.current.set(element, postId);
        trackerRef.current?.observe(element, postId); // tracker có thể chưa tồn tại (ref chạy trước effect) → effect sẽ observe sau
      } else {
        refCache.current.delete(postId); // bài đã unmount: không để cache phình mãi
      }
    };
    refCache.current.set(postId, callbackRef);
    return callbackRef;
  }, []);
  // #endregion learn:track-ref-stable-callback

  // 📖 Bài học lesson-11 §5 – tracker tạo trong effect và observe lại element đang gắn (docs/lessons/lesson-11.md)
  // #region learn:tracker-created-in-effect
  useEffect(() => {
    const tracker = new ImpressionTracker({
      now: () => Date.now(),
      createObserver: (onEntries) => new IntersectionObserver((entries) => onEntries(entries), { threshold: [0.5] }),
      setTimeout: (callback, ms) => setTimeout(callback, ms),
      clearTimeout: (handle) => clearTimeout(handle),
      sendBatch: (events) => sendTelemetry({ events }),
      shouldRetry: isRetryableTelemetryError,
      onBatchDropped: (events, error) => console.warn(`Telemetry: server từ chối lô ${events.length} sự kiện, bỏ lô`, error),
      sendBeacon: sendWithBeacon,
      onImpression: (postId) => setImpressedIds((current) => new Set(current).add(postId)),
      onBatchSent: (log) => setBatches((current) => [log, ...current].slice(0, MAX_LOGGED_BATCHES)),
    });
    trackerRef.current = tracker;
    for (const [element, postId] of elementsRef.current) tracker.observe(element, postId);
  // #endregion learn:tracker-created-in-effect

    const stopVitals = observeWebVitals((name, value) => {
      const next = { ...vitalsRef.current };
      if (name === 'long-task') {
        next.longTaskCount += 1;
        next.longTaskMaxMs = Math.max(next.longTaskMaxMs, value);
        // Long task đi vào hàng đợi ngay (mỗi lần một sự kiện) để server tính p75.
        tracker.enqueue({ type: 'web-vital', name, value, at: new Date().toISOString() });
      } else {
        next[name] = value;
      }
      vitalsRef.current = next;
      setVitals(next);
    });
    vitalsRef.current = { ...vitalsRef.current, unsupported: stopVitals.unsupported };
    setVitals(vitalsRef.current);

    // 📖 Bài học lesson-11 §5 – ẩn trang thì chỉ gửi vital chốt đã đổi giá trị rồi beacon (docs/lessons/lesson-11.md)
    // #region learn:hidden-handler-final-vitals
    let hiddenHandled = false;
    const handleHidden = () => {
      if (hiddenHandled) return; // visibilitychange và pagehide thường bắn liên tiếp
      hiddenHandled = true;
      const at = new Date().toISOString();
      for (const { name, value } of pickChangedFinalVitals(vitalsRef.current, lastSentFinalVitalsRef.current)) {
        lastSentFinalVitalsRef.current = { ...lastSentFinalVitalsRef.current, [name]: value };
        tracker.enqueue({ type: 'web-vital', name, value, at });
      }
      tracker.handlePageHidden();
    };
    const handleVisible = () => {
      hiddenHandled = false;
      tracker.handlePageVisible();
    };
    const onVisibilityChange = () => (document.visibilityState === 'hidden' ? handleHidden() : handleVisible());

    document.addEventListener('visibilitychange', onVisibilityChange);
    addEventListener('pagehide', handleHidden);
    // #endregion learn:hidden-handler-final-vitals
    addEventListener('pageshow', handleVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      removeEventListener('pagehide', handleHidden);
      removeEventListener('pageshow', handleVisible);
      stopVitals.stop();
      // Rời lesson cũng là "rời trang" với tracker: chốt dwell + gửi nốt, rồi dọn observer/timer.
      handleHidden();
      tracker.dispose();
      trackerRef.current = null;
    };
  }, []);

  const flushNow = useCallback(() => trackerRef.current?.flush(), []);

  return { trackRef, impressedIds, batches, vitals, flushNow };
}
