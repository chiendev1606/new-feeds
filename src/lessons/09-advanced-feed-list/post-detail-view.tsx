/**
 * TRANG CHI TIẾT BÀI (route con #/lesson-09/post/:id) – chứng minh GỘP REQUEST TRÙNG.
 *
 * Ba component độc lập (tiêu đề, số liệu, bài viết) đều cần dữ liệu bài này nên mỗi cái tự gọi fetchPost(id) –
 * đúng kiểu code thật: component không biết nhau, không ai muốn "lift" việc fetch lên cha chỉ để tránh trùng.
 * Tầng data access (http-client) gộp các GET cùng URL đang bay vào MỘT request mạng. Mở tab Network: chỉ có 1 dòng
 * /api/posts/:id dù 3 component cùng gọi. Panel bên dưới đếm số lần gọi và số lần được gộp (qua httpClientEvents).
 *
 * LƯU Ý: không truyền `signal` vào fetchPost – GET có signal riêng sẽ KHÔNG được gộp (huỷ của component này
 * sẽ huỷ luôn request của component kia). Thay vào đó bỏ qua kết quả khi component đã unmount (cờ `ignore`).
 */
import { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { fetchPost } from '../../shared/api/feed-api';
import { httpClientEvents } from '../../shared/api/http-client';
import { FeedPostArticle } from '../../shared/post-rendering/feed-post-article';
import { formatFullDateTime } from '../../shared/post-rendering/format-relative-time';
import type { SinglePostResponse } from '../../shared/types/feed-entities';
import { toErrorMessage } from '../../shared/utils/to-error-message';
import { useFeedDispatch } from '../03-normalized-store/feed-store-context';
import { FEED_HASH } from './lesson-09-route';

const LOCALE = 'vi-VN';

type FetchState = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; data: SinglePostResponse };

// 📖 Bài học lesson-09 §5 – mỗi component tự gọi fetchPost, không truyền signal, bỏ kết quả khi unmount (docs/lessons/lesson-09.md)
// #region learn:detail-fetch-with-ignore-flag
function useFetchedPost(postId: string, onCall: () => void): FetchState {
  const [state, setState] = useState<FetchState>({ status: 'loading' });
  useEffect(() => {
    let ignore = false;
    setState({ status: 'loading' });
    onCall();
    fetchPost(postId).then(
      (data) => !ignore && setState({ status: 'ready', data }),
      (error: unknown) => !ignore && setState({ status: 'error', message: toErrorMessage(error) }),
    );
    return () => {
      ignore = true;
    };
  }, [postId, onCall]);
  return state;
}
// #endregion learn:detail-fetch-with-ignore-flag

interface DetailPartProps {
  postId: string;
  onCall: () => void;
}

/** Component 1: tiêu đề – tên tác giả + thời gian đầy đủ. */
function PostDetailTitle({ postId, onCall }: DetailPartProps) {
  const state = useFetchedPost(postId, onCall);
  if (state.status !== 'ready') return <h2>Chi tiết bài viết</h2>;
  const { post, users } = state.data;
  return (
    <h2 data-testid="detail-title">
      Bài của {users[post.authorId]?.name ?? 'người dùng'} <small className="muted">{formatFullDateTime(post.createdAt, LOCALE)}</small>
    </h2>
  );
}

/** Component 2: số liệu tương tác (đồng thời hiện lỗi nếu tải thất bại). */
function PostDetailStats({ postId, onCall }: DetailPartProps) {
  const state = useFetchedPost(postId, onCall);
  if (state.status === 'error') {
    return (
      <p role="alert" className="error-text">
        {state.message}
      </p>
    );
  }
  if (state.status === 'loading') return <p className="muted">Đang tải số liệu…</p>;
  const { engagementSummary } = state.data.post;
  return (
    <p data-testid="detail-stats" className="muted">
      {engagementSummary.totalReactions} reaction · {engagementSummary.commentCount} bình luận · {engagementSummary.shareCount} chia sẻ
    </p>
  );
}

/** Component 3: nội dung bài – merge vào normalized store rồi render bằng FeedPostArticle (đọc từ store). */
function PostDetailArticle({ postId, onCall }: DetailPartProps) {
  const state = useFetchedPost(postId, onCall);
  const dispatch = useFeedDispatch();
  const data = state.status === 'ready' ? state.data : null;
  useEffect(() => {
    if (data) dispatch({ type: 'entitiesMerged', entities: { posts: { [data.post.id]: data.post }, users: data.users, media: data.media } });
  }, [data, dispatch]);
  if (state.status === 'error') return null; // lỗi đã hiện ở PostDetailStats
  if (!data) return <p className="muted">Đang tải bài viết…</p>;
  return <FeedPostArticle postId={postId} posInSet={1} setSize={1} locale={LOCALE} now={Date.now()} priority />;
}

/** Nên render với key={postId} để bộ đếm tự về 0 khi đổi bài. */
export function PostDetailView({ postId }: { postId: string }) {
  const [stats, setStats] = useState({ calls: 0, deduped: 0 });
  const onCall = useCallback(() => setStats((current) => ({ ...current, calls: current.calls + 1 })), []);

  // 📖 Bài học lesson-09 §5 – đếm request được gộp bằng sự kiện request-deduped (docs/lessons/lesson-09.md)
  // #region learn:detail-dedup-counter
  // useLayoutEffect: effect của component con (gọi fetchPost) chạy TRƯỚC effect của cha, nên cha phải đăng ký
  // listener ở pha layout (chạy trước mọi effect thường) thì mới không bỏ sót lần gộp đầu tiên.
  useLayoutEffect(() => {
    const url = `/api/posts/${encodeURIComponent(postId)}`;
    const onDeduped = (event: Event) => {
      if ((event as CustomEvent<string>).detail === url) setStats((current) => ({ ...current, deduped: current.deduped + 1 }));
    };
    httpClientEvents.addEventListener('request-deduped', onDeduped);
    return () => httpClientEvents.removeEventListener('request-deduped', onDeduped);
  }, [postId]);
  // #endregion learn:detail-dedup-counter

  useEffect(() => {
    // Trang chi tiết ngắn; vị trí scroll của feed đã được lưu bằng anchor nên có thể cuộn lên đầu.
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [postId]);

  return (
    <section aria-label="Chi tiết bài viết" data-testid="post-detail" data-post-id={postId}>
      <p>
        <a href={FEED_HASH} data-testid="back-to-feed">
          ← Về feed
        </a>{' '}
        <span className="muted">(hoặc nút Back của trình duyệt – cả hai đều trả về đúng vị trí đang đọc)</span>
      </p>
      <PostDetailTitle postId={postId} onCall={onCall} />
      <PostDetailStats postId={postId} onCall={onCall} />
      <PostDetailArticle postId={postId} onCall={onCall} />
      <div className="panel" data-testid="dedup-panel" data-calls={stats.calls} data-deduped={stats.deduped}>
        <h2>Gộp request trùng</h2>
        <p>
          3 component cùng gọi <code>fetchPost</code>: <strong>{stats.calls}</strong> lần gọi, <strong>{stats.deduped}</strong> lần được gộp → request mạng thực ={' '}
          <strong data-testid="dedup-network-requests">{Math.max(0, stats.calls - stats.deduped)}</strong>. Kiểm tra bằng tab Network (lọc <code>/api/posts/</code>).
        </p>
        <p className="muted">React StrictMode (dev) chạy effect hai lần nên số lần gọi có thể gấp đôi; số request mạng vẫn là 1.</p>
      </div>
    </section>
  );
}
