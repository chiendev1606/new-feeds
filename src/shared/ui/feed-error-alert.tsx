/** Lỗi tải feed hiển thị ngay trong list (inline error) kèm nút thử lại – không phá cả trang. */
export function FeedErrorAlert({ error, onRetry }: { error: string | null; onRetry: () => void }) {
  return (
    <p role="alert">
      <span className="error-text">{error}</span>{' '}
      <button type="button" onClick={onRetry}>
        Thử lại
      </button>
    </p>
  );
}
