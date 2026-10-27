/** Cấu hình drizzle-kit: `npm run db:generate` sinh migration SQL từ server/src/data/database-schema.ts. */
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'postgresql',
  schema: './server/src/data/database-schema.ts',
  out: './server/db/migrations',
  casing: 'snake_case',
  dbCredentials: { url: process.env.DATABASE_URL ?? 'postgres://newsfeed:newsfeed@localhost:5432/newsfeed' },
});
