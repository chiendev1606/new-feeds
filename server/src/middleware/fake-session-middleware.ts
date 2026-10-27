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

export function createFakeSessionMiddleware(repository: FeedRepository): RequestHandler {
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
    next();
  };
}
