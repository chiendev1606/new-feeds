/**
 * POST /api/media/uploads – upload ảnh TRƯỚC, nhận mediaId, rồi mới POST /api/posts với mediaIds.
 *   Lý do tách 2 bước: upload lâu & có thể lỗi riêng; bài viết chỉ tạo khi mọi ảnh đã sẵn sàng.
 *   Production thường trả presigned URL để client upload thẳng lên object storage (S3/GCS);
 *   ở đây lưu bytes trong cột BYTEA cho đơn giản.
 *   Client gửi kèm kích thước ảnh qua header để server lưu width/height → client giữ chỗ đúng tỉ lệ (tránh CLS).
 *
 * GET /media/:id – ảnh upload trả bytes gốc; ảnh seed trả SVG theo ?w=.
 */
import express, { Router } from 'express';
import type { MediaUploadResponse } from '../../../shared-contracts/feed-api-contracts.js';
import type { AppContext } from '../app-context.js';
import { FeedRepository } from '../data/feed-repository.js';
import { createMediaRecord } from '../data/seed-data-generator.js';
import { HttpError } from '../services/http-error.js';
import { renderMediaSvg, snapRequestedWidth } from '../services/media-svg-renderer.js';

const ALLOWED_UPLOAD_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

function readPositiveIntHeader(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 && parsed <= 20_000 ? parsed : fallback;
}

function readAltHeader(value: string | undefined) {
  if (!value) return '';
  try {
    return decodeURIComponent(value).slice(0, 300);
  } catch {
    throw new HttpError(400, 'INVALID_ALT', 'Header X-Image-Alt phải được encodeURIComponent');
  }
}

export function createMediaUploadRoutes(context: AppContext) {
  const router = Router();

  // 📖 Bài học lesson-06 – upload ảnh trước, kiểm tra type, lưu chủ sở hữu (docs/lessons/lesson-06.md)
  // #region learn:media-upload
  router.post('/media/uploads', express.raw({ type: () => true, limit: MAX_UPLOAD_BYTES }), async (req, res) => {
    const contentType = (req.header('content-type') ?? '').split(';')[0]!.trim();
    // Kiểm tra type ở server. Hệ thống thật còn phải: đọc magic bytes, re-encode, strip EXIF, quét malware.
    if (!ALLOWED_UPLOAD_TYPES.includes(contentType)) {
      throw new HttpError(415, 'UNSUPPORTED_MEDIA_TYPE', `Chỉ nhận: ${ALLOWED_UPLOAD_TYPES.join(', ')}`);
    }
    const bytes = req.body as Buffer;
    if (!Buffer.isBuffer(bytes) || bytes.length === 0) throw new HttpError(400, 'EMPTY_UPLOAD', 'File rỗng');

    const mediaId = FeedRepository.newId('upload');
    const width = readPositiveIntHeader(req.header('X-Image-Width'), 1200);
    const height = readPositiveIntHeader(req.header('X-Image-Height'), 800);
    const alt = readAltHeader(req.header('X-Image-Alt')) || 'Ảnh do người dùng tải lên';
    const media = createMediaRecord(mediaId, width, height, alt, '#888888');

    await context.repository.insertUploadedMedia(media, bytes, contentType, req.viewerId);
    const response: MediaUploadResponse = { mediaId, media };
    res.status(201).json(response);
  });
  // #endregion learn:media-upload

  return router;
}

export function createMediaServingRoutes(context: AppContext) {
  const router = Router();

  // 📖 Bài học lesson-07 – phục vụ ảnh với nosniff, CSP sandbox và cache theo loại ảnh (docs/lessons/lesson-07.md)
  // #region learn:media-serve-nosniff
  router.get('/media/:mediaId', async (req, res) => {
    const found = await context.repository.getMediaForServing(req.params.mediaId);
    if (!found) throw new HttpError(404, 'MEDIA_NOT_FOUND', 'Không tìm thấy ảnh');

    // nosniff: trình duyệt phải tin Content-Type, không "đoán" file thành HTML/script.
    // CSP sandbox: kể cả mở trực tiếp file, nó cũng không chạy được script.
    res.set('X-Content-Type-Options', 'nosniff').set('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; sandbox");

    if (found.upload) {
      res.set('Content-Type', found.upload.contentType).set('Cache-Control', 'private, max-age=3600').send(found.upload.bytes);
      return;
    }
    const width = snapRequestedWidth(req.query.w, found.media.width);
    // Ảnh không đổi theo id+width → cache lâu (giống CDN với URL có version).
    res.set('Content-Type', 'image/svg+xml').set('Cache-Control', 'public, max-age=31536000, immutable').send(renderMediaSvg(found.media, width));
  });
  // #endregion learn:media-serve-nosniff

  return router;
}
