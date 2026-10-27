/**
 * Lắp ráp Express app. Thứ tự middleware chính là "đường đi" của một request:
 *
 *   request-logger → fake-session → (với /api) latency/failure → JSON parser → routes → error-handler
 *
 * Tách khỏi server-entry để test có thể tạo app riêng và listen(0) trên cổng ngẫu nhiên.
 */
import express from 'express';
import type { AppContext } from './app-context.js';
import { createErrorHandlerMiddleware } from './middleware/error-handler-middleware.js';
import { createFakeSessionMiddleware } from './middleware/fake-session-middleware.js';
import { createRequestLoggerMiddleware } from './middleware/request-logger-middleware.js';
import { createSimulatedLatencyAndFailureMiddleware } from './middleware/simulated-latency-and-failure-middleware.js';
import { createFeedRoutes } from './routes/feed-routes.js';
import { createMediaServingRoutes, createMediaUploadRoutes } from './routes/media-routes.js';
import { createMockControlRoutes } from './routes/mock-control-routes.js';
import { createPostRoutes } from './routes/post-routes.js';
import { createReactionRoutes } from './routes/reaction-routes.js';
import { createSessionRoutes } from './routes/session-routes.js';
import { createTelemetryRoutes } from './routes/telemetry-routes.js';
import { createNewPostSimulator } from './services/new-post-simulator.js';

export interface CreateAppOptions {
  context: AppContext;
  logRequests?: boolean;
}

export function createApp(options: CreateAppOptions) {
  const { context } = options;
  const restartSimulator = createNewPostSimulator(context);
  restartSimulator();

  // 📖 Bài học shared-foundations §2 – thứ tự middleware chính là đường đi của một request (docs/lessons/shared-foundations.md)
  // #region learn:middleware-pipeline
  const app = express();
  app.disable('x-powered-by');
  app.use(createRequestLoggerMiddleware(options.logRequests ?? true));
  app.use(createFakeSessionMiddleware(context.repository, context.expiredSessions));

  // Điều khiển mô phỏng: không bị độ trễ/lỗi giả ảnh hưởng.
  app.use('/__mock', express.json(), createMockControlRoutes(context, restartSimulator));

  // Ảnh: không trễ (giả lập CDN nhanh).
  app.use(createMediaServingRoutes(context));

  // API chính.
  const api = express.Router();
  api.use(createSimulatedLatencyAndFailureMiddleware(context));
  api.use(createMediaUploadRoutes(context)); // đặt trước express.json vì nhận raw bytes
  api.use(createTelemetryRoutes(context)); // nhận cả text/plain từ sendBeacon
  api.use(express.json({ limit: '100kb' }));
  api.use(createFeedRoutes(context));
  api.use(createReactionRoutes(context));
  api.use(createPostRoutes(context));
  api.use(createSessionRoutes(context));
  api.use((_req, res) => {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Endpoint không tồn tại' } });
  });
  app.use('/api', api);

  app.use(createErrorHandlerMiddleware());
  // #endregion learn:middleware-pipeline

  return { app };
}
