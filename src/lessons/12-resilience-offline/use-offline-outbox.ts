/**
 * Gắn outbox (tầng dữ liệu) vào feed store (tầng state) cho lesson 12.
 *
 * Luồng đăng bài (chỉ bài CHỮ – ảnh cần vòng đời upload riêng, xem post-outbox.ts):
 *   1. Chèn NGAY bài tạm 'temp-<key>' lên đầu feed (optimistic như lesson 06).
 *   2. Đang offline → vào outbox luôn. Online → gửi thẳng; lỗi mạng/5xx (retry hết vẫn lỗi) → vào outbox.
 *      Lỗi 4xx khác (vd 400) → gỡ bài tạm, báo lỗi: gửi lại cũng vô ích.
 *   3. Outbox flush khi: vừa tải trang, sự kiện 'online', SW nhắn 'flush-outbox' (Background Sync), và mỗi
 *      vài giây nếu còn mục chờ (phòng khi mạng "có" nhưng server lỗi). Đây mới là đường ĐÚNG; Background
 *      Sync chỉ là phần thêm. Gửi xong → bài tạm được thay bằng bài thật (postReplaced).
 *   4. Outbox nằm trong IndexedDB nên sống qua việc tải lại trang: lúc load ta dựng lại bài tạm cho các mục
 *      còn chờ, SAU KHI feed trang đầu về (trang đầu "initial" sẽ thay cả danh sách nên không được chèn trước).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPost, getSession } from '../../shared/api/feed-api';
import { createIdempotencyKey, isRetryableStatus, ApiError } from '../../shared/api/http-client';
import { openIndexedDbStore, outboxDatabaseName } from '../../shared/offline/indexed-db-store';
import { createPostOutbox, type OutboxEvent, type OutboxItem, type PostOutbox } from '../../shared/offline/post-outbox';
import { getOnlineStatus, useOnlineStatus } from '../../shared/offline/use-online-status';
import type { Post } from '../../shared/types/feed-entities';
import { createEmptyEngagementSummary } from '../../shared/types/feed-entities';
import { toErrorMessage } from '../../shared/utils/to-error-message';
import { useFeedDispatch, useFeedState } from '../03-normalized-store/feed-store-context';
import { registerBackgroundSync } from './register-background-sync';

export const TEMP_POST_PREFIX = 'temp-';
export const tempPostIdFor = (idempotencyKey: string) => `${TEMP_POST_PREFIX}${idempotencyKey}`;
const FLUSH_INTERVAL_MS = 8000;

const LAST_VIEWER_KEY = 'newsfeed:last-viewer';

// 📖 Bài học lesson-12 §4 – nhớ viewer trong localStorage để mở outbox được cả khi offline (docs/lessons/lesson-12.md)
// #region learn:resolve-viewer-remembered
/**
 * Viewer hiện tại để mở outbox ĐÚNG tài khoản. Online: hỏi server (nguồn sự thật) rồi nhớ lại.
 * Offline (vd vừa tải lại feed khi mất mạng): /api/session/me không gọi được → dùng viewer đã nhớ,
 * nếu không thì outbox – thứ sinh ra để dùng khi offline – lại không dùng được đúng lúc cần.
 * Server vẫn xác thực lại bằng session khi bài thật được gửi lên.
 */
async function resolveViewerId(): Promise<string> {
  try {
    const { viewerId } = await getSession();
    try {
      localStorage.setItem(LAST_VIEWER_KEY, viewerId);
    } catch {
      // localStorage bị chặn → chỉ mất khả năng mở outbox khi offline lần sau.
    }
    return viewerId;
  } catch (error) {
    let remembered: string | null = null;
    try {
      remembered = localStorage.getItem(LAST_VIEWER_KEY);
    } catch {
      remembered = null;
    }
    if (remembered) return remembered;
    throw error;
  }
}
// #endregion learn:resolve-viewer-remembered

function buildTempPost(viewerId: string, text: string, idempotencyKey: string): Post {
  return {
    id: tempPostIdFor(idempotencyKey),
    authorId: viewerId,
    body: { text, entities: [] },
    mediaIds: [],
    engagementSummary: createEmptyEngagementSummary(),
    viewerReaction: null,
    createdAt: new Date().toISOString(),
  };
}

export interface OfflineOutboxOptions {
  /** Feed trang đầu đã về (hoặc lỗi) – từ lúc này mới được dựng lại bài tạm và flush. */
  feedReady: boolean;
  onLog: (line: string) => void;
  onToast: (message: string, tone?: 'info' | 'error') => void;
}

