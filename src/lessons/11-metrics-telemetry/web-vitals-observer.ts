/**
 * Đo Core Web Vitals ngay trên trình duyệt người dùng bằng PerformanceObserver ("RUM" – real user monitoring).
 *
 * Ý tưởng system design: lab test (Lighthouse) chỉ cho một điểm trên máy dev; số liệu thật phải đo ở
 * người dùng thật rồi gửi về server để tính p75. `buffered: true` cho phép lấy cả các entry đã xảy ra
 * TRƯỚC khi observer được tạo (LCP thường xong trước khi React kịp mount lesson).
 *
 * Đây là bản gần đúng để học – production nên dùng thư viện `web-vitals` (xử lý bfcache, tab ẩn,
 * attribution, ...). Khác biệt chính: INP của web-vitals lấy gần p98 của các tương tác (bỏ 1 tương
 * tác tệ nhất mỗi 50 tương tác), còn ở đây lấy tương tác chậm nhất (max).
 */
import type { WebVitalName } from '../../../shared-contracts/feed-api-contracts';

// 📖 Bài học lesson-11 §3 – CLS tính theo cửa sổ phiên, bỏ qua dịch chuyển sau input (docs/lessons/lesson-11.md)
// #region learn:cls-session-window
/** Cửa sổ phiên của CLS (web.dev): nghỉ > 1s thì mở cửa sổ mới, mỗi cửa sổ tối đa 5s. */
const CLS_SESSION_GAP_MS = 1000;
const CLS_SESSION_MAX_MS = 5000;

export interface ClsState {
  /** Tổng các dịch chuyển trong cửa sổ hiện tại. */
  sessionValue: number;
  sessionStart: number;
  lastShiftAt: number;
  /** CLS cuối cùng = cửa sổ tệ nhất từng thấy. */
  worst: number;
}

export const INITIAL_CLS_STATE: ClsState = { sessionValue: 0, sessionStart: 0, lastShiftAt: 0, worst: 0 };

export interface LayoutShiftLike {
  value: number;
  hadRecentInput: boolean;
  startTime: number;
}

/** Hàm thuần: cộng một layout-shift vào cửa sổ phiên. Dịch chuyển ngay sau input người dùng bị bỏ qua. */
export function accumulateLayoutShift(state: ClsState, shift: LayoutShiftLike): ClsState {
  if (shift.hadRecentInput) return state;
  const startsNewWindow =
    state.sessionValue === 0 ||
    shift.startTime - state.lastShiftAt > CLS_SESSION_GAP_MS ||
    shift.startTime - state.sessionStart > CLS_SESSION_MAX_MS;
  const sessionValue = startsNewWindow ? shift.value : state.sessionValue + shift.value;
  return {
    sessionValue,
    sessionStart: startsNewWindow ? shift.startTime : state.sessionStart,
    lastShiftAt: shift.startTime,
    worst: Math.max(state.worst, sessionValue),
  };
}
// #endregion learn:cls-session-window

interface EventTimingLike extends PerformanceEntry {
  interactionId?: number;
}

export interface WebVitalsObserverHandle {
  stop: () => void;
  /** Các entryType trình duyệt không hỗ trợ (vd Safari không có longtask/event) – để UI báo rõ. */
  unsupported: string[];
}

function isSupported(entryType: string) {
  return typeof PerformanceObserver !== 'undefined' && (PerformanceObserver.supportedEntryTypes?.includes(entryType) ?? false);
}

/**
 * onUpdate(name, value):
 *  - LCP/CLS/INP: giá trị HIỆN TẠI (thay đổi dần theo thời gian) → gửi giá trị cuối khi trang ẩn.
 *  - long-task: mỗi lần gọi là thời lượng của MỘT long task.
 */
export function observeWebVitals(onUpdate: (name: WebVitalName, value: number) => void): WebVitalsObserverHandle {
  const observers: PerformanceObserver[] = [];
  const cleanups: Array<() => void> = [];
  const unsupported: string[] = [];

  const observe = (type: string, handler: (entries: PerformanceEntryList) => void, extra: Record<string, unknown> = {}) => {
    if (!isSupported(type)) {
      unsupported.push(type);
      return;
    }
    try {
      const observer = new PerformanceObserver((list) => handler(list.getEntries()));
      // buffered: nhận cả entry đã xảy ra trước khi observer được tạo.
      observer.observe({ type, buffered: true, ...extra });
      observers.push(observer);
    } catch {
      unsupported.push(type);
    }
  };

  // 📖 Bài học lesson-11 §3 – LCP lấy entry cuối và dừng sau tương tác đầu tiên (docs/lessons/lesson-11.md)
  // #region learn:observe-lcp-and-cls
  // LCP: trình duyệt báo nhiều lần khi có phần tử lớn hơn xuất hiện → lấy entry CUỐI CÙNG,
  // và ngừng cập nhật sau tương tác đầu tiên (người dùng tương tác là LCP "chốt").
  let lcpFrozen = false;
  const freezeLcp = () => {
    lcpFrozen = true;
  };
  for (const type of ['keydown', 'pointerdown'] as const) {
    addEventListener(type, freezeLcp, { once: true, capture: true });
    cleanups.push(() => removeEventListener(type, freezeLcp, { capture: true }));
  }
  observe('largest-contentful-paint', (entries) => {
    const last = entries[entries.length - 1];
    if (last && !lcpFrozen) onUpdate('LCP', last.startTime);
  });

  let cls = INITIAL_CLS_STATE;
  observe('layout-shift', (entries) => {
    for (const entry of entries) cls = accumulateLayoutShift(cls, entry as unknown as LayoutShiftLike);
    onUpdate('CLS', cls.worst);
  });
  // #endregion learn:observe-lcp-and-cls

  // 📖 Bài học lesson-11 §3 – INP gần đúng gom theo interactionId (docs/lessons/lesson-11.md)
  // #region learn:observe-inp-by-interaction
  // INP gần đúng: gom entry `event` theo interactionId (một click sinh nhiều event: pointerdown, pointerup, click…),
  // mỗi tương tác lấy duration lớn nhất; INP = tương tác chậm nhất. durationThreshold thấp để thấy cả tương tác vừa phải.
  const durationByInteraction = new Map<number, number>();
  observe(
    'event',
    (entries) => {
      let worst = 0;
      for (const entry of entries as EventTimingLike[]) {
        if (!entry.interactionId) continue; // không phải tương tác (vd mousemove)
        durationByInteraction.set(entry.interactionId, Math.max(durationByInteraction.get(entry.interactionId) ?? 0, entry.duration));
      }
      for (const duration of durationByInteraction.values()) worst = Math.max(worst, duration);
      if (worst > 0) onUpdate('INP', worst);
    },
    { durationThreshold: 16 },
  );
  // #endregion learn:observe-inp-by-interaction

  observe('longtask', (entries) => {
    for (const entry of entries) onUpdate('long-task', entry.duration);
  });

  return {
    unsupported,
    stop: () => {
      for (const observer of observers) observer.disconnect();
      for (const cleanup of cleanups) cleanup();
    },
  };
}
