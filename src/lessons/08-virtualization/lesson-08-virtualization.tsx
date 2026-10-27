/**
 * LESSON 08 – Virtualization (O – Feed list)
 *
 * Sau vài trăm bài, DOM có hàng chục nghìn node → cuộn giật, tốn RAM, INP kém.
 * 3 chế độ để so sánh:
 *   - plain: render tất cả (như lesson 07).
 *   - content-visibility: vẫn render tất cả nhưng CSS `content-visibility: auto` cho phép trình duyệt
 *     bỏ qua layout/paint các bài ngoài màn hình. Rẻ, giữ được Ctrl+F, nhưng DOM vẫn lớn.
 *   - virtualized: chỉ giữ ~10 bài quanh viewport trong DOM.
 *
 * Đánh đổi của virtualization (bài viết có nhắc):
 *   - Ctrl+F không tìm được bài đã bị gỡ khỏi DOM.
 *   - Focus mất nếu bài đang focus bị unmount; screen reader không biết tổng số bài (dùng aria-setsize).
 *   - Chiều cao thay đổi động → cần đo + bù scroll.
 */
import { useEffect, useRef, useState } from 'react';
import { useFeedLoader } from '../../shared/hooks/use-feed-loader';
import { FeedPostArticle } from '../../shared/post-rendering/feed-post-article';
import { useNow } from '../../shared/post-rendering/format-relative-time';
import { LessonLayout } from '../../shared/ui/lesson-layout';
import { FeedErrorAlert } from '../../shared/ui/feed-error-alert';
import { useFeedState } from '../03-normalized-store/feed-store-context';
import { ReactionFeedStoreProvider } from '../05-optimistic-reaction/reaction-feed-store-provider';
import { VirtualizedFeedList } from './virtualized-feed-list';

const LOCALE = 'vi-VN';

type RenderMode = 'virtualized' | 'content-visibility' | 'plain';

// 📖 Bài học lesson-08 §4 – đếm article và node bằng MutationObserver (docs/lessons/lesson-08.md)
// #region learn:use-dom-stats
/** Đếm số <article> và tổng số node trong feed – cập nhật khi DOM đổi. */
function useDomStats(container: React.RefObject<HTMLElement | null>) {
  const [stats, setStats] = useState({ articles: 0, nodes: 0 });
  useEffect(() => {
    const element = container.current;
    if (!element) return;
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const next = { articles: element.querySelectorAll('article').length, nodes: element.getElementsByTagName('*').length };
        setStats((current) => (current.articles === next.articles && current.nodes === next.nodes ? current : next));
      });
    };
    const observer = new MutationObserver(update);
    observer.observe(element, { childList: true, subtree: true });
    update();
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [container]);
  return stats;
}
// #endregion learn:use-dom-stats

function LoadManyButton({ loadMany, busy, hasOlder }: { loadMany: (pages: number) => Promise<void>; busy: boolean; hasOlder: boolean }) {
  return (
    <button type="button" className="primary" disabled={busy || !hasOlder} onClick={() => void loadMany(3)}>
      {busy ? 'Đang tải…' : 'Tải nhanh thêm 150 bài'}
    </button>
  );
}

