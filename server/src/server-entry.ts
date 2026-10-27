/**
 * Điểm khởi động backend: `npm run dev:server` (tsx watch tự restart khi sửa code).
 * Kết nối PostgreSQL → chạy migration + seed nếu DB trống → chạy Express.
 */
import { createAppContext } from './app-context.js';
import { createApp } from './create-express-app.js';
import { assertDatabaseReachable, createDatabase, createDatabasePool } from './data/database-pool.js';
import { ensureDatabaseReady } from './data/seed-database.js';

const PORT = Number(process.env.PORT ?? 3001);

const pool = createDatabasePool();
const db = createDatabase(pool);
let seeded: Awaited<ReturnType<typeof ensureDatabaseReady>>;
try {
  await assertDatabaseReachable(pool);
  seeded = await ensureDatabaseReady(db);
} catch (error) {
  console.error(`\n❌ ${(error as Error).message}\n`);
  process.exit(1);
}
const context = createAppContext(db);
const { app } = createApp({ context });

app.listen(PORT, async () => {
  console.log(`\n📰 News Feed API đang chạy tại http://localhost:${PORT}`);
  console.log(`   PostgreSQL: ${seeded ? `vừa seed ${seeded.posts} bài, ${seeded.users} người dùng` : `dùng dữ liệu có sẵn (${await context.repository.countPosts()} bài)`}`);
  console.log('   Adminer: http://localhost:8080 (server: postgres, user/pass/db: newsfeed)');
  console.log(`   Mô phỏng: latency=${context.simulation.latencyMs}ms, failRate=${context.simulation.failRate}`);
  console.log('   Thử: curl -i "http://localhost:3001/api/feed?count=3"\n');
});
