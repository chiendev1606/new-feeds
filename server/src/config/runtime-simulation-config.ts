/**
 * Cấu hình mô phỏng mạng, đổi được lúc runtime qua POST /__mock/config.
 * Mặc định có chút độ trễ để thấy skeleton/optimistic update, không có lỗi.
 */
import type { SimulationConfig } from '../../../shared-contracts/feed-api-contracts.js';

export const DEFAULT_SIMULATION_CONFIG: SimulationConfig = {
  latencyMs: 400,
  failRate: 0,
  autoNewPostsEverySec: 0,
};

export function sanitizeSimulationConfig(current: SimulationConfig, patch: Partial<SimulationConfig>): SimulationConfig {
  const pickNumber = (value: unknown, fallback: number, min: number, max: number) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
  };
  return {
    latencyMs: pickNumber(patch.latencyMs, current.latencyMs, 0, 10_000),
    failRate: pickNumber(patch.failRate, current.failRate, 0, 1),
    autoNewPostsEverySec: pickNumber(patch.autoNewPostsEverySec, current.autoNewPostsEverySec, 0, 3600),
  };
}
