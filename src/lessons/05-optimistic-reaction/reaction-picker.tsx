/**
 * Nút reaction + bảng chọn 6 cảm xúc.
 *
 * A11y (theo bài):
 *   - Dùng <button> thật (bàn phím, screen reader hoạt động sẵn), aria-pressed thể hiện trạng thái.
 *   - Bảng chọn mở bằng hover HOẶC nút "Chọn cảm xúc" (focus/Enter) – không chỉ dựa vào hover.
 *   - Escape đóng bảng chọn và trả focus về nút.
 *   - Vùng bấm ≥ 32px (WCAG 2.2 AA tối thiểu 24px).
 */
import { Suspense, useId, useRef, useState } from 'react';
import { ChunkErrorBoundary } from '../../shared/lazy/chunk-error-boundary';
import { lazyWithPreload } from '../../shared/lazy/lazy-with-preload';
import type { EngagementSummary, ReactionType } from '../../shared/types/feed-entities';
import { REACTION_TYPES } from '../../shared/types/feed-entities';

export const REACTION_META: Record<ReactionType, { emoji: string; label: string }> = {
  like: { emoji: '👍', label: 'Thích' },
  love: { emoji: '❤️', label: 'Yêu thích' },
  haha: { emoji: '😆', label: 'Haha' },
  wow: { emoji: '😮', label: 'Wow' },
  sad: { emoji: '😢', label: 'Buồn' },
  angry: { emoji: '😡', label: 'Phẫn nộ' },
};

/**
 * Bảng 6 cảm xúc là chunk riêng (reaction-menu): chỉ tải khi sắp dùng tới.
 *
 * Menu mở ngay khi chuột vào CẢ THANH reaction (onMouseEnter của .reaction-bar), không phải khi vào nút ▾. Vì vậy
 * "sắp dùng" bắt đầu từ lúc con trỏ chạm thanh: ta preload ở onPointerEnter của THANH (pointerenter bắn trước mouseenter,
 * nên chunk bắt đầu tải trước khi menu kịp render). Nếu preload ở ▾ thì quá muộn – menu đã mở và React đã tự gọi import().
 * Preload CHỈ rút ngắn khoảng chờ chứ không xoá nó: lần hover đầu tiên mà chunk chưa về vẫn thấy khung giữ chỗ.
 * Muốn menu không bao giờ khựng thì prefetch lúc rảnh (lesson 10 có công tắc). Bàn phím: focus vào ▾ cũng preload.
 */
// 📖 Bài học lesson-05 §4 – bảng 6 cảm xúc là chunk riêng (docs/lessons/lesson-05.md)
// #region learn:lazy-reaction-menu
const LazyReactionMenu = lazyWithPreload(() => import('./reaction-menu'));
export const preloadReactionMenu = () => LazyReactionMenu.preload();
// #endregion learn:lazy-reaction-menu

/** Khung giữ chỗ cùng kích thước menu thật (6 nút 40px + gap + padding) → mở menu không làm layout nhảy. */
// 📖 Bài học lesson-05 §4 – khung giữ chỗ cùng id với menu thật (docs/lessons/lesson-05.md)
// #region learn:reaction-menu-placeholder
function ReactionMenuPlaceholder({ id }: { id: string }) {
  // Mang cùng id với menu thật để aria-controls của nút ▾ không bao giờ trỏ tới phần tử chưa tồn tại.
  return <div id={id} className="reaction-menu" aria-hidden="true" data-testid="reaction-menu-placeholder" style={{ inlineSize: 6 * 40 + 5 * 4 + 8 + 2, blockSize: 40 + 8 + 2 }} />;
}
// #endregion learn:reaction-menu-placeholder

export interface ReactionPickerProps {
  viewerReaction: ReactionType | null;
  summary: EngagementSummary;
  isPending: boolean;
  onReact: (reaction: ReactionType | null) => void;
  /** Format số đếm – lesson 07 truyền Intl compact formatter. */
  formatCount?: (value: number) => string;
}

export function ReactionPicker({ viewerReaction, summary, isPending, onReact, formatCount = String }: ReactionPickerProps) {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const toggleRef = useRef<HTMLButtonElement>(null);
  const current = viewerReaction ? REACTION_META[viewerReaction] : null;
  const topReactions = REACTION_TYPES.filter((type) => summary.reactionCounts[type] > 0)
    .sort((a, b) => summary.reactionCounts[b] - summary.reactionCounts[a])
    .slice(0, 3);

  const choose = (reaction: ReactionType | null) => {
    setOpen(false);
    onReact(reaction);
  };

  return (
    <div
      className="reaction-bar"
      onPointerEnter={preloadReactionMenu}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && open) {
          setOpen(false);
          toggleRef.current?.focus();
        }
      }}
    >
      <span className="reaction-bar__summary">
        <span aria-hidden="true">{topReactions.map((type) => REACTION_META[type].emoji).join('')}</span> <span aria-hidden="true">{formatCount(summary.totalReactions)}</span>
        {/* Screen reader đọc câu đầy đủ; số đổi thì nội dung đổi theo, KHÔNG dùng aria-live để tránh thông báo liên tục. */}
        <span className="visually-hidden">{summary.totalReactions} cảm xúc</span>
        {isPending && <span className="muted"> · đang lưu…</span>}
      </span>

      <div className="reaction-bar__actions">
        {/* 📖 Bài học lesson-05 §4 – button thật, aria-pressed, aria-expanded (docs/lessons/lesson-05.md) */}
        {/* #region learn:reaction-buttons-aria */}
        <button
          type="button"
          aria-pressed={viewerReaction !== null}
          className={viewerReaction ? 'reaction-button reaction-button--active' : 'reaction-button'}
          onClick={() => choose(viewerReaction ? null : 'like')}
        >
          <span aria-hidden="true">{current?.emoji ?? '👍'}</span> {current?.label ?? 'Thích'}
        </button>
        <button
          ref={toggleRef}
          type="button"
          className="reaction-button"
          aria-expanded={open}
          aria-controls={open ? menuId : undefined}
          aria-label="Chọn cảm xúc khác"
          onFocus={preloadReactionMenu}
          onClick={() => setOpen((value) => !value)}
        >
          ▾
        </button>
        {/* #endregion learn:reaction-buttons-aria */}
        {open && (
          <ChunkErrorBoundary name="reaction-menu">
            <Suspense fallback={<ReactionMenuPlaceholder id={menuId} />}>
              <LazyReactionMenu id={menuId} viewerReaction={viewerReaction} onChoose={choose} />
            </Suspense>
          </ChunkErrorBoundary>
        )}
      </div>
    </div>
  );
}
