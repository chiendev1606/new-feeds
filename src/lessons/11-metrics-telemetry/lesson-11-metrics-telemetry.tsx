/**
 * LESSON 11 – Đo lường & telemetry (O – Performance / Monitoring)
 *
 * "Không đo được thì không tối ưu được": đo Core Web Vitals trên máy người dùng thật, đếm impression
 * và dwell time theo định nghĩa chặt, rồi gửi về server theo lô (beacon khi rời trang).
 */
import { memo } from 'react';
import { useFeedLoader } from '../../shared/hooks/use-feed-loader';
import { FeedPostArticle } from '../../shared/post-rendering/feed-post-article';
import { useNow } from '../../shared/post-rendering/format-relative-time';
import { FeedErrorAlert } from '../../shared/ui/feed-error-alert';
import { LessonLayout } from '../../shared/ui/lesson-layout';
import { PostSkeletonList } from '../../shared/ui/post-skeleton';
import { useFeedState } from '../03-normalized-store/feed-store-context';
import { ReactionFeedStoreProvider } from '../05-optimistic-reaction/reaction-feed-store-provider';
import './lesson-11-metrics-telemetry.css';
import { ServerSummaryPanel, TelemetryBatchesPanel, WebVitalsPanel } from './telemetry-panels';
import { useImpressionTracking } from './use-impression-tracking';

// 📖 Bài học lesson-11 §3 – cố ý chặn main thread để tạo long task và INP xấu (docs/lessons/lesson-11.md)
// #region learn:block-main-thread-demo
/** Chặn main thread bằng busy-loop – cố ý tạo long task và INP xấu để thấy chỉ số đổi màu. */
function blockMainThread(durationMs: number) {
  const end = performance.now() + durationMs;
  while (performance.now() < end) {
    // chờ bận
  }
}
// #endregion learn:block-main-thread-demo

interface TrackedPostProps {
  postId: string;
  index: number;
  setSize: number;
  now: number;
  impressed: boolean;
  trackRef: (element: Element | null) => void;
}

// 📖 Bài học lesson-11 §1 – wrapper có ref và data-impressed, memo để chỉ render lại bài đổi trạng thái (docs/lessons/lesson-11.md)
// #region learn:tracked-post-wrapper
/** Wrapper có ref + data-impressed; không sửa FeedPostArticle gốc. memo để chỉ bài vừa đổi trạng thái mới render lại. */
const TrackedPost = memo(function TrackedPost({ postId, index, setSize, now, impressed, trackRef }: TrackedPostProps) {
  return (
    <div ref={trackRef} className="tracked-post" data-post-wrapper-id={postId} data-impressed={impressed ? 'true' : 'false'}>
      <FeedPostArticle postId={postId} posInSet={index + 1} setSize={setSize} locale="vi-VN" now={now} priority={index === 0} />
    </div>
  );
});
// #endregion learn:tracked-post-wrapper

function Lesson11Content() {
  const state = useFeedState();
  const now = useNow();
  const { status, error, retry, hasOlder, sentinelRef } = useFeedLoader();
  const { trackRef, impressedIds, batches, vitals, flushNow } = useImpressionTracking();
  const isLoading = status === 'loading-initial' || status === 'loading-older';
  const setSize = hasOlder ? -1 : state.feed.postIds.length;

  return (
    <LessonLayout
      number={11}
      title="Đo lường & telemetry"
      radioSections="O – Performance / Monitoring"
      observe={[
        'Cuộn feed, dừng mỗi bài ≥ 1 giây: bài được viền xanh (data-impressed="true"). Cuộn lướt qua nhanh (< 1s) thì KHÔNG viền xanh. Cuộn đi rồi quay lại: không tính trùng.',
        'Panel "Lô telemetry": sau 5 giây (hoặc đủ 20 sự kiện, hoặc bấm "Gửi ngay") hiện một lô phương thức fetch. Terminal backend in dòng "📊 telemetry…".',
        'Chuyển sang tab khác (visibilitychange → hidden) hoặc đóng tab: lô cuối được gửi bằng beacon (xem Network: loại "ping"/beacon, hoặc dòng mới ở panel khi quay lại tab).',
        'Panel Web Vitals: LCP/CLS/INP tô màu theo budget (LCP ≤ 2500ms, INP ≤ 200ms, CLS ≤ 0.1). Bấm "Làm chậm main thread 300ms": long task xuất hiện, INP vượt 300ms và chuyển sang đỏ/vàng.',
        'Panel "Server summary" (poll 5s): tổng sự kiện tăng, top bài theo lượt hiển thị/thời gian xem, p75 từng chỉ số. Đọc thêm bảng telemetry_events trong Adminer.',
        'Mỗi bài có dòng "người thích" dùng Intl.ListFormat (vd "An, Bình và 3 người khác") – danh sách tự nối đúng ngữ pháp theo ngôn ngữ.',
      ]}
      keyFiles={[
        'src/lessons/11-metrics-telemetry/impression-tracker.ts',
        'src/lessons/11-metrics-telemetry/web-vitals-observer.ts',
        'src/lessons/11-metrics-telemetry/web-vitals-rating.ts',
        'src/lessons/11-metrics-telemetry/use-impression-tracking.ts',
        'src/shared/post-rendering/format-reactor-list.ts',
        'server/src/routes/telemetry-routes.ts',
      ]}
      aside={
        <>
          <WebVitalsPanel vitals={vitals} />
          <div className="panel">
            <h2>Thử làm xấu hiệu năng</h2>
            <button type="button" onClick={() => blockMainThread(300)}>
              Làm chậm main thread 300ms
            </button>
          </div>
          <TelemetryBatchesPanel batches={batches} onFlush={() => void flushNow()} />
          <ServerSummaryPanel />
        </>
      }
    >
      <p className="muted" data-testid="impression-count">Đã tính {impressedIds.size} lượt hiển thị trong phiên này.</p>
      <div role="feed" aria-label="Bảng tin có đo lường" aria-busy={isLoading} className="feed">
        {state.feed.postIds.map((postId, index) => (
          <TrackedPost key={postId} postId={postId} index={index} setSize={setSize} now={now} impressed={impressedIds.has(postId)} trackRef={trackRef(postId)} />
        ))}
      </div>
      {isLoading && <PostSkeletonList count={status === 'loading-initial' ? 3 : 1} />}
      {status === 'error' && <FeedErrorAlert error={error} onRetry={retry} />}
      <div ref={sentinelRef} className="sentinel" aria-hidden="true" />
    </LessonLayout>
  );
}

export default function Lesson11MetricsTelemetry() {
  return (
    <ReactionFeedStoreProvider>
      <Lesson11Content />
    </ReactionFeedStoreProvider>
  );
}
