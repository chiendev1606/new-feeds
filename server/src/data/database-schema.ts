/**
 * Schema PostgreSQL viết bằng Drizzle (phần "D – Data model" phía server).
 *
 * Đây là NGUỒN SỰ THẬT của cấu trúc bảng: `npm run db:generate` so sánh file này với migration trước
 * rồi sinh file SQL mới trong server/db/migrations; server tự chạy các migration chưa áp dụng khi khởi động.
 * Tên cột trong TypeScript là camelCase, Drizzle tự đổi sang snake_case trong DB (casing: 'snake_case').
 */
import { sql } from 'drizzle-orm';
import { boolean, check, customType, doublePrecision, index, integer, jsonb, pgTable, primaryKey, serial, text, timestamp } from 'drizzle-orm/pg-core';
import type { ReactionType, TextEntity } from '../../../shared-contracts/feed-api-contracts.js';

/** Drizzle chưa có sẵn kiểu BYTEA → khai báo customType; node-postgres trả về Buffer. */
const bytea = customType<{ data: Buffer }>({ dataType: () => 'bytea' });

export const users = pgTable('users', {
  id: text().primaryKey(),
  name: text().notNull(),
  handle: text().notNull().unique(),
  avatarColor: text().notNull(),
  isVerified: boolean().notNull().default(false),
});

// 📖 Bài học shared-foundations §6 – bảng posts và index (created_at DESC, id DESC) cho cursor (docs/lessons/shared-foundations.md)
// #region learn:posts-table-feed-index
export const posts = pgTable(
  'posts',
  {
    id: text().primaryKey(),
    authorId: text()
      .notNull()
      .references(() => users.id),
    // Body = text + entity ranges (mention/hashtag/link). JSONB vì là cấu trúc lồng, luôn đọc/ghi cùng post.
    bodyText: text().notNull(),
    bodyEntities: jsonb().$type<TextEntity[]>().notNull().default([]),
    // Thứ tự ảnh quan trọng → mảng id thay vì bảng nối, cho đơn giản.
    mediaIds: text().array().notNull().default(sql`'{}'::text[]`),
    commentCount: integer().notNull().default(0),
    shareCount: integer().notNull().default(0),
    createdAt: timestamp({ withTimezone: true }).notNull(),
  },
  (table) => [
    // Index phục vụ CURSOR PAGINATION: thứ tự ổn định (created_at DESC, id DESC).
    // "Các bài cũ hơn cursor" = range scan trên index này, nhanh bất kể đang ở trang thứ mấy
    // (OFFSET thì phải đọc rồi bỏ qua N dòng → càng về sau càng chậm).
    // nullsFirst: khớp đúng ORDER BY ... DESC mặc định của Postgres (DESC NULLS FIRST) để planner dùng được index.
    index('posts_feed_order_idx').on(table.createdAt.desc().nullsFirst(), table.id.desc().nullsFirst()),
  ],
);
// #endregion learn:posts-table-feed-index

export const media = pgTable(
  'media',
  {
    id: text().primaryKey(),
    src: text().notNull(),
    alt: text().notNull(),
    width: integer().notNull(),
    height: integer().notNull(),
    placeholderColor: text().notNull(),
    // Chỉ có với ảnh người dùng upload. Hệ thống thật lưu file ở object storage (S3/GCS) + CDN, DB chỉ giữ metadata.
    uploadBytes: bytea(),
    contentType: text(),
    // Ai upload ảnh này: chỉ chủ sở hữu mới được gắn ảnh vào bài của mình.
    uploadedBy: text().references(() => users.id),
  },
  (table) => [check('media_size_positive', sql`${table.width} > 0 AND ${table.height} > 0`)],
);

// 📖 Bài học lesson-05 – khoá chính (post_id, user_id) khiến PUT/DELETE reaction tự idempotent (docs/lessons/lesson-05.md)
// #region learn:reactions-table
// Mỗi người chỉ có 1 reaction trên 1 bài → khoá chính (post_id, user_id).
// PUT reaction = UPSERT, DELETE reaction = DELETE: tự nhiên idempotent.
export const reactions = pgTable(
  'reactions',
  {
    postId: text()
      .notNull()
      .references(() => posts.id, { onDelete: 'cascade' }),
    userId: text()
      .notNull()
      .references(() => users.id),
    reaction: text().$type<ReactionType>().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.postId, table.userId] }),
    check('reactions_reaction_valid', sql`${table.reaction} IN ('like', 'love', 'haha', 'wow', 'sad', 'angry')`),
  ],
);
// #endregion learn:reactions-table

// 📖 Bài học shared-foundations §8 – khoá chính (viewer_id, key) chặn hai request cùng key ghi song song (docs/lessons/shared-foundations.md)
// #region learn:idempotency-keys-table
// Lưu response của POST /api/posts theo (viewer, key). Khoá chính đảm bảo 2 request cùng key
// chạy song song cũng chỉ một request ghi được – request kia nhận lại kết quả đã lưu.
export const idempotencyKeys = pgTable(
  'idempotency_keys',
  {
    viewerId: text().notNull(),
    key: text().notNull(),
    status: integer().notNull(),
    // Hash nội dung request: cùng key nhưng khác nội dung → client dùng sai key → trả 422 thay vì trả bài cũ.
    requestHash: text().notNull(),
    response: jsonb().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.viewerId, table.key] })],
);
// #endregion learn:idempotency-keys-table

// 📖 Bài học lesson-09 – một dòng duy nhất giữ feed generation (docs/lessons/lesson-09.md)
// #region learn:feed-state-single-row
// Một dòng duy nhất giữ "feed generation" – tăng mỗi khi có bài mới chèn lên đầu feed.
export const feedState = pgTable('feed_state', { id: integer().primaryKey(), generation: integer().notNull() }, (table) => [
  check('feed_state_single_row', sql`${table.id} = 1`),
]);
// #endregion learn:feed-state-single-row

// Ai theo dõi ai. "Bạn bè" = theo dõi lẫn nhau. Dùng để tính relationshipToViewer và ưu tiên bạn bè trong danh sách reactor.
export const follows = pgTable(
  'follows',
  {
    followerId: text()
      .notNull()
      .references(() => users.id),
    followeeId: text()
      .notNull()
      .references(() => users.id),
  },
  (table) => [primaryKey({ columns: [table.followerId, table.followeeId] })],
);

// 📖 Bài học lesson-11 – bảng sự kiện telemetry và index theo (type, created_at) (docs/lessons/lesson-11.md)
// #region learn:telemetry-events-table
// Sự kiện telemetry (lesson 11): impression, dwell, web-vital. Production đẩy vào pipeline phân tích (Kafka, BigQuery...);
// ở đây lưu bảng để xem bằng Adminer và tính summary.
export const telemetryEvents = pgTable(
  'telemetry_events',
  {
    id: serial().primaryKey(),
    viewerId: text().notNull(),
    type: text().$type<'impression' | 'dwell' | 'web-vital'>().notNull(),
    postId: text(),
    name: text(),
    valueMs: doublePrecision(),
    createdAt: timestamp({ withTimezone: true }).notNull(),
  },
  (table) => [index('telemetry_events_type_created_idx').on(table.type, table.createdAt)],
);
// #endregion learn:telemetry-events-table
