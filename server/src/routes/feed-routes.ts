/** GET /api/feed (cursor) và GET /api/feed-offset (chỉ để so sánh trong lesson 02). */
import { Router } from 'express';
import type { AppContext } from '../app-context.js';
import { getFeedPage } from '../services/feed-query-service.js';
import { HttpError } from '../services/http-error.js';
import { getFeedPageByOffset } from '../services/offset-feed-query-service.js';

export function createFeedRoutes(context: AppContext) {
  const router = Router();

  // Express 5: handler async ném lỗi → tự chuyển tới error-handler-middleware.
  router.get('/feed', async (req, res) => {
    const direction = req.query.direction ?? 'older';
    if (direction !== 'older' && direction !== 'newer') {
      throw new HttpError(400, 'INVALID_DIRECTION', 'direction phải là older hoặc newer');
    }
    const cursor = typeof req.query.cursor === 'string' && req.query.cursor ? req.query.cursor : null;
    const response = await getFeedPage(context.repository, {
      viewerId: req.viewerId,
      count: req.query.count === undefined ? undefined : Number(req.query.count),
      cursor,
      direction,
    });
    // Feed được cá nhân hoá (viewerReaction...) → chỉ được cache trong trình duyệt của chính người đó, không qua CDN/proxy.
    res.set('Cache-Control', 'private, no-store').json(response);
  });

  router.get('/feed-offset', async (req, res) => {
    const response = await getFeedPageByOffset(context.repository, req.viewerId, req.query.offset, req.query.count);
    res.set('Cache-Control', 'private, no-store').json(response);
  });

  return router;
}
