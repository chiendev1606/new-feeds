/**
 * Danh sách lesson. Mỗi lesson được load bằng React.lazy → mỗi lesson là một chunk JS riêng
 * (minh hoạ "route-based code splitting" trong phần Performance của bài).
 */
import { lazy, type ComponentType, type LazyExoticComponent } from 'react';

export interface LessonDefinition {
  id: string;
  number: number;
  title: string;
  radioSections: string;
  summary: string;
  Component: LazyExoticComponent<ComponentType>;
}

export const LESSONS: LessonDefinition[] = [
  {
    id: 'lesson-01',
    number: 1,
    title: 'Feed cơ bản & các layer kiến trúc',
    radioSections: 'R + A',
    summary: 'Tải một trang feed và render. Nhận diện các layer View / Store / Data access / Server.',
    Component: lazy(() => import('./01-basic-feed/lesson-01-basic-feed')),
  },
  {
    id: 'lesson-02',
    number: 2,
    title: 'Cursor vs offset pagination',
    radioSections: 'I',
    summary: 'Chèn bài mới giữa hai lần tải: offset bị trùng bài, cursor thì không.',
    Component: lazy(() => import('./02-cursor-pagination/lesson-02-cursor-pagination')),
  },
  {
    id: 'lesson-03',
    number: 3,
    title: 'Normalized store',
    radioSections: 'D',
    summary: 'postsById / usersById / mediaById. Sửa user một chỗ, mọi bài viết của user đó cập nhật theo.',
    Component: lazy(() => import('./03-normalized-store/lesson-03-normalized-store')),
  },
  {
    id: 'lesson-04',
    number: 4,
    title: 'Infinite scroll & bài mới',
    radioSections: 'O – Feed list',
    summary: 'IntersectionObserver, prefetch trước 1 viewport, skeleton, banner "Có bài mới".',
    Component: lazy(() => import('./04-infinite-scroll/lesson-04-infinite-scroll')),
  },
  {
    id: 'lesson-05',
    number: 5,
    title: 'Optimistic reaction',
    radioSections: 'O – Feed post',
    summary: 'UI cập nhật ngay, rollback khi lỗi, bỏ qua response cũ đến trễ.',
    Component: lazy(() => import('./05-optimistic-reaction/lesson-05-optimistic-reaction')),
  },
  {
    id: 'lesson-06',
    number: 6,
    title: 'Composer & upload ảnh',
    radioSections: 'I + O – Composer',
    summary: 'Upload ảnh trước rồi mới tạo bài, idempotency key, chèn bài mới optimistic.',
    Component: lazy(() => import('./06-composer-upload/lesson-06-composer-upload')),
  },
  {
    id: 'lesson-07',
    number: 7,
    title: 'Ảnh, a11y, i18n, render an toàn',
    radioSections: 'O – Feed post / A11y / i18n',
    summary: 'Ảnh responsive, giữ chỗ chống CLS, mention/hashtag an toàn, Intl, role="feed".',
    Component: lazy(() => import('./07-perf-a11y-images/lesson-07-perf-a11y-images')),
  },
  {
    id: 'lesson-08',
    number: 8,
    title: 'Virtualization',
    radioSections: 'O – Feed list',
    summary: 'Chỉ giữ các bài đang nhìn thấy trong DOM, dùng spacer và cache chiều cao.',
    Component: lazy(() => import('./08-virtualization/lesson-08-virtualization')),
  },
  {
    id: 'lesson-09',
    number: 9,
    title: 'Feed list nâng cao',
    radioSections: 'O – Feed list',
    summary: 'Giữ vị trí scroll khi quay lại, feed cũ, đồng bộ giữa các tab, gộp request trùng, focus khi virtualize.',
    Component: lazy(() => import('./09-advanced-feed-list/lesson-09-advanced-feed-list')),
  },
  {
    id: 'lesson-10',
    number: 10,
    title: 'Lazy-load code & JS tiers',
    radioSections: 'O – Feed post / Composer / Performance',
    summary: 'Menu, hover card, renderer theo loại bài tải khi cần; composer sinh entity cho #tag và @mention.',
    Component: lazy(() => import('./10-lazy-loading/lesson-10-lazy-loading')),
  },
  {
    id: 'lesson-11',
    number: 11,
    title: 'Đo lường & telemetry',
    radioSections: 'O – Performance / Telemetry',
    summary: 'LCP/CLS/INP so với budget, đếm lượt hiển thị gửi theo lô bằng sendBeacon, Intl.ListFormat.',
    Component: lazy(() => import('./11-metrics-telemetry/lesson-11-metrics-telemetry')),
  },
  {
    id: 'lesson-12',
    number: 12,
    title: 'Resilience & offline',
    radioSections: 'O – Networking / Offline',
    summary: 'Làm mới session khi gặp 401, xử lý 404, outbox khi offline, Service Worker.',
    Component: lazy(() => import('./12-resilience-offline/lesson-12-resilience-offline')),
  },
];

/** "#/lesson-09/post/abc" → lesson-09: phần sau dấu "/" là route con, lesson tự xử lý. */
export function findLessonByHash(hash: string): LessonDefinition | undefined {
  const id = hash.replace(/^#\/?/, '').split('/')[0];
  return LESSONS.find((lesson) => lesson.id === id);
}
