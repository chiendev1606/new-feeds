/**
 * LESSON 01 – Feed cơ bản (R + A trong RADIO)
 *
 * R – Requirements (bài viết):
 *   Functional: xem feed, react, đăng bài (text + ảnh), cuộn tải thêm, thấy bài mới.
 *   Non-functional: tải nhanh, cuộn mượt, chịu được mạng chập chờn, a11y, i18n.
 *   → Lesson này chỉ làm "xem feed" ở dạng thô nhất để có điểm xuất phát.
 *
 * A – Architecture: 4 layer, đánh dấu ngay trong code bên dưới:
 *   [SERVER]       backend Express (server/) – nguồn sự thật.
 *   [DATA ACCESS]  src/shared/api/* – lớp duy nhất biết HTTP (fetch, retry, cursor).
 *   [STORE]        ở đây chỉ là useState – lesson 03 sẽ nâng cấp thành normalized store.
 *   [VIEW]         component React, chỉ đọc store và render.
 *
 * CSR (client-side rendering) được chọn cho feed vì nội dung cá nhân hoá + nhiều tương tác.
 * Hạn chế cố ý của lesson này (sẽ sửa ở các lesson sau):
 *   - Chỉ tải 1 trang, không có "tải thêm".
 *   - State lồng nhau theo response, chưa chuẩn hoá.
 *   - Spinner chữ thay vì skeleton.
 */
import { useEffect, useState } from 'react';
import { fetchFeedPage } from '../../shared/api/feed-api';
import type { NormalizedFeedResponse } from '../../shared/types/feed-entities';
import { LessonLayout } from '../../shared/ui/lesson-layout';
import { PostCardBasic } from '../../shared/ui/post-card-basic';
import { toErrorMessage } from '../../shared/utils/to-error-message';

export default function Lesson01BasicFeed() {
  // [STORE] state đơn giản nhất có thể.
  const [page, setPage] = useState<NormalizedFeedResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // AbortController: rời trang (hoặc StrictMode chạy effect 2 lần) trước khi request xong → huỷ request thừa,
    // tiết kiệm băng thông và không để response cũ ghi đè state mới.
    const controller = new AbortController();
    // [DATA ACCESS] View không gọi fetch trực tiếp.
    fetchFeedPage({ count: 10, signal: controller.signal })
      .then(setPage)
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) setError(toErrorMessage(reason));
      });
    return () => controller.abort();
  }, []);

  return (
    <LessonLayout
      number={1}
      title="Feed cơ bản & các layer kiến trúc"
      radioSections="R + A"
      keyFiles={['src/lessons/01-basic-feed/lesson-01-basic-feed.tsx', 'src/shared/api/feed-api.ts', 'server/src/routes/feed-routes.ts']}
      observe={[
        'DevTools → Network: chỉ có 1 request GET /api/feed?count=10. Xem response: posts, users, media được tách riêng.',
        'Terminal backend: dòng log GET /api/feed với thời gian ~400ms (độ trễ giả).',
        'Tăng "Độ trễ" lên 3000ms rồi tải lại trang: chỉ thấy chữ "Đang tải…" – trải nghiệm kém, lesson 04 sẽ thay bằng skeleton.',
        'Kéo "Tỉ lệ lỗi" lên 100% rồi tải lại: http-client tự retry 3 lần (xem log backend) rồi mới báo lỗi.',
      ]}
    >
      {/* [VIEW] */}
      {error && <p className="error-text">Lỗi: {error}</p>}
      {!page && !error && <p>Đang tải…</p>}
      {page && (
        <div className="feed">
          {page.feed.postIds.map((postId) => {
            const post = page.posts[postId]!;
            return (
              <PostCardBasic
                key={postId}
                post={post}
                author={page.users[post.authorId]}
                media={post.mediaIds.map((id) => page.media[id]).filter((item) => item !== undefined)}
              />
            );
          })}
          <p className="muted">Hết. Lesson này chưa có "tải thêm" – xem lesson 02 &amp; 04.</p>
        </div>
      )}
    </LessonLayout>
  );
}
