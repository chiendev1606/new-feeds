/** Trạng thái dùng chung của server, truyền vào routes thay vì dùng biến global (dễ test). */
import type { SimulationConfig } from '../../shared-contracts/feed-api-contracts.js';
import { DEFAULT_SIMULATION_CONFIG } from './config/runtime-simulation-config.js';
import type { Database } from './data/database-pool.js';
import { FeedRepository } from './data/feed-repository.js';

export interface AppContext {
  db: Database;
  repository: FeedRepository;
  simulation: SimulationConfig;
  /** Các viewer bị "hết hạn session" giả lập (lesson 12) → /api trả 401 cho tới khi gọi /api/session/refresh. */
  expiredSessions: Set<string>;
}

export function createAppContext(db: Database, overrides: Partial<SimulationConfig> = {}): AppContext {
  return {
    db,
    repository: new FeedRepository(db),
    simulation: { ...DEFAULT_SIMULATION_CONFIG, ...overrides },
    expiredSessions: new Set(),
  };
}
