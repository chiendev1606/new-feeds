/**
 * Kết nối PostgreSQL (container trong docker-compose.yml) qua Drizzle ORM.
 * DATABASE_URL cho phép đổi DB; integration test dùng database riêng `newsfeed_test`.
 */
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './database-schema.js';

const DEFAULT_DATABASE_URL = 'postgres://newsfeed:newsfeed@localhost:5432/newsfeed';
export const TEST_DATABASE_URL = 'postgres://newsfeed:newsfeed@localhost:5432/newsfeed_test';

// 📖 Bài học shared-foundations §7 – kiểu QueryExecutor dùng chung cho db và transaction, casing snake_case (docs/lessons/shared-foundations.md)
// #region learn:drizzle-setup
export type DatabasePool = pg.Pool;
export type Database = NodePgDatabase<typeof schema>;
export type DatabaseTransaction = Parameters<Parameters<Database['transaction']>[0]>[0];
/** Database hoặc transaction đang mở – cả hai dùng chung API query của Drizzle. */
export type QueryExecutor = Database | DatabaseTransaction;

export function createDatabasePool(connectionString = process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL): DatabasePool {
  return new pg.Pool({ connectionString, max: 10 });
}

/** casing 'snake_case': cột `avatarColor` trong TypeScript ↔ `avatar_color` trong DB. */
export function createDatabase(pool: DatabasePool): Database {
  return drizzle({ client: pool, schema, casing: 'snake_case' });
}
// #endregion learn:drizzle-setup

export async function assertDatabaseReachable(pool: DatabasePool) {
  try {
    await pool.query('SELECT 1');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Không kết nối được PostgreSQL (${message}). Chạy "npm run db:up" (cần Docker) rồi thử lại.`);
  }
}
