/**
 * LESSON 03 – Normalized store (D – Data model)
 *
 * Response từ server đã chuẩn hoá sẵn ({ feed, posts, users, media }) → reducer chỉ cần merge theo id.
 * Bên phải là "store inspector" để thấy hình dạng state thật.
 * Demo: đổi tên 1 user → mọi bài của user đó cập nhật cùng lúc, vì chỉ có 1 bản ghi user.
 */
import { useEffect, useState } from 'react';
import { fetchFeedPage } from '../../shared/api/feed-api';
import { LessonLayout } from '../../shared/ui/lesson-layout';
import { PostCardBasic } from '../../shared/ui/post-card-basic';
import { FeedStoreProvider, useFeedDispatch, useFeedState, usePostView } from './feed-store-context';
import { toErrorMessage } from '../../shared/utils/to-error-message';

// 📖 Bài học lesson-03 §4 – card tự chọn dữ liệu theo id (docs/lessons/lesson-03.md)
// #region learn:connected-post-card
/** Mỗi card tự "chọn" dữ liệu của mình từ store bằng id. */
function ConnectedPostCard({ postId, highlightAuthorId }: { postId: string; highlightAuthorId: string | null }) {
  const { post, author, media } = usePostView(postId);
  if (!post) return null;
  return <PostCardBasic post={post} author={author} media={media} highlight={post.authorId === highlightAuthorId} />;
}
// #endregion learn:connected-post-card

function StoreInspector() {
  const state = useFeedState();
  const [view, setView] = useState<'feed' | 'postsById' | 'usersById' | 'mediaById'>('feed');
  return (
    <div className="panel">
      <h2>Store inspector</h2>
      <p className="muted">
        {state.feed.postIds.length} postIds · {Object.keys(state.postsById).length} posts · {Object.keys(state.usersById).length} users ·{' '}
        {Object.keys(state.mediaById).length} media
      </p>
      <div role="group" aria-label="Chọn phần store" style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap', marginBlockEnd: '0.5rem' }}>
        {(['feed', 'postsById', 'usersById', 'mediaById'] as const).map((key) => (
          <button key={key} type="button" aria-pressed={view === key} className={view === key ? 'primary' : undefined} onClick={() => setView(key)}>
            {key}
          </button>
        ))}
      </div>
      <pre>{JSON.stringify(state[view], null, 2)}</pre>
    </div>
  );
}

// 📖 Bài học lesson-03 §3 – đổi tên một user, mọi bài đổi theo (docs/lessons/lesson-03.md)
// #region learn:rename-user-demo
function RenameUserDemo({ onRenamed }: { onRenamed: (userId: string) => void }) {
  const state = useFeedState();
  const dispatch = useFeedDispatch();
  // Chọn tác giả xuất hiện nhiều nhất trong feed để hiệu ứng rõ nhất.
  const counts = new Map<string, number>();
  for (const id of state.feed.postIds) {
    const authorId = state.postsById[id]?.authorId;
    if (authorId) counts.set(authorId, (counts.get(authorId) ?? 0) + 1);
  }
  const [topAuthorId, topCount] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0] ?? [];
  const user = topAuthorId ? state.usersById[topAuthorId] : undefined;
  if (!user) return null;

  return (
    <div className="panel">
      <h2>Demo: sửa 1 chỗ, cập nhật mọi nơi</h2>
      <p>
        <strong>{user.name}</strong> là tác giả của {topCount} bài trong feed, nhưng chỉ có <strong>1</strong> bản ghi trong <code>usersById</code>.
      </p>
      <button
        type="button"
        className="primary"
        onClick={() => {
          dispatch({ type: 'entitiesMerged', entities: { users: { [user.id]: { ...user, name: `${user.name} ✏️` } } } });
          onRenamed(user.id);
        }}
      >
        Đổi tên {user.name}
      </button>
    </div>
  );
}
// #endregion learn:rename-user-demo

function NormalizedFeed() {
  const state = useFeedState();
  const dispatch = useFeedDispatch();
  const [highlightAuthorId, setHighlightAuthorId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 📖 Bài học lesson-03 §2 – tải trang rồi dispatch vào store (docs/lessons/lesson-03.md)
  // #region learn:load-page-into-store
  const loadPage = async (direction: 'initial' | 'older') => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchFeedPage({ count: 10, cursor: direction === 'older' ? state.feed.olderCursor : null });
      dispatch({ type: 'feedPageReceived', direction, response, receivedAt: Date.now() });
    } catch (reason) {
      setError(toErrorMessage(reason));
    } finally {
      setLoading(false);
    }
  };
  // #endregion learn:load-page-into-store

  useEffect(() => {
    // Chỉ tải trang đầu một lần khi mount.
    void loadPage('initial');
  }, []);

  return (
    <>
      <RenameUserDemo onRenamed={setHighlightAuthorId} />
      <div className="feed">
        {state.feed.postIds.map((postId) => (
          <ConnectedPostCard key={postId} postId={postId} highlightAuthorId={highlightAuthorId} />
        ))}
      </div>
      {error && (
        <p role="alert" className="error-text">
          Không tải được: {error}. Kiểm tra "Tỉ lệ lỗi" ở panel mô phỏng.
        </p>
      )}
      <button type="button" className="primary" style={{ marginBlockStart: '1rem' }} disabled={loading || !state.feed.hasOlder} onClick={() => void loadPage('older')}>
        {loading ? 'Đang tải…' : 'Tải thêm (merge vào store)'}
      </button>
    </>
  );
}

export default function Lesson03NormalizedStore() {
  return (
    <FeedStoreProvider>
      <LessonLayout
        number={3}
        title="Normalized store"
        radioSections="D"
        keyFiles={['src/lessons/03-normalized-store/feed-store-reducer.ts', 'src/lessons/03-normalized-store/feed-store-context.tsx', 'shared-contracts/feed-api-contracts.ts']}
        observe={[
          'Store inspector → "feed": chỉ là danh sách postIds + cursor. Dữ liệu thật nằm trong postsById/usersById/mediaById.',
          'Bấm "Đổi tên …": mọi bài của người đó (viền đỏ) đổi tên cùng lúc, vì chỉ sửa 1 bản ghi user.',
          'Bấm "Tải thêm" vài lần: số users tăng chậm hơn số posts – user dùng chung không bị nhân bản.',
          'So sánh với lesson 01: ở đó mỗi response là một object riêng, không merge được.',
        ]}
        aside={<StoreInspector />}
      >
        <NormalizedFeed />
      </LessonLayout>
    </FeedStoreProvider>
  );
}
