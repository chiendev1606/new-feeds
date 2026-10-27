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
];

export function findLessonByHash(hash: string): LessonDefinition | undefined {
  const id = hash.replace(/^#\/?/, '');
  return LESSONS.find((lesson) => lesson.id === id);
}
