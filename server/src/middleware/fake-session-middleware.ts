/**
 * "Session" giả: viewer được xác định từ cookie `sid` (mặc định user-1).
 *
 * Điểm thiết kế quan trọng trong bài: danh tính lấy từ session/auth token phía server,
 * KHÔNG BAO GIỜ tin `userId` do client gửi trong query/body.
 *
 * ⚠️ Đơn giản hoá cho demo: ở đây `sid` chính là userId, nên ai sửa cookie cũng đổi được danh tính.
 * Hệ thống thật: sid là token ngẫu nhiên khó đoán, server tra bảng sessions → userId (hoặc JWT có chữ ký),
 * cookie HttpOnly + Secure + SameSite. Tối thiểu, ta vẫn từ chối sid không ứng với user có thật.
 */
import type { RequestHandler } from 'express';
import type { FeedRepository } from '../data/feed-repository.js';
import { HttpError } from '../services/http-error.js';

/** Endpoint làm mới session – phải gọi được cả khi session đã hết hạn. */
const REFRESH_PATH = '/api/session/refresh';

const DEFAULT_VIEWER_ID = 'user-1';

declare module 'express-serve-static-core' {
  interface Request {
    viewerId: string;
  }
}

function readCookie(header: string | undefined, name: string): string | undefined {
  return header
    ?.split(';')
    .map((part) => part.trim().split('='))
    .find(([key]) => key === name)?.[1];
}

// 📖 Bài học lesson-12 – danh tính lấy từ cookie phía server và giả lập session hết hạn trả 401 (docs/lessons/lesson-12.md)
// #region learn:session-middleware
export function createFakeSessionMiddleware(repository: FeedRepository, expiredSessions: ReadonlySet<string>): RequestHandler {
  const knownUsers = new Set<string>();
  return async (req, res, next) => {
    const sid = readCookie(req.headers.cookie, 'sid');
    if (sid && !knownUsers.has(sid)) {
      const [user] = await repository.getUsersByIds([sid]);
      if (user) knownUsers.add(sid);
    }
    if (!sid || !knownUsers.has(sid)) {
      // Session không hợp lệ → cấp session mặc định thay vì tin giá trị client gửi.
      res.cookie('sid', DEFAULT_VIEWER_ID, { httpOnly: true, sameSite: 'lax' });
      req.viewerId = DEFAULT_VIEWER_ID;
    } else {
      req.viewerId = sid;
    }
    // Từng bước: (1) viewerId đã được xác định ở trên; (2) viewer nằm trong tập hết hạn giả lập thì chặn mọi /api bằng 401;
    // (3) riêng /api/session/refresh được đi qua để client làm mới phiên.
    // Session hết hạn (lesson 12): mọi /api trả 401 → client làm mới session một lần rồi gửi lại request.
    if (expiredSessions.has(req.viewerId) && req.path.startsWith('/api/') && req.path !== REFRESH_PATH) {
      next(new HttpError(401, 'SESSION_EXPIRED', 'Phiên đăng nhập đã hết hạn'));
      return;
    }
    next();
  };
}
// #endregion learn:session-middleware
