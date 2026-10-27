/**
 * LESSON 02 – Cursor vs offset pagination (I – Interface)
 *
 * Offset:  GET /api/feed-offset?offset=10&count=10   → "bỏ qua 10 bài đầu"
 * Cursor:  GET /api/feed?cursor=<mờ>&count=10        → "các bài cũ hơn bài X"
 *
 * Feed là dữ liệu thay đổi liên tục (bạn bè đăng bài mới). Với offset, mỗi bài mới chèn lên đầu
 * đẩy mọi bài xuống 1 vị trí → trang sau lặp lại bài đã thấy. Cursor neo vào một bài cụ thể
 * nên không bị ảnh hưởng. Đây là lý do bài viết chọn cursor-based pagination.
 */
import { useRef, useState } from 'react';
import { fetchFeedPage, fetchFeedPageByOffset } from '../../shared/api/feed-api';
import { insertNewPosts } from '../../shared/api/mock-control-api';
import type { Post, User } from '../../shared/types/feed-entities';
import { LessonLayout } from '../../shared/ui/lesson-layout';
import { PostCardBasic } from '../../shared/ui/post-card-basic';
import { findDuplicatePostIds } from './find-duplicate-post-ids';
import { toErrorMessage } from '../../shared/utils/to-error-message';

const PAGE_SIZE = 5;

interface ColumnState {
  postIds: string[];
  posts: Record<string, Post>;
  users: Record<string, User>;
  hasMore: boolean;
  loading: boolean;
}

const EMPTY_COLUMN: ColumnState = { postIds: [], posts: {}, users: {}, hasMore: true, loading: false };

// 📖 Bài học lesson-02 §1 – nối trang mà không khử trùng (docs/lessons/lesson-02.md)
// #region learn:offset-column-append-page
/** Gộp trang mới vào cột. Cố ý KHÔNG khử trùng để thấy rõ vấn đề của offset. */
function appendPage(column: ColumnState, page: Omit<ColumnState, 'hasMore' | 'loading'>, hasMore: boolean): ColumnState {
  return {
    postIds: [...column.postIds, ...page.postIds],
    posts: { ...column.posts, ...page.posts },
    users: { ...column.users, ...page.users },
    hasMore,
    loading: false,
  };
}
// #endregion learn:offset-column-append-page

function FeedColumn({ title, column, onLoadMore, description, busy }: { title: string; column: ColumnState; onLoadMore: () => void; description: string; busy: boolean }) {
  const duplicates = findDuplicatePostIds(column.postIds);
  return (
    <section className="panel" aria-labelledby={`${title}-heading`}>
      <h2 id={`${title}-heading`}>{title}</h2>
      <p className="muted">{description}</p>
      <p>
        Đã tải <strong>{column.postIds.length}</strong> mục ·{' '}
        <strong className={duplicates.size > 0 ? 'error-text' : undefined}>{duplicates.size} bài bị trùng</strong>
      </p>
      <div className="feed">
        {column.postIds.map((postId, index) => {
          const post = column.posts[postId]!;
          return (
            <PostCardBasic
              key={`${postId}-${index}`}
              post={post}
              author={column.users[post.authorId]}
              media={[]}
              highlight={duplicates.has(postId)}
            />
          );
        })}
      </div>
      <button type="button" className="primary" onClick={onLoadMore} disabled={busy || !column.hasMore} style={{ marginBlockStart: '0.75rem' }}>
        {column.loading ? 'Đang tải…' : column.hasMore ? `Tải thêm ${PAGE_SIZE} bài` : 'Hết'}
      </button>
    </section>
  );
}

