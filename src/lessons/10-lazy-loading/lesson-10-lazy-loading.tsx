/**
 * LESSON 10 – Lazy-load code & JS tiers (O – Performance: code splitting) + composer sinh entity
 *
 * Ý tưởng: không phải JS nào cũng cần ngay. Chia thành các tầng (tier) theo độ cần thiết và DỰ ĐOÁN ý định
 * để tải trước đúng lúc:
 *   Tier 1 shell            → có sẵn khi mở trang.
 *   Tier 2 renderer bài     → tải ngay khi trang đầu về (preloadRenderersFor): theo DỮ LIỆU, tránh waterfall data → code.
 *   Tier 3 tương tác        → tải khi hover thanh reaction / hover-focus tên tác giả / bấm emoji, hoặc lúc rảnh (prefetch).
 * Ba kiểu prefetch trong lesson: hover/focus · idle (requestIdleCallback) · theo dữ liệu trang đầu.
 */
import { useEffect, useRef, useState } from 'react';
import { createPost } from '../../shared/api/feed-api';
import { useFeedLoader } from '../../shared/hooks/use-feed-loader';
import { preloadOnIdle } from '../../shared/lazy/lazy-with-preload';
import { useNow } from '../../shared/post-rendering/format-relative-time';
import { createEmptyEngagementSummary, type CreatePostResponse, type Post } from '../../shared/types/feed-entities';
import { FeedErrorAlert } from '../../shared/ui/feed-error-alert';
import { LessonLayout } from '../../shared/ui/lesson-layout';
import { PostSkeletonList } from '../../shared/ui/post-skeleton';
import { useFeedDispatch, useFeedState } from '../03-normalized-store/feed-store-context';
import { preloadReactionMenu } from '../05-optimistic-reaction/reaction-picker';
import { ReactionFeedStoreProvider } from '../05-optimistic-reaction/reaction-feed-store-provider';
import { preloadAuthorHoverCard } from './author-name-with-hover-card';
import { preloadEmojiPicker, EntityAwareComposer, type EntityComposerSubmitPayload } from './entity-aware-composer';
import { JsTiersTable, LoadedChunksTable } from './js-tiers-and-chunks-panel';
import { LazyPostCard } from './lazy-post-card';
import { getPostKind, preloadRenderersFor } from './post-renderer-registry';
import { useLoadedJsChunks } from './use-loaded-js-chunks';

const VIEWER_ID = 'user-1';
const TEMP_ID_PREFIX = 'temp-';
const LOCALE = 'vi-VN';

function buildTempPost(payload: EntityComposerSubmitPayload): Post {
  return {
    id: `${TEMP_ID_PREFIX}${payload.idempotencyKey}`,
    authorId: VIEWER_ID,
    body: payload.body,
    mediaIds: [],
    engagementSummary: createEmptyEngagementSummary(),
    viewerReaction: null,
    createdAt: new Date().toISOString(),
  };
}

function LazyFeed({ onLog, idlePrefetch }: { onLog: (line: string) => void; idlePrefetch: boolean }) {
  const state = useFeedState();
  const dispatch = useFeedDispatch();
  const now = useNow();
  const { status, error, retry, sentinelRef } = useFeedLoader();
  const loggedKindsRef = useRef(new Set<string>());

  // 📖 Bài học lesson-10 §2 – dữ liệu trang đầu về là tải renderer ngay, tránh waterfall (docs/lessons/lesson-10.md)
  // #region learn:prefetch-renderers-by-data
  // Prefetch theo DỮ LIỆU: trang vừa về store → tải song song renderer của mọi loại bài có trong đó.
  // Nhờ vậy loại bài xuất hiện ở trang sau cũng đã có code trước khi người dùng cuộn tới.
  const postIds = state.feed.postIds;
  useEffect(() => {
    const posts = postIds.flatMap((id) => {
      const post = state.postsById[id];
      return post ? [post] : [];
    });
    if (posts.length === 0) return;
    const fresh = [...new Set(posts.map(getPostKind))].filter((kind) => !loggedKindsRef.current.has(kind));
    if (fresh.length > 0) {
      fresh.forEach((kind) => loggedKindsRef.current.add(kind));
      onLog(`📦 dữ liệu về → preloadRenderersFor: ${fresh.join(', ')}`);
    }
    void preloadRenderersFor(posts);
    // state.postsById đổi theo reaction nhưng loại bài không đổi → cố ý chỉ phụ thuộc danh sách id (repo không dùng ESLint).
  }, [postIds]);
  // #endregion learn:prefetch-renderers-by-data

  // 📖 Bài học lesson-10 §3 – prefetch Tier 3 lúc trình duyệt rảnh (docs/lessons/lesson-10.md)
  // #region learn:prefetch-tier-3-on-idle
  // Prefetch lúc rảnh cho Tier 3 (tuỳ chọn để so sánh).
  useEffect(() => {
    if (!idlePrefetch) return;
    return preloadOnIdle(() => {
      void preloadReactionMenu();
      void preloadAuthorHoverCard();
      void preloadEmojiPicker();
      onLog('💤 trình duyệt rảnh → prefetch reaction-menu, author-hover-card, emoji-picker');
    });
  }, [idlePrefetch, onLog]);
  // #endregion learn:prefetch-tier-3-on-idle

  const handleSubmit = async (payload: EntityComposerSubmitPayload) => {
    const tempPost = buildTempPost(payload);
    dispatch({ type: 'postPrepended', post: tempPost });
    onLog(`⚡ chèn bài tạm (${payload.body.entities.length} entity, key ${payload.idempotencyKey.slice(0, 8)}…)`);
    try {
      const response: CreatePostResponse = await createPost({ body: payload.body, mediaIds: [] }, payload.idempotencyKey, ({ attempt, delayMs }) =>
        onLog(`🔁 retry lần ${attempt} sau ${delayMs}ms – CÙNG key`),
      );
      dispatch({ type: 'entitiesMerged', entities: { users: response.users, media: response.media } });
      dispatch({ type: 'postReplaced', previousId: tempPost.id, post: response.post });
      onLog(`✅ server tạo ${response.post.id}, entity lưu: ${response.post.body.entities.map((entity) => entity.type).join(', ') || 'không có'}`);
    } catch (reason) {
      dispatch({ type: 'postRemoved', postId: tempPost.id });
      onLog('↩️ lỗi → gỡ bài tạm. Draft vẫn giữ để thử lại.');
      throw reason;
    }
  };

  const isLoading = status === 'loading-initial' || status === 'loading-older';
  return (
    <>
      <EntityAwareComposer usersById={state.usersById} onSubmit={handleSubmit} onLog={onLog} />
      <div role="feed" aria-label="Bảng tin" aria-busy={isLoading} className="feed" data-testid="lazy-feed">
        {postIds.map((postId, index) => (
          <LazyPostCard key={postId} postId={postId} locale={LOCALE} now={now} priority={index === 0} />
        ))}
      </div>
      {isLoading && <PostSkeletonList count={status === 'loading-initial' ? 3 : 1} />}
      {status === 'error' && <FeedErrorAlert error={error} onRetry={retry} />}
      <div ref={sentinelRef} className="sentinel" aria-hidden="true" />
    </>
  );
}

