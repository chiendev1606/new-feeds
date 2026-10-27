/**
 * Giả lập mạng chậm / server quá tải cho các route /api.
 * - Độ trễ: latencyMs ± 20% (jitter) → thấy skeleton, thấy optimistic update có ích thế nào.
 * - Lỗi: với xác suất failRate trả 503 + Retry-After → thấy client retry/rollback.
 */
import type { RequestHandler } from 'express';
import type { AppContext } from '../app-context.js';

export function createSimulatedLatencyAndFailureMiddleware(context: AppContext): RequestHandler {
  return async (_req, res, next) => {
    const { latencyMs, failRate } = context.simulation;
    if (latencyMs > 0) {
      const jitter = latencyMs * 0.2 * (Math.random() * 2 - 1);
      await new Promise((resolve) => setTimeout(resolve, Math.max(0, latencyMs + jitter)));
    }
    if (failRate > 0 && Math.random() < failRate) {
      res
        .status(503)
        .set('Retry-After', '1')
        .json({ error: { code: 'SIMULATED_FAILURE', message: 'Lỗi giả lập (failRate > 0)' } });
      return;
    }
    next();
  };
}
