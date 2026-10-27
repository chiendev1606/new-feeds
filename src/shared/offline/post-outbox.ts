/**
 * OUTBOX – hàng đợi thao tác GHI khi offline (bài viết: "Networking, resilience, offline").
 *
 * Ý tưởng: thao tác ghi không được "mất" chỉ vì mạng rớt. Ta ghi ý định của người dùng vào kho bền
 * (IndexedDB) rồi gửi dần khi có mạng:
 *   1. enqueue: lưu {payload, idempotencyKey} – key được sinh MỘT LẦN, từ lúc người dùng bấm gửi.
 *   2. flush: gửi TUẦN TỰ (giữ thứ tự bài), luôn với CÙNG key. Nếu lần trước server đã tạo bài nhưng
 *      response bị mất, gửi lại cùng key → server trả lại bài cũ, không tạo trùng (lesson 06).
 *   3. Phân loại lỗi quyết định số phận của mục:
 *        2xx                       → xoá khỏi outbox.
 *        mạng/5xx/408/429/401      → LỖI TẠM: giữ nguyên, attempts++, dừng flush (giữ thứ tự), lần sau thử lại.
 *        4xx khác (vd 400 sai dữ liệu) → KHÔNG retry được: gửi lại y hệt vẫn lỗi y hệt. Giữ mục với state
 *                                    'rejected' + lastError để người dùng thấy/huỷ, KHÔNG tự gửi lại.
 *   4. Chống flush chồng nhau TRONG MỘT TAB: online event, interval, Background Sync… có thể gọi flush cùng lúc;
 *      nếu hai vòng cùng gửi một mục thì dù idempotency key cứu được, ta vẫn lãng phí request.
 *      Một flush đang chạy thì mọi lời gọi khác nhận lại ĐÚNG promise đó.
 *      Guard này chỉ sống trong một instance (một tab, một lần mount). Nhiều tab cùng mở thì mỗi tab có
 *      guard riêng → cần khoá liên tab (Web Locks: navigator.locks.request('outbox-flush:<viewer>', …)).
 *      Ở đây không cài; idempotency key vẫn đảm bảo không đăng trùng, chỉ tốn thêm request.
 *   5. Bỏ mục khi đang gửi: người dùng có thể xoá mục giữa lúc `send` đang bay. Sau khi send xong ta kiểm tra mục
 *      còn tồn tại rồi mới ghi lại – nếu không, lỗi tạm sẽ `put` mục đã bị bỏ "sống lại" và lần flush sau gửi nó đi.
 *      (Khoảng hở get→put cực nhỏ vẫn còn vì IndexedDB ở đây mỗi thao tác một transaction; chấp nhận được.)
 *
 * GIỚI HẠN: outbox chỉ nhận bài CHỮ. Bài có ảnh cần vòng đời upload riêng (upload xong mới có mediaId,
 * ảnh nằm trong Blob phải lưu bền, upload cũng phải idempotent…) – ngoài phạm vi lesson này.
 */
import { ApiError, isRetryableStatus } from '../api/http-client';
import type { CreatePostRequest, CreatePostResponse } from '../types/feed-entities';
import { toErrorMessage } from '../utils/to-error-message';
import type { KeyValueStore } from './indexed-db-store';

// 📖 Bài học lesson-12 – mục outbox giữ idempotencyKey và trạng thái pending hoặc rejected (docs/lessons/lesson-12.md)
// #region learn:outbox-item-and-events
export interface OutboxItem {
  idempotencyKey: string;
  payload: CreatePostRequest;
  createdAt: number;
  /** Số lần đã thử gửi (kể cả lần thất bại). */
  attempts: number;
  lastError: string | null;
  /** pending: sẽ được flush; rejected: server từ chối vĩnh viễn, chờ người dùng xử lý. */
  state: 'pending' | 'rejected';
}

export type OutboxEvent =
  | { kind: 'sent'; item: OutboxItem; response: CreatePostResponse }
  | { kind: 'retry-later'; item: OutboxItem; message: string }
  | { kind: 'rejected'; item: OutboxItem; message: string }
  /** Người dùng bỏ mục trong lúc nó đang được gửi: UI phải gỡ bài tạm, KHÔNG được hiện lại bài thật. */
  | { kind: 'removed-while-sending'; item: OutboxItem; delivered: boolean };
// #endregion learn:outbox-item-and-events

export interface PostOutboxOptions {
  store: KeyValueStore<OutboxItem>;
  /** Hàm gửi thật (feed-api createPost) – inject để test không cần mạng. */
  send: (payload: CreatePostRequest, idempotencyKey: string) => Promise<CreatePostResponse>;
  onEvent?: (event: OutboxEvent) => void;
  now?: () => number;
}

export interface FlushSummary {
  sent: number;
  /** Mục dừng lại vì lỗi tạm (sẽ thử lại lần flush sau). */
  deferred: number;
  rejected: number;
}