export function useOfflineOutbox({ feedReady, onLog, onToast }: OfflineOutboxOptions) {
  const dispatch = useFeedDispatch();
  const state = useFeedState();
  const online = useOnlineStatus();
  const [viewerId, setViewerId] = useState<string | null>(null);
  const [items, setItems] = useState<OutboxItem[]>([]);
  const [setupError, setSetupError] = useState<string | null>(null);

  // Ref giữ giá trị mới nhất để callback bền vững (outbox được tạo một lần) không đọc state cũ.
  const outboxRef = useRef<PostOutbox | null>(null);
  const alive = useRef(true);
  const started = useRef(false);
  const latest = useRef({ onLog, onToast, postIds: state.feed.postIds, viewerId });
  latest.current = { onLog, onToast, postIds: state.feed.postIds, viewerId };

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    const outbox = outboxRef.current;
    if (!outbox) return;
    const next = await outbox.list();
    if (alive.current) setItems(next);
  }, []);

  const flushNow = useCallback(async () => {
    const outbox = outboxRef.current;
    if (!outbox) return;
    try {
      await outbox.flush();
    } catch (error) {
      latest.current.onLog(`⚠️ flush outbox lỗi: ${toErrorMessage(error)}`);
    }
    await refresh();
  }, [refresh]);

  // 📖 Bài học lesson-12 §3 – phản ứng với từng kết quả gửi của outbox (docs/lessons/lesson-12.md)
  // #region learn:outbox-event-handler
  /** Phản ứng với từng kết quả gửi của outbox. */
  const handleOutboxEvent = useCallback(
    (event: OutboxEvent) => {
      const keyPreview = event.item.idempotencyKey.slice(0, 8);
      if (event.kind === 'sent') {
        const tempId = tempPostIdFor(event.item.idempotencyKey);
        dispatch({ type: 'entitiesMerged', entities: { users: event.response.users, media: event.response.media } });
        // Bài tạm còn trong feed → thay tại chỗ. Không còn (sau khi tải lại trang) → chèn bài thật lên đầu; reducer khử trùng theo id.
        if (latest.current.postIds.includes(tempId)) dispatch({ type: 'postReplaced', previousId: tempId, post: event.response.post });
        else dispatch({ type: 'postPrepended', post: event.response.post });
        latest.current.onLog(`✅ outbox gửi xong key ${keyPreview}… (lần ${event.item.attempts}) → ${event.response.post.id}`);
      } else if (event.kind === 'removed-while-sending') {
        // Người dùng bỏ mục khi nó đang bay: gỡ bài tạm (discard đã gỡ một lần, gỡ lại là vô hại) và KHÔNG chèn bài thật.
        dispatch({ type: 'postRemoved', postId: tempPostIdFor(event.item.idempotencyKey) });
        latest.current.onLog(
          event.delivered
            ? `🗑 key ${keyPreview}… bị bỏ khi đang gửi nhưng server đã nhận → không hiện lại trong feed (bài có thể xuất hiện sau khi tải lại)`
            : `🗑 key ${keyPreview}… bị bỏ khi đang gửi → không đưa lại vào outbox`,
        );
      } else if (event.kind === 'retry-later') {
        latest.current.onLog(`⏸ outbox hoãn key ${keyPreview}… (lần ${event.item.attempts}): ${event.message} – sẽ thử lại, CÙNG key`);
      } else {
        latest.current.onLog(`⛔ server từ chối key ${keyPreview}…: ${event.message} – giữ trong outbox, KHÔNG tự gửi lại`);
        latest.current.onToast(`Bài chờ đăng bị từ chối: ${event.message}`, 'error');
      }
    },
    [dispatch],
  );
  // #endregion learn:outbox-event-handler

  // 📖 Bài học lesson-12 §3 – khởi tạo outbox: viewer, DB riêng, dựng lại bài tạm rồi flush (docs/lessons/lesson-12.md)
  // #region learn:outbox-init-effect
  // Khởi tạo một lần khi feed sẵn sàng: lấy viewer → mở DB riêng của viewer → dựng bài tạm → flush.
  useEffect(() => {
    if (!feedReady || started.current) return;
    started.current = true;
    void (async () => {
      try {
        const session = { viewerId: await resolveViewerId() };
        const store = await openIndexedDbStore<OutboxItem>(outboxDatabaseName(session.viewerId));
        const outbox = createPostOutbox({ store, send: (payload, key) => createPost(payload, key), onEvent: handleOutboxEvent });
        outboxRef.current = outbox;
        const stored = await outbox.list();
        // Cũ → mới, mỗi bài chèn lên đầu ⇒ bài mới nhất nằm trên cùng.
        for (const item of stored) {
          dispatch({ type: 'postPrepended', post: buildTempPost(session.viewerId, item.payload.body.text, item.idempotencyKey) });
        }
        if (stored.length > 0) latest.current.onLog(`📥 khôi phục ${stored.length} mục từ IndexedDB (DB riêng của ${session.viewerId})`);
        if (alive.current) {
          setViewerId(session.viewerId);
          setItems(stored);
        }
        await flushNow();
      } catch (error) {
        // Cờ `started` vẫn giữ true: effect này KHÔNG tự chạy lại chỉ vì render tiếp (nó chỉ chạy khi deps đổi, mà deps không
        // đổi sau lỗi). Muốn thử lại phải mount lại feed (nút "Tải lại feed" tạo instance hook mới với cờ mới).
        if (alive.current) setSetupError(toErrorMessage(error));
      }
    })();
  }, [feedReady, dispatch, handleOutboxEvent, flushNow]);
  // #endregion learn:outbox-init-effect

  // 📖 Bài học lesson-12 §3 – các lúc flush: có mạng lại, SW nhắn, định kỳ khi còn mục chờ (docs/lessons/lesson-12.md)
  // #region learn:outbox-flush-triggers
  // Đường flush ĐÚNG: có mạng lại; SW nhắn (Background Sync); định kỳ khi còn mục chờ.
  useEffect(() => {
    if (online) void flushNow();
  }, [online, flushNow]);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if ((event.data as { type?: string } | null)?.type === 'flush-outbox') {
        latest.current.onLog('📨 SW báo Background Sync → flush outbox');
        void flushNow();
      }
    };
    navigator.serviceWorker?.addEventListener('message', onMessage);
    return () => navigator.serviceWorker?.removeEventListener('message', onMessage);
  }, [flushNow]);

  const hasPending = items.some((item) => item.state === 'pending');
  useEffect(() => {
    if (!hasPending) return;
    const timer = setInterval(() => {
      if (getOnlineStatus()) void flushNow();
    }, FLUSH_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [hasPending, flushNow]);
  // #endregion learn:outbox-flush-triggers

  // 📖 Bài học lesson-12 §3 – đưa bài vào outbox rồi đăng ký Background Sync (docs/lessons/lesson-12.md)
  // #region learn:outbox-hook-enqueue
  /** Đưa một bài vào outbox (bài tạm đã nằm trong feed). Trả về false nếu không lưu được. */
  const enqueue = useCallback(
    async (text: string, key: string, reason: string) => {
      const outbox = outboxRef.current;
      try {
        if (!outbox) throw new Error('Outbox chưa sẵn sàng');
        await outbox.enqueue({ body: { text, entities: [] }, mediaIds: [] }, key);
        await refresh();
        const registered = await registerBackgroundSync();
        latest.current.onLog(`📤 ${reason} → vào outbox (key ${key.slice(0, 8)}…). Background Sync: ${registered ? 'đã đăng ký' : 'không hỗ trợ/không có SW – dựa vào flush trong tab'}`);
        return true;
      } catch (error) {
        dispatch({ type: 'postRemoved', postId: tempPostIdFor(key) });
        latest.current.onToast(`Không lưu được vào outbox: ${toErrorMessage(error)}`, 'error');
        return false;
      }
    },
    [dispatch, refresh],
  );
  // #endregion learn:outbox-hook-enqueue

  // 📖 Bài học lesson-12 §3 – chèn bài tạm, offline thì vào outbox, lỗi tạm thì vào outbox, 4xx thì gỡ (docs/lessons/lesson-12.md)
  // #region learn:outbox-submit-flow
  /** Gửi bài chữ. Trả về true nếu bài đã được đăng hoặc đã nằm an toàn trong outbox (composer được xoá trắng). */
  const submit = useCallback(
    async (rawText: string): Promise<boolean> => {
      const id = latest.current.viewerId;
      // Server yêu cầu NFC (entity range tính theo offset trên text đã chuẩn hoá).
      const text = rawText.normalize('NFC').trim();
      if (!id || !text) return false;
      const key = createIdempotencyKey();
      dispatch({ type: 'postPrepended', post: buildTempPost(id, text, key) });
      latest.current.onLog(`⚡ chèn bài tạm (key ${key.slice(0, 8)}…)`);

      if (!getOnlineStatus()) return enqueue(text, key, 'đang offline');
      try {
        const response = await createPost({ body: { text, entities: [] }, mediaIds: [] }, key, ({ attempt, delayMs }) =>
          latest.current.onLog(`🔁 retry lần ${attempt} sau ${delayMs}ms – CÙNG key ${key.slice(0, 8)}…`),
        );
        dispatch({ type: 'entitiesMerged', entities: { users: response.users, media: response.media } });
        dispatch({ type: 'postReplaced', previousId: tempPostIdFor(key), post: response.post });
        latest.current.onLog(`✅ server tạo ${response.post.id}`);
        return true;
      } catch (error) {
        // Lỗi tạm thời (mạng rớt giữa chừng, 5xx sau khi retry hết): an toàn để vào outbox vì đã có idempotency key.
        if (error instanceof ApiError && !isRetryableStatus(error.status)) {
          dispatch({ type: 'postRemoved', postId: tempPostIdFor(key) });
          latest.current.onToast(`Không đăng được: ${error.message}`, 'error');
          return false;
        }
        return enqueue(text, key, `lỗi mạng (${toErrorMessage(error)})`);
      }
    },
    [dispatch, enqueue],
  );
  // #endregion learn:outbox-submit-flow

  /** Bỏ một mục khỏi outbox (và bài tạm tương ứng khỏi feed). */
  const discard = useCallback(
    async (key: string) => {
      await outboxRef.current?.remove(key);
      dispatch({ type: 'postRemoved', postId: tempPostIdFor(key) });
      await refresh();
    },
    [dispatch, refresh],
  );

  return { ready: viewerId !== null, viewerId, setupError, items, submit, discard, flushNow };
}
