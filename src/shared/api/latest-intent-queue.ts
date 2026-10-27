/**
 * Hàng đợi "ý định mới nhất" theo khoá – dùng để GỬI TUẦN TỰ các thao tác ghi lên cùng một tài nguyên.
 *
 * Mỗi khoá (vd postId) chỉ có tối đa 1 lần chạy đang bay. Gửi thêm trong lúc đang bay thì chỉ GHI ĐÈ
 * ý định đang chờ; xong lần hiện tại mới chạy ý định mới nhất. Nhờ đó server nhận các lần ghi đúng thứ tự,
 * và các ý định trung gian (bấm 5 lần liên tiếp) được gộp lại.
 *
 * `run` không nên throw – nơi gọi tự xử lý lỗi bên trong. Nếu có throw, hàng đợi của khoá vẫn được giải phóng.
 */
// 📖 Bài học lesson-05 – mỗi khoá chỉ một lần chạy, ý định mới đè ý định chờ (docs/lessons/lesson-05.md)
// #region learn:latest-intent-queue
export class LatestIntentQueue<T> {
  private readonly pendingByKey = new Map<string, { intent: T | null }>();

  /** Trả về false nếu ý định chỉ được xếp hàng (đang có lần chạy khác cho cùng khoá). */
  async submit(key: string, intent: T, run: (intent: T) => Promise<void>): Promise<boolean> {
    const existing = this.pendingByKey.get(key);
    if (existing) {
      existing.intent = intent;
      return false;
    }
    const slot: { intent: T | null } = { intent: null };
    this.pendingByKey.set(key, slot);
    try {
      let current: T | null = intent;
      while (current !== null) {
        await run(current);
        current = slot.intent;
        slot.intent = null;
      }
    } finally {
      this.pendingByKey.delete(key);
    }
    return true;
  }
}
// #endregion learn:latest-intent-queue
