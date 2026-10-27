/**
 * LESSON 09 – Feed list nâng cao (O – Feed list)
 *
 * Những thứ lesson 04 (infinite scroll) và 08 (virtualization) chưa làm:
 *   1. Quay lại feed từ trang chi tiết phải về ĐÚNG chỗ đang đọc → anchor scroll (scroll-anchor.ts, use-scroll-restoration.ts).
 *   2. Tab bị bỏ quên lâu → hỏi "Feed đã cũ – Tải lại" thay vì âm thầm đổi bài (use-stale-feed-prompt.ts).
 *   3. Nhiều tab cùng mở → reaction ở tab này cập nhật tab kia qua BroadcastChannel (shared/sync).
 *   4. Nhiều component cùng cần một dữ liệu → tầng data access gộp request trùng (post-detail-view.tsx).
 *   5. Feed ảo hoá không được làm mất focus bàn phím, và có phím Page Down/Page Up giữa các bài (WAI-ARIA feed pattern).
 *
 * Lesson KHÔNG remount khi đổi route con (#/lesson-09 ↔ #/lesson-09/post/:id): store và dữ liệu đã tải còn nguyên,
 * quay lại không cần tải lại feed – đây là lý do bài chọn SPA cho feed.
 */
import { useCallback, useRef, useState, type MouseEvent } from 'react';
import { useFeedLoader } from '../../shared/hooks/use-feed-loader';
import { FeedPostArticle } from '../../shared/post-rendering/feed-post-article';
import { useNow } from '../../shared/post-rendering/format-relative-time';
import { useCrossTabReactionSync } from '../../shared/sync/use-cross-tab-reaction-sync';
import type { ReactionSyncLogEntry } from '../../shared/sync/cross-tab-reaction-sync';
import { FeedErrorAlert } from '../../shared/ui/feed-error-alert';
import { LessonLayout } from '../../shared/ui/lesson-layout';
import { ToastStack, useToasts } from '../../shared/ui/toast-stack';
import { useFeedState } from '../03-normalized-store/feed-store-context';
import { ReactionFeedStoreProvider } from '../05-optimistic-reaction/reaction-feed-store-provider';
import { VirtualizedFeedList, type VirtualizedFeedListHandle } from '../08-virtualization/virtualized-feed-list';
import { AdvancedFeedSidePanel, type SyncLogItem } from './advanced-feed-side-panel';
import { buildPostHash, FEED_HASH, useLesson09Route } from './lesson-09-route';
import { PostDetailView } from './post-detail-view';
import { DEFAULT_STALE_AFTER_MS, useStaleFeedPrompt } from './use-stale-feed-prompt';
import { useScrollRestoration } from './use-scroll-restoration';
import './lesson-09.css';

const LOCALE = 'vi-VN';
const RELOAD_PAGE_SIZE = 10;
const MAX_LOG_ITEMS = 40;

const OBSERVE = [
  'Cuộn tới khoảng bài thứ 20 (panel "Anchor scroll" cập nhật theo). Bấm vào thời gian của bài (hoặc link "Mở chi tiết"), rồi bấm "← Về feed" hoặc nút Back: bài neo về cùng vị trí, panel báo độ lệch (mục tiêu ≤ 5px).',
  'Tải lại trang (F5) khi đang ở giữa feed: anchor nằm trong sessionStorage nên feed tải thêm bài cho tới khi có bài neo rồi cuộn lại đúng chỗ.',
  'Ở trang chi tiết: 3 component cùng gọi fetchPost nhưng tab Network chỉ có 1 request /api/posts/:id; panel đếm số lần gọi và số lần được gộp.',
  'Đặt "Cũ sau" = 5 giây, đợi quá 5 giây rồi chuyển sang tab khác và quay lại: hiện banner "Feed đã cũ – Tải lại". Bấm tải lại thì feed và anchor được làm mới.',
  'Bấm "Mở tab mới", bấm reaction ở tab này: tab kia đổi theo trong chưa tới 1 giây; log BroadcastChannel ghi gửi / nhận / áp dụng. Tin nhắn có confirmedAt cũ hơn bản đang có bị bỏ qua.',
  'Bấm Tab tới nút reaction của một bài rồi nhấn Page Down / Page Up: focus nhảy sang bài kế / trước và cuộn tới. Cuộn chuột đi thật xa: bài đang focus vẫn còn trong DOM (không mất focus).',
];

const KEY_FILES = [
  'src/lessons/09-advanced-feed-list/scroll-anchor.ts',
  'src/lessons/09-advanced-feed-list/use-scroll-restoration.ts',
  'src/lessons/09-advanced-feed-list/use-stale-feed-prompt.ts',
  'src/lessons/09-advanced-feed-list/post-detail-view.tsx',
  'src/shared/sync/cross-tab-reaction-sync.ts',
  'src/lessons/08-virtualization/virtualized-feed-list.tsx',
];

let syncLogId = 0;

