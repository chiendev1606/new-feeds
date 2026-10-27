/**
 * FEED CŨ (stale): tab bị bỏ quên hàng giờ rồi người dùng quay lại → đừng âm thầm thay feed (bài họ đang đọc
 * biến mất) và cũng đừng để họ đọc dữ liệu quá cũ. Cách làm: chỉ HỎI – hiện "Feed đã cũ – Tải lại".
 *
 * Kiểm tra vào lúc người dùng quay lại (visibilitychange → visible, hoặc focus cửa sổ), không dùng setInterval:
 * tab ẩn thì trình duyệt giảm tốc timer, và không có lý do gì để kiểm tra khi không ai nhìn.
 * Demo dùng 30 giây; production thường là vài giờ (lastFetchedAt do store ghi khi nhận trang đầu).
 */
import { useCallback, useEffect, useRef, useState } from 'react';

export const DEFAULT_STALE_AFTER_MS = 30_000;

// 📖 Bài học lesson-09 §2 – hỏi người dùng thay vì tự đổi feed, kiểm tra khi họ quay lại (docs/lessons/lesson-09.md)
// #region learn:stale-feed-prompt
/** Hàm thuần: feed chưa từng tải thì không có gì để gọi là cũ. */
export function isFeedStale(lastFetchedAt: number | null, now: number, staleAfterMs: number): boolean {
  return lastFetchedAt !== null && now - lastFetchedAt > staleAfterMs;
}

export function useStaleFeedPrompt(lastFetchedAt: number | null, staleAfterMs: number) {
  const [isStale, setIsStale] = useState(false);
  const lastFetchedAtRef = useRef(lastFetchedAt);
  lastFetchedAtRef.current = lastFetchedAt;
  const staleAfterRef = useRef(staleAfterMs);
  staleAfterRef.current = staleAfterMs;

  // Vừa tải lại feed xong → hết cũ.
  useEffect(() => setIsStale(false), [lastFetchedAt]);

  useEffect(() => {
    const check = () => {
      if (document.visibilityState === 'hidden') return;
      setIsStale(isFeedStale(lastFetchedAtRef.current, Date.now(), staleAfterRef.current));
    };
    document.addEventListener('visibilitychange', check);
    window.addEventListener('focus', check);
    return () => {
      document.removeEventListener('visibilitychange', check);
      window.removeEventListener('focus', check);
    };
  }, []);

  const dismiss = useCallback(() => setIsStale(false), []);
  return { isStale, dismiss };
}
// #endregion learn:stale-feed-prompt
