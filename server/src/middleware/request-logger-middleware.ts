/**
 * In mỗi request ra terminal – mở song song với trình duyệt để thấy
 * frontend gọi API khi nào, với cursor nào, có retry không, có idempotency key không.
 */
import type { RequestHandler } from 'express';
import { IDEMPOTENCY_KEY_HEADER } from '../../../shared-contracts/feed-api-contracts.js';

const COLORS = { reset: '\x1b[0m', dim: '\x1b[2m', green: '\x1b[32m', yellow: '\x1b[33m', red: '\x1b[31m', cyan: '\x1b[36m' };

function colorForStatus(status: number) {
  if (status >= 500) return COLORS.red;
  if (status >= 400) return COLORS.yellow;
  return COLORS.green;
}

/** Rút gọn cursor dài cho dễ đọc log. */
function shortenUrl(url: string) {
  return url.replace(/cursor=([^&]{12})[^&]*/, 'cursor=$1…');
}

export function createRequestLoggerMiddleware(enabled = true): RequestHandler {
  return (req, res, next) => {
    if (!enabled) return next();
    const startedAt = performance.now();
    res.on('finish', () => {
      const ms = Math.round(performance.now() - startedAt);
      const key = req.header(IDEMPOTENCY_KEY_HEADER);
      const replayed = res.getHeader('Idempotent-Replayed') ? ' (replayed)' : '';
      const keyInfo = key ? ` ${COLORS.cyan}key=${key.slice(0, 8)}…${replayed}${COLORS.reset}` : '';
      console.log(
        `${COLORS.dim}${new Date().toLocaleTimeString()}${COLORS.reset} ${req.method.padEnd(6)} ${shortenUrl(req.originalUrl)} ` +
          `${colorForStatus(res.statusCode)}${res.statusCode}${COLORS.reset} ${COLORS.dim}${ms}ms${COLORS.reset}${keyInfo}`,
      );
    });
    next();
  };
}
