/**
 * HỢP ĐỒNG API (phần "I – Interface" trong RADIO).
 *
 * File này được import bởi CẢ server (server/src) lẫn client (src).
 * Trong thực tế đây thường là OpenAPI/GraphQL schema được generate ra types;
 * ở đây viết tay để thấy rõ: server và client phải đồng ý với nhau về hình dạng dữ liệu.
 */

// ---------- Entities (phần "D – Data model") ----------

export type ReactionType = 'like' | 'love' | 'haha' | 'wow' | 'sad' | 'angry';

export const REACTION_TYPES: readonly ReactionType[] = ['like', 'love', 'haha', 'wow', 'sad', 'angry'];

/** Bộ đếm reaction toàn 0 – tạo object MỚI mỗi lần (nơi gọi có thể sửa trực tiếp). */
export function createEmptyReactionCounts(): Record<ReactionType, number> {
  return Object.fromEntries(REACTION_TYPES.map((type) => [type, 0])) as Record<ReactionType, number>;
}

// 📖 Bài học lesson-03 – User và quan hệ với viewer do server tính theo session (docs/lessons/lesson-03.md)
// #region learn:contract-user-relationship
/** Quan hệ giữa user và NGƯỜI ĐANG XEM – server tính theo session, nên khác nhau giữa các viewer. */
export interface RelationshipToViewer {
  isSelf: boolean;
  isFriend: boolean;
  isFollowing: boolean;
}

export interface User {
  id: string;
  name: string;
  handle: string;
  avatarColor: string;
  isVerified: boolean;
  /** Chỉ có khi response được cá nhân hoá theo viewer (feed, chi tiết bài). */
  relationshipToViewer?: RelationshipToViewer;
}
// #endregion learn:contract-user-relationship

export interface Media {
  id: string;
  /** URL gốc; client thêm `?w=` để xin kích thước phù hợp (dùng cho srcset). */
  src: string;
  alt: string;
  width: number;
  height: number;
  /** Màu trung bình – dùng làm placeholder trong lúc ảnh đang tải (giống LQIP/BlurHash rút gọn). */
  placeholderColor: string;
}

// 📖 Bài học lesson-06 – entity ranges thay cho HTML, offset UTF-16 trên text (docs/lessons/lesson-06.md)
// #region learn:contract-text-entity
/**
 * Mention/hashtag/link được lưu dưới dạng "entity ranges" thay vì HTML.
 * start/end là offset UTF-16 (giống String.prototype.slice của JS) trên `text`.
 * Lý do: client tự quyết cách render → không bao giờ phải chèn HTML từ server (chống XSS).
 */
export type TextEntity =
  | { type: 'mention'; start: number; end: number; userId: string }
  | { type: 'hashtag'; start: number; end: number; tag: string }
  | { type: 'link'; start: number; end: number; url: string };

export interface PostBody {
  text: string;
  entities: TextEntity[];
}
// #endregion learn:contract-text-entity

// 📖 Bài học lesson-05 – số liệu tương tác và vài người react mẫu (docs/lessons/lesson-05.md)
// #region learn:contract-engagement-summary
export interface EngagementSummary {
  reactionCounts: Record<ReactionType, number>;
  totalReactions: number;
  commentCount: number;
  shareCount: number;
  /**
   * Tối đa 2 người đã react (ưu tiên bạn bè), để hiện "An, Bình và 3 người khác" bằng Intl.ListFormat.
   * Chỉ gửi vài id thay vì cả danh sách – bài viết: "avoid sending huge user lists".
   */
  sampleReactorIds?: string[];
}

export function createEmptyEngagementSummary(overrides: Partial<Omit<EngagementSummary, 'reactionCounts'>> = {}): EngagementSummary {
  return { reactionCounts: createEmptyReactionCounts(), totalReactions: 0, commentCount: 0, shareCount: 0, ...overrides };
}
// #endregion learn:contract-engagement-summary

// 📖 Bài học lesson-03 – Post chỉ giữ authorId và mediaIds để client chuẩn hoá (docs/lessons/lesson-03.md)
// #region learn:contract-post
export interface Post {
  id: string;
  /** Chỉ lưu id, KHÔNG lồng object User → client chuẩn hoá (normalize) được. */
  authorId: string;
  body: PostBody;
  mediaIds: string[];
  engagementSummary: EngagementSummary;
  /** Reaction của chính người đang xem; server tính từ session. */
  viewerReaction: ReactionType | null;
  /** ISO string; client tự format bằng Intl. */
  createdAt: string;
}
// #endregion learn:contract-post

// ---------- Feed / pagination ----------

// 📖 Bài học shared-foundations §5 – FeedPageInfo và NormalizedFeedResponse (docs/lessons/shared-foundations.md)
// #region learn:contract-feed-page
export type FeedDirection = 'older' | 'newer';

