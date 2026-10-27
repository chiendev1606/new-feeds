import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Test server dùng chung database `newsfeed_test` → chạy tuần tự từng file để không giẫm dữ liệu nhau.
    fileParallelism: false,
    env: { DATABASE_URL: 'postgres://newsfeed:newsfeed@localhost:5432/newsfeed_test' },
  },
});
