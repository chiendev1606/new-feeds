/**
 * /__mock/* – điều khiển mô phỏng (CHỈ để học, không có trong hệ thống thật).
 *   GET  /__mock/config
 *   POST /__mock/config               { latencyMs?, failRate?, autoNewPostsEverySec? }
 *   POST /__mock/insert-new-posts?n=3
 *   POST /__mock/reset                xoá sạch DB rồi seed lại (npm run db:backup trước nếu cần giữ dữ liệu)
 */
import { Router } from 'express';
import type { SimulationConfig } from '../../../shared-contracts/feed-api-contracts.js';
import type { AppContext } from '../app-context.js';
import { sanitizeSimulationConfig } from '../config/runtime-simulation-config.js';
import { resetDatabaseToSeed } from '../data/seed-database.js';

export function createMockControlRoutes(context: AppContext, onConfigChanged: () => void) {
  const router = Router();

  router.get('/config', (_req, res) => {
    res.json(context.simulation);
  });

  router.post('/config', (req, res) => {
    context.simulation = sanitizeSimulationConfig(context.simulation, (req.body ?? {}) as Partial<SimulationConfig>);
    onConfigChanged();
    console.log('⚙️  simulation config →', context.simulation);
    res.json(context.simulation);
  });

  router.post('/insert-new-posts', async (req, res) => {
    const count = Math.min(20, Math.max(1, Number(req.query.n ?? 3) || 3));
    const { posts, generation } = await context.repository.insertRandomNewPosts(count);
    console.log(`🆕 chèn ${posts.length} bài mới lên đầu feed (generation=${generation})`);
    res.json({ insertedPostIds: posts.map((post) => post.id), generation });
  });

  router.post('/reset', async (_req, res) => {
    const counts = await resetDatabaseToSeed(context.db);
    console.log('♻️  database reset về dữ liệu seed', counts);
    res.json({ ok: true });
  });

  return router;
}
