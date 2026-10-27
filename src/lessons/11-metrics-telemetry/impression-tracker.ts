/**
 * ImpressionTracker – đếm "lượt hiển thị" (impression) và thời gian xem (dwell) của từng bài, gửi theo lô.
 *
 * Ý tưởng system design:
 *  1. Định nghĩa impression phải CHẶT: bài hiện ≥ 50% diện tích và LIÊN TỤC ≥ 1 giây mới tính
 *     (cuộn lướt qua không phải là "đã xem"). Mỗi bài chỉ tính 1 lần mỗi phiên, kể cả cuộn đi cuộn lại.
 *  2. Telemetry là việc phụ, không được làm chậm app: gom vào hàng đợi rồi gửi theo lô
 *     (đủ 20 sự kiện HOẶC mỗi 5 giây) thay vì 1 request/sự kiện.
 *  3. Khi người dùng rời trang, fetch thường bị huỷ. `navigator.sendBeacon` được trình duyệt đảm bảo
 *     gửi đi ngay cả khi tab đóng → dùng khi `visibilitychange` sang hidden / `pagehide`
 *     (sự kiện `unload` không đáng tin, và làm hỏng bfcache).
 *  4. Mọi phụ thuộc môi trường (đồng hồ, observer, timer, mạng) truyền qua tham số → test được trong
 *     Node bằng fake timer + fake observer, không cần trình duyệt.
 *
 * Giới hạn đã biết: dùng ngưỡng ratio ≥ 0.5 nên bài cao hơn 2 lần viewport không bao giờ đạt 50%
 * (production thường thêm điều kiện "chiếm ≥ 50% viewport").
 */
import type { TelemetryEvent } from '../../../shared-contracts/feed-api-contracts';

export const IMPRESSION_MIN_VISIBLE_MS = 1000;
export const VISIBLE_RATIO_THRESHOLD = 0.5;
export const BATCH_SIZE = 20;
export const FLUSH_INTERVAL_MS = 5000;
/** Server nhận tối đa 200 sự kiện mỗi lô. */
const MAX_EVENTS_PER_REQUEST = 200;

type TimerHandle = ReturnType<typeof setTimeout>;

export interface VisibilityEntry {
  target: Element;
  isIntersecting: boolean;
  intersectionRatio: number;
}

export interface TargetObserver {
  observe: (target: Element) => void;
  unobserve: (target: Element) => void;
  disconnect: () => void;
}

export interface SentBatchLog {
  method: 'fetch' | 'beacon';
  size: number;
  /** Thời điểm gửi (epoch ms theo clock được inject). */
  at: number;
  ok: boolean;
  /** true khi lô bị BỎ (server từ chối kiểu không retry được) thay vì xếp lại hàng đợi. */
  dropped?: boolean;
}

export interface ImpressionTrackerDeps {
  now: () => number;
  createObserver: (onEntries: (entries: VisibilityEntry[]) => void) => TargetObserver;
  setTimeout: (callback: () => void, ms: number) => TimerHandle;
  clearTimeout: (handle: TimerHandle) => void;
  /** Gửi bình thường (fetch keepalive). Reject khi lỗi → lô được xếp lại hàng đợi, trừ khi `shouldRetry` nói không. */
  sendBatch: (events: TelemetryEvent[]) => Promise<void>;
  /**
   * Lỗi này có đáng gửi lại không? Mặc định true (mọi lỗi). Lô bị server từ chối kiểu 4xx (sai định dạng, quá lớn…) mà cứ xếp lại
   * thì lần nào cũng bị từ chối y hệt và CHẶN mọi lô sau nó, retry mãi → phải bỏ lô đó. Chỉ lỗi mạng/5xx mới giữ lại.
   */
  shouldRetry?: (error: unknown) => boolean;
  /** Lô bị bỏ vì lỗi không retry được (để ghi log). */
  onBatchDropped?: (events: TelemetryEvent[], error: unknown) => void;
  /** navigator.sendBeacon – trả false nếu trình duyệt từ chối xếp hàng. */
  sendBeacon: (events: TelemetryEvent[]) => boolean;
  onImpression?: (postId: string) => void;
  onBatchSent?: (log: SentBatchLog) => void;
}

