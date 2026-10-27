/**
 * Skeleton thay cho spinner: giữ đúng "hình dạng" bài viết → người dùng cảm thấy nhanh hơn
 * và layout không nhảy khi dữ liệu về (CLS thấp).
 */
export function PostSkeleton() {
  return (
    <div className="post-card post-skeleton" aria-hidden="true">
      <div className="post-card__header">
        <span className="skeleton skeleton--circle" />
        <div style={{ flex: 1 }}>
          <span className="skeleton skeleton--line" style={{ width: '40%' }} />
          <span className="skeleton skeleton--line" style={{ width: '25%' }} />
        </div>
      </div>
      <span className="skeleton skeleton--line" />
      <span className="skeleton skeleton--line" style={{ width: '80%' }} />
      <span className="skeleton skeleton--block" />
    </div>
  );
}

export function PostSkeletonList({ count = 2 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }, (_, index) => (
        <PostSkeleton key={index} />
      ))}
    </>
  );
}
