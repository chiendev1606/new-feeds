---
type: handoff
date: 2026-10-27
---

# Handoff: tiếp tục plan học liệu (tab "Bài học")

## Trạng thái
- **Project:** học system design News Feed, gồm 12 lesson, backend Express + Postgres (Docker) + Drizzle. Repo: https://github.com/chiendev1606/new-feeds. Commit đã push là `dcad051`, chỉ chứa lesson 01–08; **mọi thay đổi sau đó (lesson 09–12, học liệu…) CHƯA commit**.
- **Plan lesson 09–12** (`plans/261027-1456-lessons-09-12-advanced-feed-topics/`): **completed**. Đã review và sửa hết, kiểm chứng trên Chrome bằng CDP; typecheck sạch, 213 test pass, bản production sạch.
- **Plan học liệu** (`plans/261027-2230-in-app-lesson-walkthroughs/`): đang làm.
  - **Phase 1 (hạ tầng): xong.**
    - `src/shared/learn/*`: loader, renderer markdown, khối code thật, Mermaid, tab Bài học, test kiểm tra doc.
    - `lesson-layout.tsx` có tab Demo/Bài học.
    - `vite.config.ts` có `optimizeDeps` cho marked/mermaid/highlight.
    - `docs/lessons/README.md`, `_template.md`, và bản nháp `lesson-02.md` (1 khái niệm).
  - **Phase 2 (marker file dùng chung + `docs/lessons/shared-foundations.md`): một agent đang chạy lúc 23:00.** Nếu phiên trước bị clear, kiểm tra lại:
    - `git status`;
    - `grep -rn "#region learn:" server src/shared shared-contracts public | wc -l`;
    - có file `docs/lessons/shared-foundations.md` hay chưa;
    - bảng "Marker có sẵn" trong `docs/lessons/README.md`.
  - **Phase 3:** chia 3 agent viết song song.
    - A: lesson 01–04. B: lesson 05–08. C: lesson 09–12.
    - Mỗi nhóm chỉ thêm marker trong `src/lessons/0X-*` của mình.
    - File dùng chung chỉ được tham chiếu, không sửa.
    - Đặc tả ở `phase-03-lesson-walkthroughs-parallel.md`.
  - **Phase 4:**
    - bật `STRICT_ORPHANS = true` trong `src/shared/learn/lesson-docs.test.ts`;
    - spawn reviewer nội dung;
    - chạy CDP cho cả 2 tab của 12 lesson;
    - cập nhật link trong `learning-guide.md` và README.

## Lưu ý khi chạy
- **Dev server:** `npm run dev` (Postgres + Adminer chạy bằng docker compose). Người dùng có thể đang dùng app: đừng `/__mock/reset`; nếu phải đổi `/__mock/config` thì lưu lại và khôi phục sau.
- **Script CDP** nằm trong scratchpad của phiên cũ. Thư viện tối giản `cdp-lib.mjs` mở Chrome headless qua `--remote-debugging-port`.
- **Lỗi của cách test, không phải lỗi code:**
  - `dispatchEvent('pointerenter')` không kích hoạt React → phải dùng `Input.dispatchMouseEvent`.
  - Điều hướng tới đúng hash đang mở thì trang không tải lại.
  - Giả lập offline của CDP không áp cho request do Service Worker tự gửi → phải giả lập offline cho cả target `service_worker`.
- **Hook `scout-block`** chặn lệnh bash có chữ "build" → dùng `npx vite build` trong lệnh riêng, hoặc tạo file bằng Write thay vì heredoc.
- **Quy ước:** trả lời bằng tiếng Việt; comment tiếng Việt; tên file kebab-case; commit chỉ khi người dùng yêu cầu.

## Lệnh để tiếp tục
`/ak:cook plans/261027-2230-in-app-lesson-walkthroughs/plan.md`, bắt đầu từ phase 2 nếu agent chưa xong, hoặc phase 3.
