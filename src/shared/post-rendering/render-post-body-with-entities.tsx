/**
 * Render body bài viết từ { text, entities } – AN TOÀN theo mặc định.
 *
 * Không bao giờ dùng dangerouslySetInnerHTML với nội dung người dùng:
 *   text được cắt thành các đoạn, mỗi đoạn là string thường hoặc phần tử React → React tự escape.
 * Link: chỉ cho phép http/https/mailto (chặn "javascript:alert(1)"), mở tab mới với rel="noopener noreferrer".
 *
 * Offset của entity là UTF-16 (giống String.prototype.slice) → emoji như "☕" chiếm 1–2 đơn vị;
 * server và client PHẢI dùng chung quy ước này, nếu lệch mention sẽ bị cắt sai chỗ.
 */
import type { ReactNode } from 'react';
import type { PostBody, TextEntity, User } from '../types/feed-entities';

// 📖 Bài học lesson-06 – chỉ cho phép http, https, mailto để chặn javascript: (docs/lessons/lesson-06.md)
// #region learn:safe-href
const SAFE_PROTOCOLS = new Set(['http:', 'https:', 'mailto:']);

export function toSafeHref(url: string): string | null {
  try {
    const parsed = new URL(url);
    return SAFE_PROTOCOLS.has(parsed.protocol) ? parsed.href : null;
  } catch {
    return null;
  }
}
// #endregion learn:safe-href

// 📖 Bài học lesson-06 – cắt text theo entity ranges, entity sai thì bỏ qua (docs/lessons/lesson-06.md)
// #region learn:split-text-by-entities
export type BodySegment = { kind: 'text'; text: string } | { kind: 'entity'; text: string; entity: TextEntity };

/** Cắt text thành các đoạn theo entity ranges. Entity sai (chồng lấn/vượt biên) bị bỏ qua, phần text vẫn hiện. */
export function splitTextByEntities(text: string, entities: readonly TextEntity[]): BodySegment[] {
  const segments: BodySegment[] = [];
  let cursor = 0;
  for (const entity of [...entities].sort((a, b) => a.start - b.start)) {
    if (entity.start < cursor || entity.end > text.length || entity.end <= entity.start) continue;
    if (entity.start > cursor) segments.push({ kind: 'text', text: text.slice(cursor, entity.start) });
    segments.push({ kind: 'entity', text: text.slice(entity.start, entity.end), entity });
    cursor = entity.end;
  }
  if (cursor < text.length) segments.push({ kind: 'text', text: text.slice(cursor) });
  return segments;
}
// #endregion learn:split-text-by-entities

// 📖 Bài học lesson-06 – mỗi entity thành phần tử React, React tự escape (docs/lessons/lesson-06.md)
// #region learn:render-entity
function renderEntity(segment: Extract<BodySegment, { kind: 'entity' }>, usersById: Record<string, User>, key: number): ReactNode {
  const { entity, text } = segment;
  switch (entity.type) {
    case 'mention': {
      const user = usersById[entity.userId];
      return (
        <a key={key} className="entity entity--mention" href={`#/user/${encodeURIComponent(entity.userId)}`} title={user ? `@${user.handle}` : undefined} onClick={(event) => event.preventDefault()}>
          {text}
        </a>
      );
    }
    case 'hashtag':
      return (
        <a key={key} className="entity entity--hashtag" href={`#/hashtag/${encodeURIComponent(entity.tag)}`} onClick={(event) => event.preventDefault()}>
          {text}
        </a>
      );
    case 'link': {
      const href = toSafeHref(entity.url);
      if (!href) return <span key={key}>{text}</span>;
      return (
        <a key={key} className="entity entity--link" href={href} target="_blank" rel="noopener noreferrer">
          {text}
        </a>
      );
    }
    default:
      // Loại entity client chưa biết (server mới hơn client) → vẫn hiện chữ, không làm mất nội dung.
      return <span key={key}>{text}</span>;
  }
}
// #endregion learn:render-entity

// 📖 Bài học lesson-06 – ghép các đoạn thành nội dung bài mà không dùng innerHTML (docs/lessons/lesson-06.md)
// #region learn:post-body-text
export function PostBodyText({ body, usersById }: { body: PostBody; usersById: Record<string, User> }) {
  return (
    <>
      {splitTextByEntities(body.text, body.entities).map((segment, index) =>
        segment.kind === 'text' ? <span key={index}>{segment.text}</span> : renderEntity(segment, usersById, index),
      )}
    </>
  );
}
// #endregion learn:post-body-text
