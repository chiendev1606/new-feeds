/** `npm run db:reset` – xoá sạch dữ liệu rồi seed lại. Chạy `npm run db:backup` trước nếu muốn giữ dữ liệu. */
import { assertDatabaseReachable, createDatabase, createDatabasePool } from '../data/database-pool.js';
import { resetDatabaseToSeed, runMigrations } from '../data/seed-database.js';

const pool = createDatabasePool();
await assertDatabaseReachable(pool);
const db = createDatabase(pool);
await runMigrations(db); // DB mới thì tạo bảng trước
console.log('♻️  Đã reset database về dữ liệu seed:', await resetDatabaseToSeed(db));
await pool.end();
