/**
 * POST /api/telemetry          ← lô sự kiện (impression, dwell, web-vital) từ lesson 11.
 * GET  /api/telemetry/summary  → top bài theo lượt hiển thị + p75 của từng web vital.
 *
 * navigator.sendBeacon gửi body dạng text/plain (để không phải preflight CORS), nên server nhận cả JSON lẫn text.
 * Trả 204: beacon không đọc response, và client không cần chờ gì.
 * Demo: chưa có rate limit/xác thực riêng cho endpoint này (beacon cross-site không mang cookie nên rơi về viewer mặc định)
 * và /summary công khai. Production cần rate limit theo viewer/IP và quyền truy cập cho summary.
 */
import express, { Router } from 'express';
import type { TelemetryBatchRequest, TelemetryEvent } from '../../../shared-contracts/feed-api-contracts.js';
import type { AppContext } from '../app-context.js';
import { HttpError } from '../services/http-error.js';

const MAX_EVENTS_PER_BATCH = 200;
const WEB_VITAL_NAMES = new Set(['LCP', 'CLS', 'INP', 'long-task']);
const MAX_POST_ID_LENGTH = 100;
/** Một lượt xem không thể "dừng" quá 24h: cận trên chặn số khổng lồ làm lệch tổng dwell / p75. */
const MAX_DWELL_MS = 86_400_000;
const MAX_WEB_VITAL_VALUE = 1e7;

// 📖 Bài học lesson-11 – validate lô sự kiện: số hữu hạn, cận trên, độ dài postId (docs/lessons/lesson-11.md)
// #region learn:telemetry-validate-batch
/** Số hữu hạn trong [0, max]. JSON `1e309` được JSON.parse thành Infinity nên PHẢI kiểm Number.isFinite, `>= 0` thôi là chưa đủ. */
const isBoundedNumber = (value: unknown, max: number): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= max;
const isValidPostId = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= MAX_POST_ID_LENGTH;

function isValidEvent(raw: unknown): raw is TelemetryEvent {
  if (typeof raw !== 'object' || raw === null) return false;
  const event = raw as Record<string, unknown>;
  if (typeof event.at !== 'string' || Number.isNaN(Date.parse(event.at))) return false;
  switch (event.type) {
    case 'impression':
      return isValidPostId(event.postId);
    case 'dwell':
      return isValidPostId(event.postId) && isBoundedNumber(event.durationMs, MAX_DWELL_MS);
    case 'web-vital':
      return typeof event.name === 'string' && WEB_VITAL_NAMES.has(event.name) && isBoundedNumber(event.value, MAX_WEB_VITAL_VALUE);
    default:
      return false;
  }
}

function parseBatch(body: unknown): TelemetryBatchRequest {
  let parsed = body;
  if (typeof body === 'string') {
    try {
      parsed = JSON.parse(body);
    } catch {
      throw new HttpError(400, 'INVALID_TELEMETRY', 'Body không phải JSON');
    }
  }
  const events = (parsed as Partial<TelemetryBatchRequest> | null)?.events;
  if (!Array.isArray(events) || events.length === 0 || events.length > MAX_EVENTS_PER_BATCH) {
    throw new HttpError(400, 'INVALID_TELEMETRY', `events phải là mảng 1..${MAX_EVENTS_PER_BATCH} phần tử`);
  }
  if (!events.every(isValidEvent)) throw new HttpError(400, 'INVALID_TELEMETRY', 'Có sự kiện sai định dạng');
  return { events };
}
// #endregion learn:telemetry-validate-batch

export function createTelemetryRoutes(context: AppContext) {
  const router = Router();

  // 📖 Bài học lesson-11 – nhận cả text/plain của sendBeacon lẫn JSON và trả 204 (docs/lessons/lesson-11.md)
  // #region learn:telemetry-post-route
  router.post('/telemetry', express.text({ type: 'text/plain', limit: '64kb' }), express.json({ limit: '64kb' }), async (req, res) => {
    const { events } = parseBatch(req.body);
    await context.repository.insertTelemetryEvents(req.viewerId, events);
    const counts = events.reduce<Record<string, number>>((acc, event) => ({ ...acc, [event.type]: (acc[event.type] ?? 0) + 1 }), {});
    console.log(`📊 telemetry từ ${req.viewerId}: ${Object.entries(counts).map(([type, n]) => `${type}=${n}`).join(' ')}`);
    res.status(204).end();
  });
  // #endregion learn:telemetry-post-route

  router.get('/telemetry/summary', async (_req, res) => {
    res.set('Cache-Control', 'no-store').json(await context.repository.getTelemetrySummary());
  });

  return router;
}