function Lesson09Content() {
  const state = useFeedState();
  const now = useNow();
  const tickingNow = useNow(1000); // chỉ để panel hiện tuổi feed chạy từng giây
  const { toasts, showToast } = useToasts();

  const feedRef = useRef<HTMLDivElement>(null);
  const listHandleRef = useRef<VirtualizedFeedListHandle>(null);
  const captureRef = useRef<() => void>(() => undefined);
  const onBeforeRouteChange = useCallback(() => captureRef.current(), []);
  const route = useLesson09Route(onBeforeRouteChange);
  const isFeedRoute = route.kind === 'feed';

  const { status, error, loadMany, reload, retry, hasOlder, sentinelRef } = useFeedLoader({ observeKey: route.kind });
  const isLoading = status === 'loading-initial' || status === 'loading-older';
  const loadMoreForAnchor = useCallback(() => loadMany(1), [loadMany]);

  const restoration = useScrollRestoration({
    active: isFeedRoute,
    containerRef: feedRef,
    listHandleRef,
    feed: state.feed,
    isLoading,
    loadMore: loadMoreForAnchor,
  });
  captureRef.current = restoration.captureNow;

  const [staleAfterSec, setStaleAfterSec] = useState(DEFAULT_STALE_AFTER_MS / 1000);
  const stale = useStaleFeedPrompt(state.feed.lastFetchedAt, staleAfterSec * 1000);

  const [syncLog, setSyncLog] = useState<SyncLogItem[]>([]);
  const onSyncLog = useCallback((entry: ReactionSyncLogEntry) => {
    syncLogId += 1;
    const item = { id: syncLogId, at: Date.now(), entry };
    setSyncLog((current) => [item, ...current].slice(0, MAX_LOG_ITEMS));
  }, []);
  useCrossTabReactionSync(onSyncLog);

  // 📖 Bài học lesson-09 §2 – tải lại feed qua loader chung cờ inFlight rồi bỏ anchor (docs/lessons/lesson-09.md)
  // #region learn:reload-feed-through-loader
  /**
   * Tải lại từ đầu: thay toàn bộ list bằng trang đầu mới, bỏ anchor vì vị trí cũ không còn nghĩa.
   * Đi qua `reload()` của loader (chung cờ inFlight) chứ không tự gọi API: nếu không, một trang "older" đang bay có thể
   * về sau trang đầu và nối nhầm vào list mới.
   */
  const reloadFeed = async () => {
    const outcome = await reload(RELOAD_PAGE_SIZE);
    if (outcome.kind === 'ok') {
      restoration.clearAnchor();
      window.scrollTo({ top: 0, behavior: 'instant' });
    } else if (outcome.kind === 'error') {
      showToast(`Không tải lại được feed: ${outcome.message}`, 'error');
    }
  };
  // #endregion learn:reload-feed-through-loader

  const openNewTab = () => {
    // noopener: tab mới không có quyền truy cập window.opener; hai tab chỉ nói chuyện qua BroadcastChannel.
    window.open(`${window.location.origin}${window.location.pathname}${FEED_HASH}`, '_blank', 'noopener');
  };

  // Ủy quyền sự kiện: <time> nằm trong FeedPostArticle (dùng chung các lesson) nên bắt click ở container.
  const onFeedClick = (event: MouseEvent) => {
    const time = event.target instanceof Element ? event.target.closest('time') : null;
    const postId = time?.closest<HTMLElement>('[data-post-id]')?.dataset.postId;
    if (postId) window.location.hash = buildPostHash(postId);
  };

  const setSize = hasOlder ? -1 : state.feed.postIds.length;
  const renderPost = (postId: string, index: number) => (
    <>
      <FeedPostArticle postId={postId} posInSet={index + 1} setSize={setSize} locale={LOCALE} now={now} priority={index === 0} />
      <a className="lesson09-detail-link" href={buildPostHash(postId)}>
        Mở chi tiết bài
      </a>
    </>
  );

  const feedAgeMs = state.feed.lastFetchedAt === null ? null : Math.max(0, tickingNow - state.feed.lastFetchedAt);

  return (
    <LessonLayout
      number={9}
      title="Feed list nâng cao"
      radioSections="O – Feed list"
      observe={OBSERVE}
      keyFiles={KEY_FILES}
      aside={
        <AdvancedFeedSidePanel
          anchor={restoration.anchor}
          phase={restoration.phase}
          report={restoration.report}
          postCount={state.feed.postIds.length}
          generation={state.feed.generation}
          feedAgeMs={feedAgeMs}
          staleAfterSec={staleAfterSec}
          onStaleAfterSecChange={setStaleAfterSec}
          syncLog={syncLog}
          onOpenNewTab={openNewTab}
          onClearAnchor={restoration.clearAnchor}
        />
      }
    >
      {route.kind === 'post' ? (
        <PostDetailView key={route.postId} postId={route.postId} />
      ) : (
        <>
          {stale.isStale && (
            <div className="lesson09-banner" role="status" data-testid="stale-banner">
              <span>Feed đã cũ (quá {staleAfterSec} giây kể từ lần tải gần nhất).</span>
              <span>
                <button type="button" className="primary" data-testid="stale-reload" disabled={isLoading} onClick={() => void reloadFeed()}>
                  {status === 'loading-initial' ? 'Đang tải…' : 'Tải lại'}
                </button>{' '}
                <button type="button" onClick={stale.dismiss}>
                  Để sau
                </button>
              </span>
            </div>
          )}
          {/* onClick ở đây chỉ ủy quyền cho thẻ <time> (chuột); bàn phím dùng link "Mở chi tiết bài" ngay dưới mỗi bài. */}
          <div
            ref={feedRef}
            className="lesson09-feed"
            role="feed"
            aria-label="Bảng tin"
            aria-busy={isLoading}
            data-testid="feed"
            onClick={onFeedClick}
          >
            <VirtualizedFeedList
              itemIds={state.feed.postIds}
              renderItem={renderPost}
              footer={<div ref={sentinelRef} className="sentinel" aria-hidden="true" />}
              keyboardNav
              handleRef={listHandleRef}
            />
          </div>
          {status === 'error' && <FeedErrorAlert error={error} onRetry={retry} />}
        </>
      )}
      <ToastStack toasts={toasts} />
    </LessonLayout>
  );
}

export default function Lesson09AdvancedFeedList() {
  return (
    <ReactionFeedStoreProvider>
      <Lesson09Content />
    </ReactionFeedStoreProvider>
  );
}
