/**
 * Nội dung hover card tác giả – CHUNK tải lười (chỉ cần khi người dùng dừng chuột/focus vào tên).
 * Dữ liệu (relationshipToViewer) đã có sẵn trong feed response → mở card KHÔNG cần thêm request,
 * chỉ cần tải code. Đây là lý do tách "code" khỏi "data": data đi cùng feed, code đi theo tương tác.
 */
import type { User } from '../../shared/types/feed-entities';

export interface AuthorHoverCardProps {
  id: string;
  author: User;
  /** Toạ độ viewport của nút tên tác giả – card được portal ra body nên định vị theo toạ độ này. */
  anchor: { top: number; left: number; bottom: number };
  onPointerEnter: () => void;
  onPointerLeave: () => void;
}

/** Kích thước cố định (cũng dùng cho placeholder) → card hiện ra không đẩy/nhảy layout. */
export const HOVER_CARD_SIZE = { inlineSize: 260, blockSize: 96 } as const;

function describeRelationship(author: User) {
  const relation = author.relationshipToViewer;
  if (!relation) return 'Chưa rõ quan hệ';
  if (relation.isSelf) return 'Đây là bạn';
  const parts = [relation.isFriend ? 'Bạn bè' : null, relation.isFollowing ? 'Đang theo dõi' : null].filter(Boolean);
  return parts.length > 0 ? parts.join(' · ') : 'Chưa kết nối';
}

export default function AuthorHoverCard({ id, author, anchor, onPointerEnter, onPointerLeave }: AuthorHoverCardProps) {
  // Lật lên trên nếu gần đáy màn hình.
  const flipUp = anchor.bottom + HOVER_CARD_SIZE.blockSize + 8 > window.innerHeight;
  const left = Math.max(8, Math.min(anchor.left, window.innerWidth - HOVER_CARD_SIZE.inlineSize - 8));
  return (
    <div
      id={id}
      role="tooltip"
      className="author-hover-card"
      data-testid="author-hover-card"
      style={{ ...HOVER_CARD_SIZE, left, top: flipUp ? anchor.top - HOVER_CARD_SIZE.blockSize - 4 : anchor.bottom + 4 }}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
    >
      <strong>
        {author.name}
        {author.isVerified && <span className="verified" aria-hidden="true">✔</span>}
      </strong>
      <span className="muted">@{author.handle}</span>
      <span className="author-hover-card__relation" data-testid="author-hover-card-relation">
        {describeRelationship(author)}
      </span>
    </div>
  );
}
