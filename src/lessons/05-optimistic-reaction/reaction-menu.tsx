/**
 * Bảng chọn 6 cảm xúc – tách khỏi reaction-picker.tsx để thành MỘT CHUNK JS RIÊNG (lesson 10).
 *
 * Người dùng đa số chỉ bấm "Thích"; bảng 6 cảm xúc chỉ cần khi hover/bấm nút ▾ → không đưa vào bundle đầu.
 * reaction-picker.tsx tải file này bằng lazyWithPreload và preload khi pointerenter/focus nút ▾.
 */
import type { ReactionType } from '../../shared/types/feed-entities';
import { REACTION_TYPES } from '../../shared/types/feed-entities';
import { REACTION_META } from './reaction-picker';

export interface ReactionMenuProps {
  id: string;
  viewerReaction: ReactionType | null;
  /** null = bỏ reaction hiện tại (bấm lại đúng cảm xúc đang chọn). */
  onChoose: (reaction: ReactionType | null) => void;
}

export default function ReactionMenu({ id, viewerReaction, onChoose }: ReactionMenuProps) {
  // 📖 Bài học lesson-05 §4 – menu cảm xúc là group các button có nhãn (docs/lessons/lesson-05.md)
  // #region learn:reaction-menu-markup
  return (
    <div id={id} role="group" aria-label="Cảm xúc" className="reaction-menu" data-testid="reaction-menu">
      {REACTION_TYPES.map((type) => (
        <button
          key={type}
          type="button"
          className="reaction-menu__item"
          aria-label={REACTION_META[type].label}
          aria-pressed={viewerReaction === type}
          title={REACTION_META[type].label}
          onClick={() => onChoose(viewerReaction === type ? null : type)}
        >
          {REACTION_META[type].emoji}
        </button>
      ))}
    </div>
  // #endregion learn:reaction-menu-markup
  );
}
