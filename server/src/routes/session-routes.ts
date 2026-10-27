/**
 * GET  /api/session/me       → { viewerId }: client cần biết mình là ai để tách dữ liệu lưu cục bộ theo tài khoản (outbox, cache).
 * POST /api/session/refresh  → cấp lại session đã hết hạn (giống đổi refresh token lấy access token mới).
 */
import { Router } from 'express';
import type { SessionInfo } from '../../../shared-contracts/feed-api-contracts.js';
import type { AppContext } from '../app-context.js';

export function createSessionRoutes(context: AppContext) {
  const router = Router();

  router.get('/session/me', (req, res) => {
    const body: SessionInfo = { viewerId: req.viewerId };
    res.set('Cache-Control', 'private, no-store').json(body);
  });

  // 📖 Bài học lesson-12 – làm mới session đã hết hạn (docs/lessons/lesson-12.md)
  // #region learn:session-refresh-route
  router.post('/session/refresh', (req, res) => {
    context.expiredSessions.delete(req.viewerId);
    console.log(`🔑 làm mới session cho ${req.viewerId}`);
    const body: SessionInfo = { viewerId: req.viewerId };
    res.json(body);
  });
  // #endregion learn:session-refresh-route

  return router;
}
