/**
 * LESSON 04 – Infinite scroll & bài mới (O – Feed list)
 *
 * Ghép: normalized store (lesson 03) + IntersectionObserver sentinel + skeleton + banner bài mới.
 */
import { useState } from 'react';
import { useFeedLoader } from '../../shared/hooks/use-feed-loader';
import { LessonLayout } from '../../shared/ui/lesson-layout';
import { PostCardBasic } from '../../shared/ui/post-card-basic';
import { PostSkeletonList } from '../../shared/ui/post-skeleton';
import { FeedStoreProvider, useFeedState, usePostView } from '../03-normalized-store/feed-store-context';
import { NewPostsBanner } from './new-posts-banner';

function ConnectedPostCard({ postId }: { postId: string }) {
  const { post, author, media } = usePostView(postId);
  return post ? <PostCardBasic post={post} author={author} media={media} /> : null;
}

/** Hiển thị rõ sentinel để thấy khi nào nó "chạm" vùng quan sát. */
function InfiniteFeed({ showSentinel, rootMargin }: { showSentinel: boolean; rootMargin: string }) {
  const state = useFeedState();
  // useFeedLoader tự quản sentinel: chỉ bật khi rảnh + còn bài, observe lại mỗi khi số bài đổi.
  const { status, error, retryMessage, requestCount, retry, hasOlder, sentinelRef } = useFeedLoader({ rootMargin });

  return (
    <>
      <NewPostsBanner />
      <p className="muted">
        Đã tải {state.feed.postIds.length} bài qua {requestCount} request · trạng thái: <code>{status}</code>
      </p>
      <div className="feed">
        {status === 'loading-initial' && <PostSkeletonList count={3} />}
        {state.feed.postIds.map((postId) => (
          <ConnectedPostCard key={postId} postId={postId} />
        ))}
        {status === 'loading-older' && <PostSkeletonList count={2} />}
      </div>

      {retryMessage && <p className="muted">{retryMessage}</p>}
      {status === 'error' && (
        <div className="panel" role="alert">
          <p className="error-text">Không tải được bài viết: {error}</p>
          <button type="button" className="primary" onClick={retry}>
            Thử lại
          </button>
        </div>
      )}
      {!hasOlder && <p className="muted">Bạn đã xem hết bài viết.</p>}

      <div ref={sentinelRef} className={showSentinel ? 'sentinel sentinel--visible' : 'sentinel'} aria-hidden="true">
        {showSentinel && `sentinel (rootMargin: ${rootMargin})`}
      </div>
    </>
  );
}

export default function Lesson04InfiniteScroll() {
  const [showSentinel, setShowSentinel] = useState(true);
  const [rootMargin, setRootMargin] = useState('100% 0px');

  return (
    <FeedStoreProvider>
      <LessonLayout
        number={4}
        title="Infinite scroll & bài mới"
        radioSections="O – Feed list"
        keyFiles={['src/shared/hooks/use-intersection-sentinel.ts', 'src/shared/hooks/use-feed-loader.ts', 'src/lessons/04-infinite-scroll/new-posts-banner.tsx']}
        observe={[
          'Cuộn xuống: request tiếp theo được gửi khi còn ~1 màn hình nữa mới tới cuối (xem Network/terminal) → hiếm khi thấy skeleton.',
          'Đổi rootMargin sang "0px" rồi cuộn: chỉ tải khi chạm đáy → thấy skeleton nhiều hơn.',
          'Bật "Tự sinh bài mới mỗi 5 giây" ở panel mô phỏng → sau ≤10s xuất hiện banner "Có N bài mới". Feed không tự nhảy.',
          'Kéo "Tỉ lệ lỗi" lên 100% rồi cuộn: thấy "thử lại lần N", sau 3 lần là khung lỗi + nút "Thử lại" (inline error, không phá cả trang).',
          'Trang đầu tải số bài theo chiều cao cửa sổ (xem count= trong request đầu tiên).',
        ]}
        aside={
          <div className="panel">
            <h2>Tuỳ chỉnh</h2>
            <label style={{ display: 'block' }}>
              <input type="checkbox" checked={showSentinel} onChange={(event) => setShowSentinel(event.target.checked)} /> Hiện sentinel
            </label>
            <label style={{ display: 'block', marginBlockStart: '0.5rem' }}>
              rootMargin:{' '}
              <select value={rootMargin} onChange={(event) => setRootMargin(event.target.value)}>
                <option value="100% 0px">100% 0px (prefetch 1 viewport)</option>
                <option value="0px">0px (chỉ khi chạm đáy)</option>
              </select>
            </label>
          </div>
        }
      >
        <InfiniteFeed showSentinel={showSentinel} rootMargin={rootMargin} />
      </LessonLayout>
    </FeedStoreProvider>
  );
}
