/**
 * LESSON 06 – Composer & upload ảnh (I + O – Composer)
 *
 * Đăng bài = optimistic insert:
 *   1. Chèn ngay bài TẠM (id "temp-…") lên đầu feed, mờ đi → người dùng thấy bài của mình tức thì.
 *   2. Server trả về → thay bài tạm bằng bài thật (postReplaced).
 *   3. Lỗi → gỡ bài tạm, composer giữ nguyên nội dung + key để thử lại.
 */
import { useState } from 'react';
import { createPost } from '../../shared/api/feed-api';
import { useFeedLoader } from '../../shared/hooks/use-feed-loader';
import type { CreatePostResponse, Post } from '../../shared/types/feed-entities';
import { createEmptyEngagementSummary } from '../../shared/types/feed-entities';
import type { RequestOptions } from '../../shared/api/http-client';
import { LessonLayout } from '../../shared/ui/lesson-layout';
import { PostCardBasic } from '../../shared/ui/post-card-basic';
import { PostSkeletonList } from '../../shared/ui/post-skeleton';
import { FeedStoreProvider, useFeedDispatch, useFeedState, usePostView } from '../03-normalized-store/feed-store-context';
import type { ComposerSubmitPayload } from './composer';
import { Composer } from './composer';

const VIEWER_ID = 'user-1';
const TEMP_ID_PREFIX = 'temp-';

function ConnectedPostCard({ postId }: { postId: string }) {
  const { post, author, media } = usePostView(postId);
  if (!post) return null;
  const isTemp = postId.startsWith(TEMP_ID_PREFIX);
  return (
    <div className={isTemp ? 'post-card--pending' : undefined} aria-busy={isTemp}>
      {isTemp && <p className="muted">⏳ Đang đăng (bài tạm, chưa có trên server)…</p>}
      <PostCardBasic post={post} author={author} media={media} />
    </div>
  );
}

// 📖 Bài học lesson-06 §4 – dựng bài tạm có id temp- (docs/lessons/lesson-06.md)
// #region learn:build-temp-post
function buildTempPost(payload: ComposerSubmitPayload): Post {
  return {
    id: `${TEMP_ID_PREFIX}${payload.idempotencyKey}`,
    authorId: VIEWER_ID,
    body: { text: normalizeComposerText(payload.text), entities: [] },
    mediaIds: payload.mediaIds,
    engagementSummary: createEmptyEngagementSummary(),
    viewerReaction: null,
    createdAt: new Date().toISOString(),
  };
}
// #endregion learn:build-temp-post

// 📖 Bài học lesson-06 §5 – chuẩn hoá NFC trước khi gửi (docs/lessons/lesson-06.md)
// #region learn:normalize-nfc-client
/**
 * Chuẩn hoá NFC trước khi gửi: text dán từ tên file macOS, PDF, vài bộ gõ hay ở dạng NFD ("ệ" = e + 2 dấu rời).
 * Server cũng tự chuẩn hoá khi không có entity, nhưng làm ở client giúp bài tạm khớp đúng với bài thật và là thói quen
 * đúng khi sau này có entity (offset tính trên dạng NFC).
 */
const normalizeComposerText = (text: string) => text.normalize('NFC');

/** Gửi payload của composer lên server – dùng cho cả lần đăng đầu và thí nghiệm gửi lại cùng key. */
function submitComposerPayload(payload: ComposerSubmitPayload, onRetry?: RequestOptions['onRetry']) {
  return createPost({ body: { text: normalizeComposerText(payload.text), entities: [] }, mediaIds: payload.mediaIds, altTexts: payload.altTexts }, payload.idempotencyKey, onRetry);
}
// #endregion learn:normalize-nfc-client

interface ReplayCheck {
  firstId: string;
  replayId: string;
}

