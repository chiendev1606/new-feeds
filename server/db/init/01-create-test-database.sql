-- Chạy một lần khi container Postgres khởi tạo volume mới.
-- Database riêng cho integration test để `npm run test` không xoá dữ liệu bạn đang xem ở dev.
CREATE DATABASE newsfeed_test OWNER newsfeed;
