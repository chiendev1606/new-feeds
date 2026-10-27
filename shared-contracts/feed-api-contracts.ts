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

export interface User {
  id: string;
  name: string;
  handle: string;
  avatarColor: string;
  isVerified: boolean;
}

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

export interface EngagementSummary {
  reactionCounts: Record<ReactionType, number>;
  totalReactions: number;
  commentCount: number;
  shareCount: number;
}

export function createEmptyEngagementSummary(overrides: Partial<Omit<EngagementSummary, 'reactionCounts'>> = {}): EngagementSummary {
  return { reactionCounts: createEmptyReactionCounts(), totalReactions: 0, commentCount: 0, shareCount: 0, ...overrides };
}

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

// ---------- Feed / pagination ----------

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

export interface OffsetFeedResponse {
  postIds: string[];
  nextOffset: number;
  hasMore: boolean;
  posts: Record<string, Post>;
  users: Record<string, User>;
  media: Record<string, Media>;
}

export interface SinglePostResponse {
  post: Post;
  users: Record<string, User>;
  media: Record<string, Media>;
}

// ---------- Writes ----------

export interface SetReactionRequest {
  reaction: ReactionType;
}

export interface ReactionResponse {
  postId: string;
  engagementSummary: EngagementSummary;
  viewerReaction: ReactionType | null;
}

export interface MediaUploadResponse {
  mediaId: string;
  media: Media;
}

export interface CreatePostRequest {
  body: PostBody;
  mediaIds: string[];
  /** Alt text người dùng nhập cho từng ảnh (mediaId → alt). Ảnh upload trước, alt có thể nhập sau. */
  altTexts?: Record<string, string>;
}

export type CreatePostResponse = SinglePostResponse;

// ---------- Errors ----------

export interface ApiErrorBody {
  error: { code: string; message: string };
}

// ---------- Simulation control (chỉ để học, không có trong hệ thống thật) ----------

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
