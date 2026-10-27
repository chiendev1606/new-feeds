/**
 * Error boundary cho chunk tải lười.
 *
 * Vì sao cần: React.lazy ném lỗi (reject) khi chunk không tải được (mất mạng, deploy mới xoá file cũ).
 * Không có boundary thì lỗi này làm sập CẢ cây React. Chunk phụ (menu, hover card) hỏng chỉ nên làm
 * mất tính năng phụ đó, còn feed vẫn dùng được.
 * Lưu ý: React.lazy nhớ kết quả reject → thử lại cần tải lại trang; vì vậy chỉ hiện thông báo gọn.
 */
import { Component, type ReactNode } from 'react';

interface ChunkErrorBoundaryProps {
  children: ReactNode;
  /** Giao diện thay thế khi chunk lỗi. Mặc định: thông báo nhỏ. */
  fallback?: ReactNode;
  /** Tên chunk để log. */
  name: string;
}

// 📖 Bài học lesson-10 – chunk phụ hỏng chỉ làm mất tính năng phụ, không sập cả cây React (docs/lessons/lesson-10.md)
// #region learn:chunk-error-boundary
export class ChunkErrorBoundary extends Component<ChunkErrorBoundaryProps, { failed: boolean }> {
  override state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  override componentDidCatch(error: unknown) {
    console.error(`[lazy] không tải được chunk "${this.props.name}"`, error);
  }

  override render() {
    if (this.state.failed) {
      return this.props.fallback ?? <span className="muted" role="alert">Không tải được "{this.props.name}". Tải lại trang để thử lại.</span>;
    }
    return this.props.children;
  }
}
// #endregion learn:chunk-error-boundary