function ComposerFeed({ onLog }: { onLog: (line: string) => void }) {
  const state = useFeedState();
  const dispatch = useFeedDispatch();
  const { status, sentinelRef } = useFeedLoader();
  const [lastSubmission, setLastSubmission] = useState<{ payload: ComposerSubmitPayload; postId: string } | null>(null);
  const [replay, setReplay] = useState<ReplayCheck | null>(null);

  // 📖 Bài học lesson-06 §4 – chèn bài tạm rồi thay bằng bài thật hoặc gỡ (docs/lessons/lesson-06.md)
  // #region learn:optimistic-insert-temp-post
  const handleSubmit = async (payload: ComposerSubmitPayload) => {
    const tempPost = buildTempPost(payload);
    dispatch({ type: 'postPrepended', post: tempPost });
    onLog(`⚡ chèn bài tạm ${tempPost.id.slice(0, 13)}… (key ${payload.idempotencyKey.slice(0, 8)}…)`);
    try {
      const response: CreatePostResponse = await submitComposerPayload(payload, ({ attempt, delayMs }) =>
        onLog(`🔁 retry lần ${attempt} sau ${delayMs}ms – CÙNG key ${payload.idempotencyKey.slice(0, 8)}…`),
      );
      dispatch({ type: 'entitiesMerged', entities: { users: response.users, media: response.media } });
      dispatch({ type: 'postReplaced', previousId: tempPost.id, post: response.post });
      onLog(`✅ server tạo ${response.post.id} → thay bài tạm`);
      setLastSubmission({ payload, postId: response.post.id });
      setReplay(null);
    } catch (error) {
      dispatch({ type: 'postRemoved', postId: tempPost.id });
      onLog(`↩️ lỗi → gỡ bài tạm. Draft vẫn giữ để thử lại.`);
      throw error;
    }
  };
  // #endregion learn:optimistic-insert-temp-post

  // 📖 Bài học lesson-06 §3 – thí nghiệm gửi lại cùng key (docs/lessons/lesson-06.md)
  // #region learn:replay-same-key
  const replayLastSubmission = async () => {
    if (!lastSubmission) return;
    const { payload } = lastSubmission;
    const response = await submitComposerPayload(payload);
    // Kể cả nếu ta có dispatch vào feed, mergeUniqueIds cũng không cho trùng – nhưng điểm chính là server KHÔNG tạo bài mới.
    dispatch({ type: 'postPrepended', post: response.post });
    setReplay({ firstId: lastSubmission.postId, replayId: response.post.id });
    onLog(`🔂 gửi lại cùng key → server trả ${response.post.id}`);
  };
  // #endregion learn:replay-same-key

  return (
    <>
      <Composer onSubmit={handleSubmit} onMediaUploaded={(media) => dispatch({ type: 'entitiesMerged', entities: { media: { [media.id]: media } } })} />

      {lastSubmission && (
        <div className="panel">
          <h2>Thí nghiệm idempotency</h2>
          <p>Giả sử mạng rớt đúng lúc server đã tạo bài nhưng client chưa nhận response → client gửi lại với cùng key.</p>
          <button type="button" onClick={() => void replayLastSubmission()}>
            Gửi lại bài vừa đăng với CÙNG key
          </button>
          {replay && (
            <p className={replay.firstId === replay.replayId ? undefined : 'error-text'}>
              Lần đầu: <code>{replay.firstId}</code> · Gửi lại: <code>{replay.replayId}</code> →{' '}
              {replay.firstId === replay.replayId ? '✅ cùng một bài, server không tạo trùng' : '❌ server tạo trùng!'}
            </p>
          )}
        </div>
      )}

      <div className="feed">
        {status === 'loading-initial' && <PostSkeletonList count={2} />}
        {state.feed.postIds.map((postId) => (
          <ConnectedPostCard key={postId} postId={postId} />
        ))}
      </div>
      <div ref={sentinelRef} className="sentinel" aria-hidden="true" />
    </>
  );
}

export default function Lesson06ComposerUpload() {
  const [log, setLog] = useState<string[]>([]);
  const addLog = (line: string) => setLog((current) => [`${new Date().toLocaleTimeString()} ${line}`, ...current].slice(0, 20));

  return (
    <FeedStoreProvider>
      <LessonLayout
        number={6}
        title="Composer & upload ảnh"
        radioSections="I + O – Composer"
        keyFiles={['src/lessons/06-composer-upload/composer.tsx', 'src/lessons/06-composer-upload/composer-draft-reducer.ts', 'server/src/routes/post-routes.ts', 'server/src/services/idempotency-store.ts']}
        observe={[
          'Chọn 1–2 ảnh: preview hiện NGAY (blob URL), upload chạy nền (POST /api/media/uploads). Nút "Đăng" bị khoá tới khi upload xong.',
          'Đăng bài: bài tạm (mờ) xuất hiện ngay trên đầu feed, rồi được thay bằng bài thật.',
          'Tỉ lệ lỗi 50% rồi đăng: http-client tự retry với CÙNG Idempotency-Key (xem log bên phải + terminal "key=…").',
          'Tỉ lệ lỗi 100%: bài tạm bị gỡ, draft còn nguyên, nút đổi thành "Thử lại" và vẫn dùng key cũ.',
          'Sau khi đăng thành công: bấm "Gửi lại… với CÙNG key" → server trả lại đúng bài cũ (terminal: "(replayed)").',
          'Ảnh lớn được thu nhỏ còn ≤1600px và mất EXIF trước khi upload (prepare-image-for-upload.ts).',
        ]}
        aside={
          <div className="panel">
            <h2>Submit log</h2>
            <ol className="event-log">
              {log.map((line, index) => (
                <li key={index} className="event-log__item">
                  {line}
                </li>
              ))}
            </ol>
          </div>
        }
      >
        <ComposerFeed onLog={addLog} />
      </LessonLayout>
    </FeedStoreProvider>
  );
}
