/**
 * Nút reaction + bảng chọn 6 cảm xúc.
 *
 * A11y (theo bài):
 *   - Dùng <button> thật (bàn phím, screen reader hoạt động sẵn), aria-pressed thể hiện trạng thái.
 *   - Bảng chọn mở bằng hover HOẶC nút "Chọn cảm xúc" (focus/Enter) – không chỉ dựa vào hover.
 *   - Escape đóng bảng chọn và trả focus về nút.
 *   - Vùng bấm ≥ 32px (WCAG 2.2 AA tối thiểu 24px).
 */
import { useId, useRef, useState } from 'react';
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
          aria-controls={menuId}
          aria-label="Chọn cảm xúc khác"
          onClick={() => setOpen((value) => !value)}
        >
          ▾
        </button>
        {open && (
          <div id={menuId} role="group" aria-label="Cảm xúc" className="reaction-menu">
            {REACTION_TYPES.map((type) => (
              <button
                key={type}
                type="button"
                className="reaction-menu__item"
                aria-label={REACTION_META[type].label}
                aria-pressed={viewerReaction === type}
                title={REACTION_META[type].label}
                onClick={() => choose(viewerReaction === type ? null : type)}
              >
                {REACTION_META[type].emoji}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