export default function Lesson10LazyLoading() {
  const [log, setLog] = useState<string[]>([]);
  const [idlePrefetch, setIdlePrefetch] = useState(false);
  const chunks = useLoadedJsChunks();
  // useState setter ổn định → onLog ổn định, effect idle không chạy lại vô cớ.
  const [addLog] = useState(() => (line: string) => setLog((current) => [`${new Date().toLocaleTimeString()} ${line}`, ...current].slice(0, 30)));

  return (
    <ReactionFeedStoreProvider>
      <LessonLayout
        number={10}
        title="Lazy-load code & JS tiers"
        radioSections="O – Performance (code splitting) / Composer"
        keyFiles={[
          'src/shared/lazy/lazy-with-preload.ts',
          'src/lessons/05-optimistic-reaction/reaction-picker.tsx',
          'src/lessons/05-optimistic-reaction/reaction-menu.tsx',
          'src/lessons/10-lazy-loading/post-renderer-registry.ts',
          'src/lessons/10-lazy-loading/author-name-with-hover-card.tsx',
          'src/lessons/10-lazy-loading/composer-entity-parser.ts',
          'src/lessons/10-lazy-loading/entity-aware-composer.tsx',
        ]}
        observe={[
          'Mở Network (lọc JS) rồi tải lại trang: chưa có chunk reaction-menu / author-hover-card / emoji-picker. Chỉ có renderer của loại bài CÓ trong trang đầu (xem bảng "Chunk JS đã tải").',
          'Di chuột vào THANH reaction của một bài (không cần tới nút ▾): menu mở ngay và chunk reaction-menu bắt đầu tải ngay lúc pointerenter của thanh. Chunk chưa về thì thấy khung giữ chỗ cùng kích thước (không nhảy layout); preload chỉ rút ngắn khoảng chờ chứ không xoá nó – muốn lần hover đầu cũng không khựng, bật "Prefetch Tier 3 khi rảnh". Bàn phím: Tab tới nút ▾ (focus) cũng preload.',
          'Hover tên tác giả 300ms (hoặc Tab tới tên): hover card hiện tên, handle, "Bạn bè/Đang theo dõi" – dữ liệu có sẵn trong feed, chỉ tải code. Esc để đóng.',
          'Bật "Prefetch Tier 3 khi rảnh" rồi tải lại trang: ba chunk tương tác được tải lúc trình duyệt rảnh, không cần hover.',
          'Composer: gõ "Chào @an1 #frontend https://example.com" → preview + danh sách entity với offset UTF-16; @handle không tồn tại không thành entity.',
          'Dán (Cmd/Ctrl+V) nội dung copy từ trang web: chỉ còn text thuần – xem log "paste". Bấm 😊: chunk emoji-picker tải lười.',
          'Đăng bài với tỉ lệ lỗi/độ trễ cao: bài tạm hiện ngay, retry dùng cùng Idempotency-Key (giống lesson 06).',
        ]}
        aside={
          <>
            <div className="panel">
              <h2>Prefetch</h2>
              <label>
                <input type="checkbox" data-testid="idle-prefetch-toggle" checked={idlePrefetch} onChange={(event) => setIdlePrefetch(event.target.checked)} /> Prefetch Tier 3 khi trình duyệt rảnh
              </label>
              <p className="muted">Chỉ có tác dụng với chunk chưa tải – tải lại trang để so sánh có/không bật.</p>
            </div>
            <div className="panel">
              <h2>Log</h2>
              <ol className="event-log" data-testid="lesson-10-log">
                {log.map((line, index) => (
                  <li key={index} className="event-log__item">
                    {line}
                  </li>
                ))}
              </ol>
            </div>
            <LoadedChunksTable chunks={chunks} />
          </>
        }
      >
        <JsTiersTable chunks={chunks} />
        <LazyFeed onLog={addLog} idlePrefetch={idlePrefetch} />
      </LessonLayout>
    </ReactionFeedStoreProvider>
  );
}
