/** Gọi /__mock/* – chỉ để điều khiển mô phỏng khi học. */
import type { SimulationConfig } from '../types/feed-entities';
import { request } from './http-client';

export const getSimulationConfig = () => request<SimulationConfig>('/__mock/config');

export const updateSimulationConfig = (patch: Partial<SimulationConfig>) =>
  request<SimulationConfig>('/__mock/config', { method: 'POST', body: patch, maxAttempts: 1 });

export const insertNewPosts = (count: number) =>
  request<{ insertedPostIds: string[]; generation: number }>(`/__mock/insert-new-posts?n=${count}`, { method: 'POST', maxAttempts: 1 });

export const resetDatabase = () => request<{ ok: true }>('/__mock/reset', { method: 'POST', maxAttempts: 1 });
