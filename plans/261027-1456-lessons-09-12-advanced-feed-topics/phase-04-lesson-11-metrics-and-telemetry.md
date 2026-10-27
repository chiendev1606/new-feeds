---
phase: 4
title: "Lesson 11: đo lường và telemetry"
status: completed
priority: P2
effort: "2.5h"
dependencies: [1]
---

# Phase 4: Lesson 11 — đo lường và telemetry

## Goal
Thấy được hiệu năng thật qua Core Web Vitals so với budget, và thấy telemetry đi từ trình duyệt tới DB. Thêm `Intl.ListFormat`.

## Files
**Đo web vitals:**
- `src/lessons/11-metrics-telemetry/web-vitals-observer.ts`: dùng `PerformanceObserver` với `buffered: true`.
  - **LCP:** entry cuối cùng trước tương tác đầu tiên.
  - **CLS:** session window (cửa sổ 5 giây, khoảng nghỉ 1 giây), bỏ qua các dịch chuyển có `hadRecentInput`.
  - **INP (gần đúng):** gom entry `event` theo `interactionId`, lấy tương tác chậm nhất (ghi rõ thư viện `web-vitals` lấy p98).
  - **Long task:** `longtask`.
  - Phân loại theo budget của bài: LCP ≤ 2.5s, INP ≤ 200ms, CLS ≤ 0.1 → good / needs-improvement / poor.
  - Phần phân loại tách thành hàm thuần, có test.

**Đếm lượt hiển thị:**
- `src/lessons/11-metrics-telemetry/impression-tracker.ts`, class `ImpressionTracker`:
  - IntersectionObserver với `threshold: 0.5`.
  - Bài phải hiện liên tục 1 giây mới tính 1 lượt hiển thị; mỗi bài chỉ tính một lần trong mỗi phiên.
  - Tính dwell time (tổng thời gian hiển thị).
  - Hàng đợi gửi theo lô: mỗi 5 giây hoặc khi đủ 20 sự kiện. Khi `visibilitychange` sang hidden hoặc `pagehide` thì gửi bằng `navigator.sendBeacon('/api/telemetry', blob)`.
  - Phần đếm giờ nhận clock và observer qua tham số, để test được bằng fake timer.
- `impression-tracker.test.ts`:
  - Hiện dưới 1 giây thì không tính.
  - Không đếm trùng.
  - Đủ kích thước lô thì gửi.
  - Khi hidden thì gửi bằng beacon.

**Hook nối vào UI:**
- `src/lessons/11-metrics-telemetry/use-impression-tracking.ts`: hook trả về `trackRef(postId)`.

**`Intl.ListFormat`:**
- `src/shared/post-rendering/format-reactor-list.ts`: `formatReactorList(names, total, locale)` dùng `Intl.ListFormat` (`type: 'conjunction'`), cache formatter giống `format-compact-count`.
  - Ví dụ kết quả: "An, Bình và 3 người khác" hoặc "An, Bình, and 3 others".
- `src/shared/post-rendering/feed-post-article.tsx`: chỉ thêm 1 dòng hiện danh sách reactor dưới thanh reaction, nếu có `sampleReactorIds`.
- Có test cho vi/en.

**Trang lesson:**
- `src/lessons/11-metrics-telemetry/lesson-11-metrics-telemetry.tsx`:
  - Feed có gắn tracking (viền xanh khi bài đã được tính lượt hiển thị).
  - Panel Web Vitals hiện giá trị và màu theo budget.
  - Panel "Lô telemetry" hiện các lô đã gửi, phương thức (fetch hoặc beacon) và kích thước.
  - Panel "Server summary" đọc `GET /api/telemetry/summary` mỗi 5 giây.
  - Nút "Làm chậm main thread 300ms" để tạo một long task và INP xấu, nhằm minh hoạ.

## Verification
- Unit test: tracker, phân loại vital, list format.
- CDP:
  - Cuộn qua 5 bài, chuyển tab sang hidden (`Page.setWebLifecycleState` với `frozen`, hoặc đóng target): terminal có dòng `📊`, và DB `telemetry_events` có hơn 0 dòng `impression`.
  - Panel hiện giá trị LCP.
  - Bấm "Làm chậm" thì INP lớn hơn 300ms.