export default function Lesson02CursorPagination() {
  const [offsetColumn, setOffsetColumn] = useState(EMPTY_COLUMN);
  const [cursorColumn, setCursorColumn] = useState(EMPTY_COLUMN);
  const [olderCursor, setOlderCursor] = useState<string | null>(null);
  const [log, setLog] = useState<string[]>([]);

  const addLog = (line: string) => setLog((current) => [`${new Date().toLocaleTimeString()} – ${line}`, ...current].slice(0, 12));

  // Khoá nút khi đang tải: bấm 2 lần trước khi response về thì cả 2 lần dùng CÙNG offset/cursor cũ
  // → trùng bài ở cả hai cột, che mất điều lesson muốn chứng minh.
  const busy = offsetColumn.loading || cursorColumn.loading;
  // Offset tiếp theo = số mục đã tải (mỗi trang nối thêm đúng số bài nhận về).
  const nextOffset = offsetColumn.postIds.length;
  // 📖 Bài học lesson-02 §4 – cờ ref đồng bộ chặn bấm đúp (docs/lessons/lesson-02.md)
  // #region learn:in-flight-ref-guard
  // `disabled` chỉ có hiệu lực SAU khi React render lại; hai click trong cùng một tick vẫn lọt qua
  // và đọc cùng offset/cursor cũ → cần thêm cờ đồng bộ bằng ref.
  const inFlightRef = useRef({ offset: false, cursor: false });
  // #endregion learn:in-flight-ref-guard

  // 📖 Bài học lesson-02 §1 – tải trang kế bằng offset (docs/lessons/lesson-02.md)
  // #region learn:load-more-by-offset
  const loadMoreByOffset = async () => {
    if (inFlightRef.current.offset) return;
    inFlightRef.current.offset = true;
    setOffsetColumn((column) => ({ ...column, loading: true }));
    try {
      const page = await fetchFeedPageByOffset(nextOffset, PAGE_SIZE);
      addLog(`offset=${nextOffset} → ${page.postIds.join(', ')}`);
      setOffsetColumn((column) => appendPage(column, page, page.hasMore));
    } catch (error) {
      addLog(`❌ offset lỗi: ${toErrorMessage(error)}`);
      setOffsetColumn((column) => ({ ...column, loading: false }));
    } finally {
      inFlightRef.current.offset = false;
    }
  };
  // #endregion learn:load-more-by-offset

  // 📖 Bài học lesson-02 §4 – tải trang tiếp bằng cursor và chặn bấm đúp (docs/lessons/lesson-02.md)
  // #region learn:load-more-by-cursor
  const loadMoreByCursor = async () => {
    if (inFlightRef.current.cursor) return;
    inFlightRef.current.cursor = true;
    setCursorColumn((column) => ({ ...column, loading: true }));
    try {
      const page = await fetchFeedPage({ count: PAGE_SIZE, cursor: olderCursor, direction: 'older' });
      addLog(`cursor=${olderCursor ? `${olderCursor.slice(0, 10)}…` : '(trang đầu)'} → ${page.feed.postIds.join(', ')}`);
      setOlderCursor(page.feed.olderCursor);
      setCursorColumn((column) => appendPage(column, { postIds: page.feed.postIds, posts: page.posts, users: page.users }, page.feed.hasOlder));
    } catch (error) {
      addLog(`❌ cursor lỗi: ${toErrorMessage(error)}`);
      setCursorColumn((column) => ({ ...column, loading: false }));
    } finally {
      inFlightRef.current.cursor = false;
    }
  };
  // #endregion learn:load-more-by-cursor

  const loadBoth = () => {
    void loadMoreByOffset();
    void loadMoreByCursor();
  };

  return (
    <LessonLayout
      number={2}
      title="Cursor vs offset pagination"
      radioSections="I"
      keyFiles={['src/lessons/02-cursor-pagination/lesson-02-cursor-pagination.tsx', 'server/src/services/feed-cursor-codec.ts', 'server/src/services/feed-query-service.ts', 'server/src/services/offset-feed-query-service.ts']}
      observe={[
        'Bước 1: bấm "Tải thêm ở cả hai cột" một lần.',
        'Bước 2: bấm "Chèn 3 bài mới" (giả lập bạn bè vừa đăng bài).',
        'Bước 3: bấm "Tải thêm ở cả hai cột" lần nữa → cột OFFSET hiện 3 bài trùng (viền đỏ), cột CURSOR không trùng.',
        'Xem cursor trong Network: là chuỗi base64url mờ – client không cần (và không nên) hiểu nó.',
        'Đọc server/src/services/feed-query-service.test.ts: test chứng minh lật hết các trang không trùng/sót kể cả khi có bài mới.',
      ]}
      aside={
        <div className="panel">
          <h2>Request log</h2>
          <ol className="muted" style={{ paddingInlineStart: '1.2rem', fontSize: '0.8rem' }}>
            {log.map((line, index) => (
              <li key={index}>{line}</li>
            ))}
          </ol>
        </div>
      }
    >
      <div style={{ display: 'flex', gap: '0.5rem', marginBlockEnd: '1rem', flexWrap: 'wrap' }}>
        <button type="button" className="primary" onClick={loadBoth} disabled={busy}>
          Tải thêm ở cả hai cột
        </button>
        <button
          type="button"
          onClick={async () => {
            const result = await insertNewPosts(3);
            addLog(`Server chèn 3 bài mới lên đầu: ${result.insertedPostIds.join(', ')}`);
          }}
        >
          Chèn 3 bài mới
        </button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}>
        <FeedColumn title="Offset" column={offsetColumn} onLoadMore={() => void loadMoreByOffset()} description="?offset=N – bỏ qua N bài đầu" busy={busy} />
        <FeedColumn title="Cursor" column={cursorColumn} onLoadMore={() => void loadMoreByCursor()} description="?cursor=… – các bài cũ hơn bài cuối đã thấy" busy={busy} />
      </div>
    </LessonLayout>
  );
}