function Lesson08Content() {
  const state = useFeedState();
  const now = useNow();
  const [mode, setMode] = useState<RenderMode>('virtualized');
  const feedRef = useRef<HTMLDivElement>(null);
  const stats = useDomStats(feedRef);
  // Đổi chế độ render làm sentinel đổi vị trí → observe lại.
  const { status, error, loadMany, retry, hasOlder, sentinelRef } = useFeedLoader({ observeKey: mode });
  // 📖 Bài học lesson-08 §4 – aria-setsize khi chưa biết tổng (docs/lessons/lesson-08.md)
  // #region learn:render-post-with-setsize
  const setSize = hasOlder ? -1 : state.feed.postIds.length;

  const renderPost = (postId: string, index: number) => (
    <FeedPostArticle postId={postId} posInSet={index + 1} setSize={setSize} locale={LOCALE} now={now} priority={index === 0} />
  );
  const sentinel = <div ref={sentinelRef} className="sentinel" aria-hidden="true" />;
  // #endregion learn:render-post-with-setsize

  return (
    <LessonLayout
      number={8}
      title="Virtualization"
      radioSections="O – Feed list"
      keyFiles={['src/lessons/08-virtualization/compute-visible-range.ts', 'src/lessons/08-virtualization/virtualized-feed-list.tsx', 'src/lessons/08-virtualization/use-measured-item-heights.ts']}
      observe={[
        'Bấm "Tải nhanh thêm 150 bài". Ở chế độ virtualized, số <article> trong DOM giữ khoảng 5–15 dù đã tải hơn 150 bài.',
        'Chuyển sang "plain": số article = số bài đã tải, số node DOM tăng vọt. Cuộn thử trên CPU throttling 4× (Performance tab).',
        '"content-visibility": DOM vẫn đầy đủ (Ctrl+F tìm được) nhưng trình duyệt bỏ qua layout/paint phần ngoài màn hình.',
        'Elements panel: thấy 2 div spacer (trên/dưới) thay đổi chiều cao khi cuộn; data-rendered-range cho biết đang render item nào.',
        'Bấm "Xem thêm" ở một bài rồi cuộn qua: chiều cao được đo lại (ResizeObserver), cuộn ngược không bị nhảy.',
        'Đánh đổi: Ctrl+F không tìm được bài ngoài DOM ở chế độ virtualized.',
      ]}
      aside={
        <div className="panel">
          <h2>DOM hiện tại</h2>
          <p>
            Đã tải: <strong>{state.feed.postIds.length}</strong> bài
            <br />
            &lt;article&gt; trong DOM: <strong>{stats.articles}</strong>
            <br />
            Tổng node trong feed: <strong>{stats.nodes.toLocaleString(LOCALE)}</strong>
          </p>
          <fieldset>
            <legend>Chế độ render</legend>
            {(
              [
                ['virtualized', 'Virtualized (windowing)'],
                ['content-visibility', 'content-visibility: auto'],
                ['plain', 'Render tất cả'],
              ] as const
            ).map(([value, label]) => (
              <label key={value} style={{ display: 'block' }}>
                <input type="radio" name="render-mode" value={value} checked={mode === value} onChange={() => setMode(value)} /> {label}
              </label>
            ))}
          </fieldset>
          <p>
            <LoadManyButton loadMany={loadMany} busy={status === 'loading-older' || status === 'loading-initial'} hasOlder={hasOlder} />
          </p>
          {status === 'error' && <FeedErrorAlert error={error} onRetry={retry} />}
        </div>
      }
    >
      {/* 📖 Bài học lesson-08 §4 – ba chế độ render để so sánh (docs/lessons/lesson-08.md) */}
      {/* #region learn:render-mode-switch */}
      <div ref={feedRef} role="feed" aria-label="Bảng tin" aria-busy={status !== 'idle' && status !== 'error'}>
        {mode === 'virtualized' ? (
          <VirtualizedFeedList itemIds={state.feed.postIds} renderItem={renderPost} footer={sentinel} />
        ) : (
          <>
            <div className={mode === 'content-visibility' ? 'feed feed--content-visibility' : 'feed'}>
              {state.feed.postIds.map((postId, index) => (
                <div key={postId}>{renderPost(postId, index)}</div>
              ))}
            </div>
            {sentinel}
          </>
        )}
      </div>
      {/* #endregion learn:render-mode-switch */}
    </LessonLayout>
  );
}

export default function Lesson08Virtualization() {
  return (
    <ReactionFeedStoreProvider>
      <Lesson08Content />
    </ReactionFeedStoreProvider>
  );
}
