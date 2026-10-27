/**
 * LESSON 07 – Ảnh, a11y, i18n, render an toàn (O – Feed post / Accessibility / i18n)
 *
 * Feed container theo WAI-ARIA feed pattern:
 *   role="feed" + aria-label, aria-busy="true" khi đang tải thêm (screen reader chờ ổn định mới đọc).
 * Đổi ngôn ngữ để thấy Intl tự đổi thời gian/số đếm; chọn "العربية" để thấy dir="rtl" + CSS logical properties.
 */
import { useState } from 'react';
import { useFeedLoader } from '../../shared/hooks/use-feed-loader';
import { FeedPostArticle } from '../../shared/post-rendering/feed-post-article';
import { useNow } from '../../shared/post-rendering/format-relative-time';
import { LessonLayout } from '../../shared/ui/lesson-layout';
import { PostSkeletonList } from '../../shared/ui/post-skeleton';
import { FeedErrorAlert } from '../../shared/ui/feed-error-alert';
import { useFeedState } from '../03-normalized-store/feed-store-context';
import { ReactionFeedStoreProvider } from '../05-optimistic-reaction/reaction-feed-store-provider';

const LOCALES = [
  { value: 'vi-VN', label: 'Tiếng Việt' },
  { value: 'en-US', label: 'English' },
  { value: 'ar-EG', label: 'العربية (RTL)' },
] as const;

// 📖 Bài học lesson-07 §1 – role=feed, aria-busy và aria-setsize khi chưa biết tổng (docs/lessons/lesson-07.md)
// #region learn:accessible-feed-container
export function AccessibleFeed({ locale }: { locale: string }) {
  const state = useFeedState();
  const now = useNow();
  const { status, error, retry, hasOlder, sentinelRef } = useFeedLoader();
  const isLoading = status === 'loading-initial' || status === 'loading-older';

  return (
    <>
      <div role="feed" aria-label="Bảng tin" aria-busy={isLoading} className="feed">
        {state.feed.postIds.map((postId, index) => (
          <FeedPostArticle key={postId} postId={postId} posInSet={index + 1} setSize={hasOlder ? -1 : state.feed.postIds.length} locale={locale} now={now} priority={index === 0} />
        ))}
      </div>
      {isLoading && <PostSkeletonList count={status === 'loading-initial' ? 3 : 1} />}
      {status === 'error' && <FeedErrorAlert error={error} onRetry={retry} />}
      <div ref={sentinelRef} className="sentinel" aria-hidden="true" />
    </>
  );
}
// #endregion learn:accessible-feed-container

const DEVTOOLS_CHECKLIST = [
  'Network → lọc "media": chỉ ảnh gần màn hình được tải; cột Size cho thấy w=320/640/960 tuỳ màn hình (srcset).',
  'Performance/Lighthouse: CLS ≈ 0 vì ảnh có width/height + aspect-ratio + màu nền giữ chỗ.',
  'Elements → Accessibility tree: role="feed", mỗi bài là article có tên (tác giả) và aria-posinset.',
  'Thử Tab qua một bài: mention/hashtag/link, nút Thích, nút ▾, "Xem thêm" đều tới được bằng bàn phím.',
  'Đổi ngôn ngữ: "5 phút trước" → "5 minutes ago"; số 12.345 → "12.3K" (en) / "12,3 N" (vi); "1 comment" vs "2 comments" (PluralRules).',
  'Chọn العربية: layout đảo chiều nhờ CSS logical properties (margin-inline, padding-inline...).',
  'Bật Rendering → "Emulate prefers-reduced-motion": skeleton ngừng nhấp nháy.',
];

export default function Lesson07PerfA11yImages() {
  // 📖 Bài học lesson-07 §4 – locale quyết định hướng chữ (docs/lessons/lesson-07.md)
  // #region learn:locale-state-and-dir
  const [locale, setLocale] = useState<string>('vi-VN');
  const dir = locale.startsWith('ar') ? 'rtl' : 'ltr';
  // #endregion learn:locale-state-and-dir

  return (
    <ReactionFeedStoreProvider>
      <LessonLayout
        number={7}
        title="Ảnh, a11y, i18n, render an toàn"
        radioSections="O – Feed post / A11y / i18n"
        keyFiles={[
          'src/shared/post-rendering/feed-post-article.tsx',
          'src/shared/post-rendering/responsive-post-image.tsx',
          'src/shared/post-rendering/render-post-body-with-entities.tsx',
          'src/shared/post-rendering/format-relative-time.ts',
        ]}
        observe={[
          'Mention (@…), hashtag (#…), link được render từ entity ranges – không có HTML nào từ server.',
          'Bài dài có nút "Xem thêm" (aria-expanded). Thời gian tương đối tự cập nhật mỗi phút (1 timer chung).',
          'Ảnh: lưới 1–4, lazy-load, srcset, giữ chỗ đúng tỉ lệ. Bài đầu tiên tải ảnh ngay (ứng viên LCP).',
          'Xem checklist DevTools ở cột bên.',
        ]}
        aside={
          <>
            <div className="panel">
              <h2>Ngôn ngữ (i18n)</h2>
              <label>
                Locale:{' '}
                <select value={locale} onChange={(event) => setLocale(event.target.value)}>
                  {LOCALES.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="panel">
              <h2>Kiểm tra bằng DevTools</h2>
              <ol className="muted" style={{ paddingInlineStart: '1.2rem' }}>
                {DEVTOOLS_CHECKLIST.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ol>
            </div>
          </>
        }
      >
        {/* 📖 Bài học lesson-07 §4 – lang và dir bao quanh feed (docs/lessons/lesson-07.md) */}
        {/* #region learn:locale-dir-wrapper */}
        <div lang={locale} dir={dir}>
          <AccessibleFeed locale={locale} />
        </div>
        {/* #endregion learn:locale-dir-wrapper */}
      </LessonLayout>
    </ReactionFeedStoreProvider>
  );
}