interface TrackedPost {
  postId: string;
  /** Đang nằm trong viewport (≥ 50%) – kể cả lúc trang bị ẩn. */
  inViewport: boolean;
  /** Mốc bắt đầu đoạn hiển thị liên tục hiện tại; null nếu không đang đo. */
  visibleSince: number | null;
  /** Timer chờ đủ 1 giây để tính impression. */
  impressionTimer: TimerHandle | null;
}

export class ImpressionTracker {
  private readonly posts = new Map<Element, TrackedPost>();
  /** Bài đã tính impression trong phiên này (theo postId, không theo element → remount không đếm lại). */
  private readonly countedPostIds = new Set<string>();
  private readonly observer: TargetObserver;
  private queue: TelemetryEvent[] = [];
  private flushTimer: TimerHandle | null = null;
  private pageHidden = false;

  constructor(private readonly deps: ImpressionTrackerDeps) {
    this.observer = deps.createObserver((entries) => this.handleEntries(entries));
  }

  observe(element: Element, postId: string) {
    if (this.posts.has(element)) return;
    this.posts.set(element, { postId, inViewport: false, visibleSince: null, impressionTimer: null });
    this.observer.observe(element);
  }

  unobserve(element: Element) {
    const post = this.posts.get(element);
    if (!post) return;
    this.endVisibleSpan(post); // bài bị gỡ khỏi DOM: chốt dwell đang dở
    this.observer.unobserve(element);
    this.posts.delete(element);
  }

  // 📖 Bài học lesson-11 §2 – hàng đợi chung, gửi khi đủ lô hoặc đến hạn, lỗi tạm thời thì xếp lại (docs/lessons/lesson-11.md)
  // #region learn:tracker-enqueue-and-flush
  /** Thêm sự kiện bất kỳ (vd web-vital) vào CÙNG hàng đợi → đi chung lô với impression. */
  enqueue(event: TelemetryEvent) {
    this.queue.push(event);
    if (this.queue.length >= BATCH_SIZE) {
      void this.flush();
    } else {
      this.scheduleFlush();
    }
  }

  /** Gửi ngay bằng fetch (đủ lô, đến hạn 5s, hoặc bấm "Gửi ngay"). */
  async flush() {
    this.clearFlushTimer();
    const events = this.drain();
    if (events.length === 0) return;
    try {
      await this.deps.sendBatch(events);
      this.deps.onBatchSent?.({ method: 'fetch', size: events.length, at: this.deps.now(), ok: true });
    } catch (error) {
      if (this.deps.shouldRetry && !this.deps.shouldRetry(error)) {
        this.deps.onBatchDropped?.(events, error);
        this.deps.onBatchSent?.({ method: 'fetch', size: events.length, at: this.deps.now(), ok: false, dropped: true });
        return; // không xếp lại, không hẹn flush: lô này vô phương cứu
      }
      // Lỗi mạng/5xx: trả lô về ĐẦU hàng đợi (giữ thứ tự), giới hạn kích thước để không phình vô hạn.
      this.queue = [...events, ...this.queue].slice(-MAX_EVENTS_PER_REQUEST * 5);
      this.deps.onBatchSent?.({ method: 'fetch', size: events.length, at: this.deps.now(), ok: false });
      this.scheduleFlush();
    }
  }
  // #endregion learn:tracker-enqueue-and-flush

  // 📖 Bài học lesson-11 §2 – trang bị ẩn thì chốt dwell rồi gửi bằng beacon (docs/lessons/lesson-11.md)
  // #region learn:tracker-page-hidden
  /** Trang bị ẩn / pagehide: chốt dwell của mọi bài đang xem rồi gửi hàng đợi bằng sendBeacon. */
  handlePageHidden() {
    if (this.pageHidden) return;
    this.pageHidden = true;
    for (const post of this.posts.values()) this.endVisibleSpan(post);
    this.flushWithBeacon();
  }
  // #endregion learn:tracker-page-hidden

  /**
   * Dọn hết tài nguyên khi hook unmount: ngắt observer, huỷ mọi timer (impression đang chờ, hẹn flush). Gọi SAU
   * handlePageHidden() để dwell dở dang và hàng đợi đã được chốt/gửi. Sau dispose, instance này không dùng lại được.
   */
  dispose() {
    this.clearFlushTimer();
    for (const post of this.posts.values()) {
      if (post.impressionTimer !== null) this.deps.clearTimeout(post.impressionTimer);
      post.impressionTimer = null;
    }
    this.posts.clear();
    this.observer.disconnect();
  }

