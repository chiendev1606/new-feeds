/**
 * "Xem thêm" cho bài dài.
 *   - Cắt bằng CSS line-clamp (không cắt chuỗi) → text đầy đủ vẫn có trong DOM cho Ctrl+F/screen reader.
 *   - dir="auto": trình duyệt tự xác định hướng chữ theo nội dung (bài tiếng Ả Rập trong feed tiếng Việt).
 */
import { useId, useState, type ReactNode } from 'react';

// 📖 Bài học lesson-07 – line-clamp bằng CSS, aria-expanded và dir=auto (docs/lessons/lesson-07.md)
// #region learn:expandable-post-text
const LONG_TEXT_THRESHOLD = 280;

export function ExpandablePostText({ text, children }: { text: string; children: ReactNode }) {
  const [expanded, setExpanded] = useState(false);
  const contentId = useId();
  const isLong = text.length > LONG_TEXT_THRESHOLD;

  return (
    <div className="post-text">
      <p id={contentId} dir="auto" className={isLong && !expanded ? 'post-card__text post-text--clamped' : 'post-card__text'}>
        {children}
      </p>
      {isLong && (
        <button type="button" className="link-button" aria-expanded={expanded} aria-controls={contentId} onClick={() => setExpanded((value) => !value)}>
          {expanded ? 'Thu gọn' : 'Xem thêm'}
        </button>
      )}
    </div>
  );
}
// #endregion learn:expandable-post-text
