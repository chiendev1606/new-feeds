/**
 * Sinh ảnh SVG cho media seed, kích thước theo `?w=` để minh hoạ srcset/responsive images:
 * client xin đúng bề rộng cần, CDN thật sẽ resize + đổi sang AVIF/WebP.
 */
import type { Media } from '../../../shared-contracts/feed-api-contracts.js';

const ALLOWED_WIDTHS = [320, 640, 960, 1280, 1600];

/** Làm tròn lên bề rộng được hỗ trợ – giống CDN chỉ cache vài kích thước cố định. */
export function snapRequestedWidth(raw: unknown, intrinsicWidth: number): number {
  const requested = Number(raw);
  if (!Number.isFinite(requested) || requested <= 0) return intrinsicWidth;
  return ALLOWED_WIDTHS.find((width) => width >= requested) ?? ALLOWED_WIDTHS[ALLOWED_WIDTHS.length - 1]!;
}

function escapeXml(value: string) {
  return value.replace(/[<>&"']/g, (char) => `&#${char.charCodeAt(0)};`);
}

export function renderMediaSvg(media: Media, requestedWidth: number): string {
  const width = requestedWidth;
  const height = Math.round((media.height / media.width) * width);
  const fontSize = Math.max(14, Math.round(width / 22));
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="100%" height="100%" fill="${media.placeholderColor}"/>
  <circle cx="${width * 0.78}" cy="${height * 0.28}" r="${Math.min(width, height) * 0.12}" fill="#ffffff" opacity="0.35"/>
  <path d="M0 ${height} L${width * 0.35} ${height * 0.45} L${width * 0.6} ${height * 0.75} L${width * 0.8} ${height * 0.55} L${width} ${height} Z" fill="#000000" opacity="0.25"/>
  <text x="50%" y="50%" text-anchor="middle" dominant-baseline="middle" font-family="system-ui, sans-serif" font-size="${fontSize}" fill="#ffffff">${escapeXml(media.alt)}</text>
  <text x="12" y="${height - 12}" font-family="monospace" font-size="${Math.max(11, fontSize * 0.6)}" fill="#ffffff" opacity="0.85">${width}×${height}</text>
</svg>`;
}
