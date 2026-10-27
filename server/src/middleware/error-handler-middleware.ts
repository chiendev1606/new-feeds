/** Chuẩn hoá mọi lỗi thành `{ error: { code, message } }` để client xử lý thống nhất. */
import type { ErrorRequestHandler } from 'express';
import { HttpError } from '../services/http-error.js';

// 📖 Bài học shared-foundations §2 – chuẩn hoá lỗi, không lộ chi tiết lỗi 500 cho client (docs/lessons/shared-foundations.md)
// #region learn:error-handler
export function createErrorHandlerMiddleware(): ErrorRequestHandler {
  return (error, _req, res, _next) => {
    if (error instanceof HttpError) {
      res.status(error.status).set(error.headers).json({ error: { code: error.code, message: error.message } });
      return;
    }
    // Lỗi parse JSON của express.json() / body quá lớn của express.raw() có sẵn status 4xx.
    const status = typeof error?.status === 'number' ? error.status : 500;
    if (status >= 500) {
      // Log chi tiết ở server, nhưng KHÔNG trả message nội bộ (stack, SQL...) cho client.
      console.error(error);
      res.status(status).json({ error: { code: 'INTERNAL_ERROR', message: 'Lỗi máy chủ' } });
      return;
    }
    res.status(status).json({ error: { code: status === 413 ? 'PAYLOAD_TOO_LARGE' : 'BAD_REQUEST', message: String(error?.message ?? 'Request không hợp lệ') } });
  };
}
// #endregion learn:error-handler
