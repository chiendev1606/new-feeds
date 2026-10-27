/** Lỗi có status + code; error-handler-middleware chuyển thành JSON `{ error: { code, message } }`. */
// 📖 Bài học shared-foundations §2 – lỗi có status và code để error handler đổi thành JSON thống nhất (docs/lessons/shared-foundations.md)
// #region learn:http-error-class
export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly headers: Record<string, string> = {},
  ) {
    super(message);
  }
}
// #endregion learn:http-error-class