export interface FeedPageInfo {
  postIds: string[];
  /** Cursor mờ (opaque): client không được tự parse, chỉ gửi lại cho server. */
  olderCursor: string | null;
  newerCursor: string | null;
  hasOlder: boolean;
  hasNewer: boolean;
  /** Tăng mỗi khi có bài mới được chèn lên đầu feed phía server. */
  generation: number;
}

/**
 * Response "chuẩn hoá": danh sách post + các entity được tham chiếu, mỗi thứ chỉ xuất hiện một lần.
 * Client merge thẳng vào store theo id (postsById, usersById, mediaById).
 */
export interface NormalizedFeedResponse {
  feed: FeedPageInfo;
  posts: Record<string, Post>;
  users: Record<string, User>;
  media: Record<string, Media>;
}
// #endregion learn:contract-feed-page

// 📖 Bài học lesson-02 – response của phân trang offset (docs/lessons/lesson-02.md)
// #region learn:contract-offset-feed
export interface OffsetFeedResponse {
  postIds: string[];
  nextOffset: number;
  hasMore: boolean;
  posts: Record<string, Post>;
  users: Record<string, User>;
  media: Record<string, Media>;
}
// #endregion learn:contract-offset-feed

export interface SinglePostResponse {
  post: Post;
  users: Record<string, User>;
  media: Record<string, Media>;
}

// ---------- Writes ----------

export interface SetReactionRequest {
  reaction: ReactionType;
}

// 📖 Bài học lesson-09 – ReactionResponse kèm confirmedAt để các tab bỏ bản cập nhật cũ (docs/lessons/lesson-09.md)
// #region learn:contract-reaction-response
export interface ReactionResponse {
  postId: string;
  engagementSummary: EngagementSummary;
  viewerReaction: ReactionType | null;
  /** Thời điểm server ghi xong (ISO) – các tab dùng để bỏ qua bản cập nhật cũ hơn khi đồng bộ qua BroadcastChannel. */
  confirmedAt: string;
}
// #endregion learn:contract-reaction-response

export interface MediaUploadResponse {
  mediaId: string;
  media: Media;
}

// 📖 Bài học lesson-06 – request và response tạo bài (docs/lessons/lesson-06.md)
// #region learn:contract-create-post
export interface CreatePostRequest {
  body: PostBody;
  mediaIds: string[];
  /** Alt text người dùng nhập cho từng ảnh (mediaId → alt). Ảnh upload trước, alt có thể nhập sau. */
  altTexts?: Record<string, string>;
}

export type CreatePostResponse = SinglePostResponse;
// #endregion learn:contract-create-post

// ---------- Errors ----------

// 📖 Bài học shared-foundations §5 – hình dạng lỗi thống nhất giữa server và client (docs/lessons/shared-foundations.md)
// #region learn:contract-api-error
export interface ApiErrorBody {
  error: { code: string; message: string };
}
// #endregion learn:contract-api-error

// ---------- Session ----------

export interface SessionInfo {
  viewerId: string;
}

// ---------- Telemetry (lesson 11) ----------

export type WebVitalName = 'LCP' | 'CLS' | 'INP' | 'long-task';

// 📖 Bài học lesson-11 – union các loại sự kiện telemetry (docs/lessons/lesson-11.md)
// #region learn:contract-telemetry-event
export type TelemetryEvent =
  /** Bài hiện ≥ 50% trong ≥ 1 giây – mỗi bài tính một lần mỗi phiên. */
  | { type: 'impression'; postId: string; at: string }
  /** Tổng thời gian bài nằm trong viewport, gửi khi bài rời viewport hoặc trang bị ẩn. */
  | { type: 'dwell'; postId: string; durationMs: number; at: string }
  | { type: 'web-vital'; name: WebVitalName; value: number; at: string };

export interface TelemetryBatchRequest {
  events: TelemetryEvent[];
}
// #endregion learn:contract-telemetry-event

export interface TelemetrySummaryResponse {
  totalEvents: number;
  topImpressions: Array<{ postId: string; impressions: number; totalDwellMs: number }>;
  webVitalsP75: Partial<Record<WebVitalName, number>>;
}

// ---------- Simulation control (chỉ để học, không có trong hệ thống thật) ----------

// 📖 Bài học lesson-12 – cấu hình mô phỏng và tên header dùng chung (docs/lessons/lesson-12.md)
// #region learn:contract-simulation-and-headers
export interface SimulationConfig {
  /** Độ trễ giả cho mỗi request /api (ms). */
  latencyMs: number;
  /** Xác suất 0..1 trả về 503 để thử retry/rollback. */
  failRate: number;
  /** 0 = tắt; >0 = cứ N giây server tự chèn 1 bài mới lên đầu feed. */
  autoNewPostsEverySec: number;
}

/** Headers mà client và server cùng dùng. */
export const IDEMPOTENCY_KEY_HEADER = 'Idempotency-Key';
export const IDEMPOTENT_REPLAYED_HEADER = 'Idempotent-Replayed';
// #endregion learn:contract-simulation-and-headers
