/**
 * Tên tác giả + hover card tải lười. Dùng trong feed-post-article (lesson 07/08/10).
 *
 * Mở card: hover 300ms (tránh bật card khi chuột chỉ lướt qua) HOẶC focus bàn phím (không ai bị bỏ lại
 * chỉ vì không dùng chuột). Esc đóng. Rời chuột có độ trễ ngắn để di chuột vào chính card mà không bị tắt.
 * Chunk hover card được preload ngay lúc pointerenter/focus → trong 300ms chờ, mạng đã làm việc rồi.
 *
 * Tab stop: nút tên này thêm MỘT tab stop mỗi bài vào mọi feed dùng FeedPostArticle (07/08/09/11). Cố ý GIỮ lại – nếu
 * bỏ tab stop (tabIndex -1) thì người dùng bàn phím không bao giờ mở được card, đúng điều ở trên muốn tránh.
 *
 * Card render qua portal ra <body>: (1) không bị overflow của feed cắt, (2) không lọt vào tên accessible
 * của <h3> (aria-labelledby của bài trỏ vào heading chứa tên này).
 */
import { Suspense, useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChunkErrorBoundary } from '../../shared/lazy/chunk-error-boundary';
import { lazyWithPreload } from '../../shared/lazy/lazy-with-preload';
import type { User } from '../../shared/types/feed-entities';
import './lesson-10-lazy-loading.css';

const LazyAuthorHoverCard = lazyWithPreload(() => import('./author-hover-card'));
export const preloadAuthorHoverCard = () => LazyAuthorHoverCard.preload();

const OPEN_DELAY_MS = 300;
const CLOSE_DELAY_MS = 150;

interface Anchor {
  top: number;
  left: number;
  bottom: number;
}

export function AuthorName({ author }: { author: User | undefined }) {
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cardId = useId();
  const name = author?.name ?? 'Người dùng';

  const clearTimer = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
  };
  const openNow = useCallback(() => {
    clearTimer();
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect) setAnchor({ top: rect.top, left: rect.left, bottom: rect.bottom });
  }, []);
  const schedule = (action: () => void, delay: number) => {
    clearTimer();
    timerRef.current = setTimeout(action, delay);
  };
  const close = useCallback(() => {
    clearTimer();
    setAnchor(null);
  }, []);

  // Dọn timer khi unmount (virtualization gỡ bài khỏi DOM bất kỳ lúc nào).
  useEffect(() => clearTimer, []);

  // Card đang mở: Esc đóng, cuộn/resize đóng (toạ độ fixed sẽ lệch khỏi tên tác giả).
  const isOpen = anchor !== null;
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    document.addEventListener('keydown', onKeyDown);
    window.addEventListener('scroll', close, { capture: true, passive: true });
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('scroll', close, { capture: true });
      window.removeEventListener('resize', close);
    };
  }, [isOpen, close]);

  if (!author) return <>{name}</>;

  return (
    <>
      {/* 📖 Bài học lesson-10 §3 – preload khi pointerenter hoặc focus, mở card sau 300ms (docs/lessons/lesson-10.md) */}
      {/* #region learn:hover-card-trigger-preload */}
      <button
        ref={triggerRef}
        type="button"
        className="author-name"
        data-testid="author-name"
        aria-describedby={isOpen ? cardId : undefined}
        onPointerEnter={() => {
          void preloadAuthorHoverCard();
          schedule(openNow, OPEN_DELAY_MS);
        }}
        onPointerLeave={() => schedule(close, CLOSE_DELAY_MS)}
        onFocus={() => {
          void preloadAuthorHoverCard();
          openNow();
        }}
        onBlur={close}
        // Safari không focus <button> khi click chuột → click cũng phải mở được (openNow idempotent, không đóng).
        onClick={openNow}
      >
        {name}
      </button>
      {/* #endregion learn:hover-card-trigger-preload */}
      {/* 📖 Bài học lesson-10 §3 – hover card tải lười, render qua portal (docs/lessons/lesson-10.md) */}
      {/* #region learn:hover-card-lazy-portal */}
      {anchor &&
        createPortal(
          <ChunkErrorBoundary name="author-hover-card" fallback={null}>
            <Suspense fallback={<div className="author-hover-card author-hover-card--loading" aria-hidden="true" style={{ left: anchor.left, top: anchor.bottom + 4 }} />}>
              <LazyAuthorHoverCard id={cardId} author={author} anchor={anchor} onPointerEnter={clearTimer} onPointerLeave={() => schedule(close, CLOSE_DELAY_MS)} />
            </Suspense>
          </ChunkErrorBoundary>,
          document.body,
        )}
      {/* #endregion learn:hover-card-lazy-portal */}
    </>
  );
}
