/**
 * Ảnh trong feed – các tối ưu theo bài:
 *   - srcset + sizes: trình duyệt tự chọn bề rộng phù hợp màn hình/DPR (server trả SVG theo ?w=).
 *     Production: CDN resize + AVIF/WebP (thường qua <picture>).
 *   - width/height + aspect-ratio: GIỮ CHỖ trước khi ảnh tải → không nhảy layout (CLS ≈ 0).
 *   - Màu placeholder (placeholderColor): thay cho LQIP/BlurHash, hiện trong lúc chờ ảnh.
 *   - loading="lazy": ảnh ngoài màn hình chưa tải. Ảnh đầu tiên (thường là LCP) thì tải ngay.
 *   - decoding="async": giải mã ảnh không chặn main thread.
 *   - alt bắt buộc (screen reader).
 */
import type { Media } from '../types/feed-entities';

const SRCSET_WIDTHS = [320, 640, 960, 1280];

export interface ResponsivePostImageProps {
  media: Media;
  /** Ảnh có khả năng là LCP (bài đầu tiên) → không lazy-load. */
  priority?: boolean;
  sizes?: string;
}

export function ResponsivePostImage({ media, priority = false, sizes = '(max-width: 680px) 100vw, 600px' }: ResponsivePostImageProps) {
  // Ảnh upload chỉ có một kích thước gốc; ảnh seed (giả lập CDN) có nhiều bề rộng qua ?w=.
  const sources = media.id.startsWith('upload-')
    ? { src: media.src }
    : { src: `${media.src}?w=640`, srcSet: SRCSET_WIDTHS.map((width) => `${media.src}?w=${width} ${width}w`).join(', '), sizes };
  return (
    <img
      className="post-image"
      {...sources}
      width={media.width}
      height={media.height}
      alt={media.alt}
      loading={priority ? 'eager' : 'lazy'}
      decoding="async"
      style={{ aspectRatio: `${media.width} / ${media.height}`, backgroundColor: media.placeholderColor }}
    />
  );
}

/** Lưới ảnh 1/2/3/4+; ảnh thứ 5 trở đi gộp thành "+N". */
export function PostMediaGrid({ media, priority }: { media: Media[]; priority?: boolean }) {
  if (media.length === 0) return null;
  const visible = media.slice(0, 4);
  const hiddenCount = media.length - visible.length;
  return (
    <div className={`post-media-grid post-media-grid--${visible.length}`}>
      {visible.map((item, index) => (
        <div key={item.id} className="post-media-grid__cell">
          <ResponsivePostImage media={item} priority={priority && index === 0} sizes={visible.length === 1 ? undefined : '(max-width: 680px) 50vw, 300px'} />
          {hiddenCount > 0 && index === visible.length - 1 && <span className="post-media-grid__more">+{hiddenCount}</span>}
        </div>
      ))}
    </div>
  );
}
