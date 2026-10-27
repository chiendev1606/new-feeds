/** Gọi /__mock/* – chỉ để điều khiển mô phỏng khi học. */
import type { SimulationConfig } from '../types/feed-entities';
import { request } from './http-client';

export const getSimulationConfig = () => request<SimulationConfig>('/__mock/config');

export const updateSimulationConfig = (patch: Partial<SimulationConfig>) =>
  request<SimulationConfig>('/__mock/config', { method: 'POST', body: patch, maxAttempts: 1 });

export const insertNewPosts = (count: number) =>
  request<{ insertedPostIds: string[]; generation: number }>(`/__mock/insert-new-posts?n=${count}`, { method: 'POST', maxAttempts: 1 });

export const resetDatabase = () => request<{ ok: true }>('/__mock/reset', { method: 'POST', maxAttempts: 1 });

/** Lesson 12: session của viewer hiện tại hết hạn → /api trả 401 cho tới khi làm mới. */
export const expireSession = () => request<{ ok: true; viewerId: string }>('/__mock/expire-session', { method: 'POST', maxAttempts: 1 });

/** Lesson 12: giả lập tác giả xoá bài ở server. */
export const deletePostOnServer = (postId: string) =>
  request<{ deleted: boolean }>(`/__mock/delete-post/${encodeURIComponent(postId)}`, { method: 'POST', maxAttempts: 1 });