  /** Trang hiện lại: các bài vẫn trong viewport bắt đầu đoạn đo mới. */
  handlePageVisible() {
    if (!this.pageHidden) return;
    this.pageHidden = false;
    for (const post of this.posts.values()) if (post.inViewport) this.startVisibleSpan(post);
  }

  // 📖 Bài học lesson-11 §1 – impression cần ≥ 50% hiển thị liên tục ≥ 1 giây, mỗi bài một lần (docs/lessons/lesson-11.md)
  // #region learn:impression-visibility-spans
  private handleEntries(entries: VisibilityEntry[]) {
    for (const entry of entries) {
      const post = this.posts.get(entry.target);
      if (!post) continue;
      // threshold 0.5: callback chỉ bắn khi ratio vượt 0.5 lên/xuống; isIntersecting vẫn true ở ratio 0.3 nên phải xét ratio.
      const visible = entry.isIntersecting && entry.intersectionRatio >= VISIBLE_RATIO_THRESHOLD;
      if (visible === post.inViewport) continue;
      post.inViewport = visible;
      if (visible) this.startVisibleSpan(post);
      else this.endVisibleSpan(post);
    }
  }

  private startVisibleSpan(post: TrackedPost) {
    if (this.pageHidden || post.visibleSince !== null) return;
    post.visibleSince = this.deps.now();
    if (this.countedPostIds.has(post.postId)) return;
    post.impressionTimer = this.deps.setTimeout(() => {
      post.impressionTimer = null;
      if (this.countedPostIds.has(post.postId)) return;
      this.countedPostIds.add(post.postId);
      this.enqueue({ type: 'impression', postId: post.postId, at: this.isoNow() });
      this.deps.onImpression?.(post.postId);
    }, IMPRESSION_MIN_VISIBLE_MS);
  }

  /**
   * Kết thúc một đoạn hiển thị liên tục. Đoạn < 1s mà chưa tính impression thì bỏ (cuộn lướt qua);
   * ngược lại cộng vào dwell và gửi 1 sự kiện dwell (server cộng dồn theo bài).
   */
  private endVisibleSpan(post: TrackedPost) {
    if (post.impressionTimer !== null) {
      this.deps.clearTimeout(post.impressionTimer);
      post.impressionTimer = null;
    }
    if (post.visibleSince === null) return;
    const durationMs = this.deps.now() - post.visibleSince;
    post.visibleSince = null;
    if (this.countedPostIds.has(post.postId) && durationMs > 0) {
      this.enqueue({ type: 'dwell', postId: post.postId, durationMs, at: this.isoNow() });
    }
  }
  // #endregion learn:impression-visibility-spans

  // 📖 Bài học lesson-11 §2 – sendBeacon và phương án dự phòng fetch keepalive (docs/lessons/lesson-11.md)
  // #region learn:tracker-flush-with-beacon
  private flushWithBeacon() {
    this.clearFlushTimer();
    const events = this.drain();
    if (events.length === 0) return;
    const queued = this.deps.sendBeacon(events);
    this.deps.onBatchSent?.({ method: 'beacon', size: events.length, at: this.deps.now(), ok: queued });
    // Beacon bị từ chối (vd payload quá lớn): thử fetch keepalive như phương án dự phòng.
    if (!queued) {
      this.deps.sendBatch(events).catch(() => undefined);
    }
  }
  // #endregion learn:tracker-flush-with-beacon

  private drain() {
    const events = this.queue.splice(0, MAX_EVENTS_PER_REQUEST);
    if (this.queue.length > 0) this.scheduleFlush();
    return events;
  }

  private scheduleFlush() {
    if (this.flushTimer !== null) return;
    this.flushTimer = this.deps.setTimeout(() => {
      this.flushTimer = null;
      void this.flush();
    }, FLUSH_INTERVAL_MS);
  }

  private clearFlushTimer() {
    if (this.flushTimer === null) return;
    this.deps.clearTimeout(this.flushTimer);
    this.flushTimer = null;
  }

  private isoNow() {
    return new Date(this.deps.now()).toISOString();
  }
}
