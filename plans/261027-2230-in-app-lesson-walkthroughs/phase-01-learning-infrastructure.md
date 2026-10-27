---
phase: 1
title: "Hạ tầng: loader, renderer, tab, test kiểm tra doc"
status: completed
priority: P1
effort: "3h"
dependencies: []
---

# Phase 1: Hạ tầng học liệu

## Goal
Hiển thị được `docs/lessons/lesson-XX.md` trong app ở tab "Bài học", nhúng code thật theo marker, và có test chống bài học lệch khỏi code.

## Files
**Dependency:** `marked`, `mermaid`, `highlight.js`. Cả 3 chỉ được import động, không có import tĩnh nào.

**`src/shared/learn/`:**
- `source-region-extractor.ts`: các hàm thuần, có test.
  - `extractRegion(source, id)` trả `{ code, startLine, endLine }`. Bỏ dòng marker, bỏ thụt lề chung.
  - `listRegions(source)`: liệt kê các region, phát hiện region thiếu `#endregion` hoặc id trùng.
  - `parseLearnDirectives(markdown)` trả `[{ path, id }]`.
- `lesson-content-loader.ts`:
  - Doc: `import.meta.glob('/docs/lessons/*.md', { query: '?raw', import: 'default' })`.
  - Source: glob `?raw` lười cho `src/**/*.{ts,tsx,css}`, `server/src/**/*.ts`, `server/db/migrations/*.sql`, `shared-contracts/*.ts`, `public/sw.js`.
  - Loại file `*.test.ts`. Chỉ tải đúng file mà doc tham chiếu.
- `lesson-markdown-view.tsx`:
  - `marked` (import động) với renderer tuỳ biến cho code block `learn` và `mermaid`.
  - Phần còn lại render an toàn: không bật HTML thô; link ngoài có `rel="noopener noreferrer"`.
- `learn-code-block.tsx`: đoạn code thật (highlight.js core cho ts/tsx/sql/js/css, import động), header ghi `path:Lstart–Lend`, link GitHub `https://github.com/chiendev1606/new-feeds/blob/main/<path>#L<start>-L<end>`, và nút sao chép.
- `mermaid-diagram.tsx`: import động `mermaid`; theme theo `prefers-color-scheme`; render lỗi thì hiện mã nguồn sơ đồ.
- `lesson-learn-tab.tsx`: tải doc theo số lesson, có trạng thái loading/lỗi, mục lục (TOC) lấy từ các heading `##`.
- `lesson-docs.test.ts`:
  - Đọc các file `docs/lessons/*.md` thật bằng `fs`.
  - Mọi directive trỏ tới file và region có thật.
  - Đủ heading bắt buộc cho mỗi `## N.`.
  - Không có marker mồ côi; có allowlist tạm cho tới phase 4.
  - Không có region hỏng.
- `src/shared/learn/lesson-learn.css`.

**`src/shared/ui/lesson-layout.tsx`:**
- Thêm thanh tab "🧪 Demo / 📖 Bài học" (`role="tablist"`, phím mũi tên chuyển tab, `aria-selected`).
- Demo **giữ mount** (`hidden`) khi xem Bài học.
- Tab nhớ theo lesson trong `sessionStorage`.
- Prefetch chunk markdown và doc khi hover hoặc focus vào tab Bài học.

**Tài liệu:**
- `docs/lessons/README.md`: quy ước marker, directive, khung 7 phần, bảng "Marker có sẵn", cách thêm bài học.
- `docs/lessons/_template.md`: mẫu một khái niệm.

## Verification
- Unit test cho extractor và parser.
- Doc mẫu tạm có 1 directive, chạy trên dev, CDP thấy code thật và sơ đồ render được.
- Network khi chỉ xem tab Demo không có chunk `marked`, `mermaid` hay `highlight`.
- Bản production vẫn tách chunk.
