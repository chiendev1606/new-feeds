/** Tiện ích cho test cần PostgreSQL (database `newsfeed_test`, cần `npm run db:up`). */
import { afterAll, beforeAll, beforeEach } from 'vitest';
import type { Database, DatabasePool } from '../data/database-pool.js';
import { assertDatabaseReachable, createDatabase, createDatabasePool, TEST_DATABASE_URL } from '../data/database-pool.js';
import { FeedRepository } from '../data/feed-repository.js';
import { ensureDatabaseReady, resetDatabaseToSeed } from '../data/seed-database.js';

/** Gọi trong file test: mỗi test bắt đầu với dữ liệu seed sạch. */
export function useSeededTestDatabase() {
  const handle = { pool: null as unknown as DatabasePool, db: null as unknown as Database, repository: null as unknown as FeedRepository };
  beforeAll(async () => {
    handle.pool = createDatabasePool(process.env.DATABASE_URL ?? TEST_DATABASE_URL);
    await assertDatabaseReachable(handle.pool);
    handle.db = createDatabase(handle.pool);
    await ensureDatabaseReady(handle.db);
    handle.repository = new FeedRepository(handle.db);
  });
  beforeEach(async () => {
    await resetDatabaseToSeed(handle.db);
  });
  afterAll(async () => {
    await handle.pool?.end();
  });
  return handle;
}