// 📖 Bài học lesson-12 – phân loại lỗi tạm thời và lỗi bị từ chối vĩnh viễn (docs/lessons/lesson-12.md)
// #region learn:outbox-transient-error
/** Lỗi nào đáng thử lại sau? Mất mạng/5xx/408/429, và 401 (session có thể được làm mới/đăng nhập lại). */
export function isTransientSendError(error: unknown): boolean {
  if (!(error instanceof ApiError)) return true; // lỗi không rõ (vd fetch ném TypeError) → coi như tạm thời
  return isRetryableStatus(error.status) || error.status === 401;
}
// #endregion learn:outbox-transient-error

export function createPostOutbox({ store, send, onEvent, now = Date.now }: PostOutboxOptions) {
  let activeFlush: Promise<FlushSummary> | null = null;

  async function list(): Promise<OutboxItem[]> {
    const items = await store.getAll();
    return items.sort((a, b) => a.createdAt - b.createdAt || a.idempotencyKey.localeCompare(b.idempotencyKey));
  }

  // 📖 Bài học lesson-12 – lưu ý định kèm idempotencyKey sinh một lần (docs/lessons/lesson-12.md)
  // #region learn:outbox-enqueue
  async function enqueue(payload: CreatePostRequest, idempotencyKey: string): Promise<OutboxItem> {
    const item: OutboxItem = { idempotencyKey, payload, createdAt: now(), attempts: 0, lastError: null, state: 'pending' };
    await store.put(idempotencyKey, item);
    return item;
  }
  // #endregion learn:outbox-enqueue

  // 📖 Bài học lesson-12 – gửi tuần tự cùng key, phân loại lỗi, xử lý mục bị bỏ giữa chừng (docs/lessons/lesson-12.md)
  // #region learn:outbox-run-flush
  async function runFlush(): Promise<FlushSummary> {
    const summary: FlushSummary = { sent: 0, deferred: 0, rejected: 0 };
    for (const item of await list()) {
      if (item.state === 'rejected') continue; // không tự gửi lại mục đã bị từ chối
      // list() chụp ảnh từ đầu vòng; mục có thể đã bị bỏ trong lúc ta gửi các mục trước → đừng gửi nó nữa.
      if (!(await store.get(item.idempotencyKey))) continue;
      const attempted: OutboxItem = { ...item, attempts: item.attempts + 1 };
      try {
        const response = await send(item.payload, item.idempotencyKey); // CÙNG key ở mọi lần gửi
        if (!(await store.get(item.idempotencyKey))) {
          // Bị bỏ giữa chừng nhưng server đã tạo bài (không thu hồi được ở lesson này): chỉ báo UI gỡ bài tạm.
          onEvent?.({ kind: 'removed-while-sending', item: attempted, delivered: true });
          continue;
        }
        await store.delete(item.idempotencyKey);
        summary.sent += 1;
        onEvent?.({ kind: 'sent', item: attempted, response });
      } catch (error) {
        if (!(await store.get(item.idempotencyKey))) {
          // Bị bỏ giữa chừng: không `put` lại (sẽ làm mục sống lại).
          onEvent?.({ kind: 'removed-while-sending', item: attempted, delivered: false });
          continue;
        }
        const message = toErrorMessage(error);
        if (isTransientSendError(error)) {
          await store.put(item.idempotencyKey, { ...attempted, lastError: message });
          summary.deferred += 1;
          onEvent?.({ kind: 'retry-later', item: { ...attempted, lastError: message }, message });
          break; // vẫn offline/server đang lỗi: dừng, giữ thứ tự, không dồn request vào mục sau
        }
        const rejected: OutboxItem = { ...attempted, lastError: message, state: 'rejected' };
        await store.put(item.idempotencyKey, rejected);
        summary.rejected += 1;
        onEvent?.({ kind: 'rejected', item: rejected, message });
      }
    }
    return summary;
  }
  // #endregion learn:outbox-run-flush

  // 📖 Bài học lesson-12 – đang flush thì mọi lời gọi nhận lại đúng promise đó (docs/lessons/lesson-12.md)
  // #region learn:outbox-flush-single-flight
  /** Đang flush thì trả lại đúng promise đang chạy – không bao giờ có hai vòng flush chồng nhau. */
  function flush(): Promise<FlushSummary> {
    if (!activeFlush) {
      activeFlush = runFlush().finally(() => {
        activeFlush = null;
      });
    }
    return activeFlush;
  }
  // #endregion learn:outbox-flush-single-flight

  /** Người dùng bỏ một mục (thường là mục 'rejected'). */
  const remove = (idempotencyKey: string) => store.delete(idempotencyKey);

  return { enqueue, flush, list, remove };
}

export type PostOutbox = ReturnType<typeof createPostOutbox>;
