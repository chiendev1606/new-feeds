/**
 * Chạy migration + nạp dữ liệu seed tất định vào PostgreSQL.
 *
 * - ensureDatabaseReady(): gọi khi server khởi động. Áp các migration chưa chạy (server/db/migrations,
 *   do `npm run db:generate` sinh từ database-schema.ts); seed nếu DB trống.
 *   Restart server KHÔNG xoá dữ liệu (reaction, bài bạn đăng vẫn còn).
 * - resetDatabaseToSeed(): xoá sạch rồi seed lại (POST /__mock/reset, npm run db:reset).
 *   Chạy `npm run db:backup` trước nếu muốn giữ dữ liệu hiện tại.
 */
import { fileURLToPath } from 'node:url';
import { sql } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import type { Database, DatabaseTransaction } from './database-pool.js';
import { feedState, follows, idempotencyKeys, media, posts, reactions, telemetryEvents, users } from './database-schema.js';
import { postToRow } from './feed-repository.js';
import { generateSeedData } from './seed-data-generator.js';

const MIGRATIONS_FOLDER = fileURLToPath(new URL('../../db/migrations', import.meta.url));

async function insertSeedRows(tx: DatabaseTransaction) {
  const seed = generateSeedData();
  const reactionRows = [...seed.reactions].flatMap(([postId, byUser]) => [...byUser].map(([userId, reaction]) => ({ postId, userId, reaction })));
  // Mỗi bảng 1 câu INSERT nhiều dòng → 1 round-trip thay vì hàng nghìn INSERT.
  await tx.insert(users).values(seed.users);
  await tx.insert(media).values(seed.media);
  await tx.insert(posts).values(seed.posts.map(postToRow));
  await tx.insert(reactions).values(reactionRows);
  await tx.insert(feedState).values({ id: 1, generation: 1 });
  // user-1 (người xem mặc định) theo dõi user-2..user-11; user-2..user-6 theo dõi lại → 5 người là "bạn bè".
  const followRows = [
    ...Array.from({ length: 10 }, (_, index) => ({ followerId: 'user-1', followeeId: `user-${index + 2}` })),
    ...Array.from({ length: 5 }, (_, index) => ({ followerId: `user-${index + 2}`, followeeId: 'user-1' })),
  ];
  await tx.insert(follows).values(followRows);
  return { users: seed.users.length, posts: seed.posts.length, media: seed.media.length, reactions: reactionRows.length, follows: followRows.length };
}

// 📖 Bài học shared-foundations §7 – TRUNCATE rồi seed lại trong một transaction (docs/lessons/shared-foundations.md)
// #region learn:reset-and-seed
/** Xoá sạch dữ liệu rồi seed lại. */
export function resetDatabaseToSeed(db: Database) {
  return db.transaction(async (tx) => {
    await tx.execute(sql`TRUNCATE ${reactions}, ${follows}, ${telemetryEvents}, ${idempotencyKeys}, ${posts}, ${media}, ${users}, ${feedState}`);
    return insertSeedRows(tx);
  });
}
// #endregion learn:reset-and-seed

// 📖 Bài học shared-foundations §7 – áp migration chưa chạy và phát hiện DB cũ không có lịch sử migration (docs/lessons/shared-foundations.md)
// #region learn:run-migrations
/**
 * Áp các migration chưa chạy. DB tạo bằng schema.sql cũ (trước khi dùng Drizzle) có sẵn bảng nhưng không có
 * bảng lịch sử migration → migrate() sẽ lỗi "already exists"; báo hướng dẫn rõ ràng thay vì để crash.
 */
export async function runMigrations(db: Database) {
  const { rows } = await db.execute<{ hasTables: boolean; hasHistory: boolean }>(
    sql`SELECT to_regclass('public.users') IS NOT NULL AS "hasTables", to_regclass('drizzle.__drizzle_migrations') IS NOT NULL AS "hasHistory"`,
  );
  if (rows[0]?.hasTables && !rows[0].hasHistory) {
    throw new Error(
      'Database được tạo bằng schema cũ (trước Drizzle). Chạy "npm run db:backup", rồi "npm run db:recreate" để xoá và tạo lại schema (xem README, mục Nâng cấp).',
    );
  }
  await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
}
// #endregion learn:run-migrations

/** Trả về null nếu DB đã có dữ liệu (không đụng vào), ngược lại trả về số dòng vừa seed. */
export async function ensureDatabaseReady(db: Database) {
  await runMigrations(db);
  if ((await db.$count(users)) > 0) return null;
  return resetDatabaseToSeed(db);
}
