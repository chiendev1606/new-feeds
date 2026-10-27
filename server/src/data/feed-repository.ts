/**
 * REPOSITORY – nơi DUY NHẤT trong server truy cập DB (qua Drizzle ORM). Routes/services chỉ gọi các hàm ở đây.
 *
 * Mọi hàm đọc theo LÔ (nhận mảng id, trả về nhiều dòng) để tránh lỗi N+1:
 * render 1 trang 10 bài = vài query cố định, không phải 10 query cho tác giả + 10 query cho ảnh + ...
 *
 * Các hàm có tham số `executor` nhận db hoặc transaction (`tx`): truyền `tx` để đọc/ghi BÊN TRONG transaction đó
 * (thấy được dữ liệu chưa commit của chính nó). Hàm đọc mặc định dùng db; hàm ghi trong transaction bắt buộc truyền.
 */
import { randomUUID } from 'node:crypto';
import { and, asc, count, desc, eq, inArray, sql } from 'drizzle-orm';
import type { Media, Post, ReactionType, User } from '../../../shared-contracts/feed-api-contracts.js';
import { createEmptyEngagementSummary, createEmptyReactionCounts } from '../../../shared-contracts/feed-api-contracts.js';
import type { Database, QueryExecutor } from './database-pool.js';
import { feedState, idempotencyKeys, media, posts, reactions, users } from './database-schema.js';
import { createSeededRandom, generatePostBody } from './seed-data-generator.js';

/** Vị trí trong thứ tự feed – giải mã từ cursor. */
export interface FeedAnchor {
  createdAt: string;
  id: string;
}

/** Chọn đúng các cột của hợp đồng API → kết quả query có sẵn kiểu User / Media, không cần map lại. */
const USER_FIELDS = { id: users.id, name: users.name, handle: users.handle, avatarColor: users.avatarColor, isVerified: users.isVerified };
const MEDIA_FIELDS = { id: media.id, src: media.src, alt: media.alt, width: media.width, height: media.height, placeholderColor: media.placeholderColor };

/** Thứ tự feed ổn định: mới nhất trước, hoà thì so id. */
const FEED_ORDER = [desc(posts.createdAt), desc(posts.id)];

/** Dòng DB → Post. engagementSummary/viewerReaction được điền sau (theo người xem). */
function rowToPost(row: typeof posts.$inferSelect): Post {
  return {
    id: row.id,
    authorId: row.authorId,
    body: { text: row.bodyText, entities: row.bodyEntities },
    mediaIds: row.mediaIds,
    engagementSummary: createEmptyEngagementSummary({ commentCount: row.commentCount, shareCount: row.shareCount }),
    viewerReaction: null,
    createdAt: row.createdAt.toISOString(),
  };
}

export function postToRow(post: Post): typeof posts.$inferInsert {
  return {
    id: post.id,
    authorId: post.authorId,
    bodyText: post.body.text,
    bodyEntities: post.body.entities,
    mediaIds: post.mediaIds,
    commentCount: post.engagementSummary.commentCount,
    shareCount: post.engagementSummary.shareCount,
    createdAt: new Date(post.createdAt),
  };
}

/** Lấy dư 1 dòng (limit + 1) để biết còn trang sau không mà không cần COUNT(*). */
function toPage(rows: (typeof posts.$inferSelect)[], limit: number) {
  return { posts: rows.slice(0, limit).map(rowToPost), hasMore: rows.length > limit };
}

export interface ReactionStats {
  counts: Record<ReactionType, number>;
  total: number;
  viewerReaction: ReactionType | null;
}

export interface StoredIdempotentResponse {
  status: number;
  requestHash: string;
  response: unknown;
}

export class FeedRepository {
  private readonly random = createSeededRandom(Date.now() % 100_000);

  constructor(readonly db: Database) {}

  static newId(prefix: string) {
    return `${prefix}-${randomUUID().slice(0, 8)}`;
  }

  async getFeedGeneration(): Promise<number> {
    const [row] = await this.db.select({ generation: feedState.generation }).from(feedState).where(eq(feedState.id, 1));
    return row?.generation ?? 1;
  }

  /**
   * CURSOR PAGINATION bằng "row value comparison": (created_at, id) < (anchor.createdAt, anchor.id).
   * Drizzle không có toán tử riêng cho so sánh bộ giá trị → viết bằng sql``, vẫn an toàn vì giá trị là tham số.
   */
  async getPostsOlderThan(anchor: FeedAnchor | null, limit: number) {
    const rows = await this.db
      .select()
      .from(posts)
      .where(anchor ? sql`(${posts.createdAt}, ${posts.id}) < (${anchor.createdAt}::timestamptz, ${anchor.id})` : undefined)
      .orderBy(...FEED_ORDER)
      .limit(limit + 1);
    return toPage(rows, limit);
  }

  /** Các bài MỚI hơn anchor, lấy những bài gần anchor nhất trước (ASC), rồi đảo lại thành thứ tự feed (DESC). */
  async getPostsNewerThan(anchor: FeedAnchor, limit: number) {
    const rows = await this.db
      .select()
      .from(posts)
      .where(sql`(${posts.createdAt}, ${posts.id}) > (${anchor.createdAt}::timestamptz, ${anchor.id})`)
      .orderBy(asc(posts.createdAt), asc(posts.id))
      .limit(limit + 1);
    const page = toPage(rows, limit);
    return { ...page, posts: page.posts.reverse() };
  }

  /** OFFSET: Postgres phải đọc rồi bỏ qua `offset` dòng – chỉ dùng để so sánh trong lesson 02. */
  async getPostsByOffset(offset: number, limit: number) {
    const rows = await this.db
      .select()
      .from(posts)
      .orderBy(...FEED_ORDER)
      .offset(offset)
      .limit(limit + 1);
    return toPage(rows, limit);
  }

  async getPostById(id: string): Promise<Post | null> {
    const [row] = await this.db.select().from(posts).where(eq(posts.id, id));
    return row ? rowToPost(row) : null;
  }

  async getUsersByIds(ids: readonly string[], executor: QueryExecutor = this.db): Promise<User[]> {
    if (ids.length === 0) return [];
    return executor.select(USER_FIELDS).from(users).where(inArray(users.id, [...ids]));
  }

  async getMediaByIds(ids: readonly string[], executor: QueryExecutor = this.db): Promise<Media[]> {
    if (ids.length === 0) return [];
    return executor.select(MEDIA_FIELDS).from(media).where(inArray(media.id, [...ids]));
  }

  /** Số reaction theo loại + reaction của người xem, cho nhiều bài trong 1 query (GROUP BY). */
  async getReactionStats(postIds: readonly string[], viewerId: string, executor: QueryExecutor = this.db): Promise<Map<string, ReactionStats>> {
    const stats = new Map<string, ReactionStats>(postIds.map((postId) => [postId, { counts: createEmptyReactionCounts(), total: 0, viewerReaction: null }]));
    if (postIds.length === 0) return stats;
    const rows = await executor
      .select({
        postId: reactions.postId,
        reaction: reactions.reaction,
        count: count(),
        viewerHas: sql<boolean>`bool_or(${reactions.userId} = ${viewerId})`,
      })
      .from(reactions)
      .where(inArray(reactions.postId, [...postIds]))
      .groupBy(reactions.postId, reactions.reaction);
    for (const row of rows) {
      const entry = stats.get(row.postId)!;
      entry.counts[row.reaction] = row.count;
      entry.total += row.count;
      if (row.viewerHas) entry.viewerReaction = row.reaction;
    }
    return stats;
  }

  /** UPSERT: đặt mới hoặc đổi reaction – chạy 2 lần cùng giá trị cho cùng kết quả (idempotent). */
  async setReaction(postId: string, userId: string, reaction: ReactionType) {
    await this.db
      .insert(reactions)
      .values({ postId, userId, reaction })
      .onConflictDoUpdate({ target: [reactions.postId, reactions.userId], set: { reaction } });
  }

  async removeReaction(postId: string, userId: string) {
    await this.db.delete(reactions).where(and(eq(reactions.postId, postId), eq(reactions.userId, userId)));
  }

  async insertUploadedMedia(item: Media, bytes: Buffer, contentType: string, uploadedBy: string) {
    await this.db.insert(media).values({ ...item, uploadBytes: bytes, contentType, uploadedBy });
  }

  async updateMediaAlt(executor: QueryExecutor, mediaId: string, alt: string) {
    await executor.update(media).set({ alt }).where(eq(media.id, mediaId));
  }

  /** Trả về các mediaId trong danh sách mà người này KHÔNG được phép dùng (không tồn tại hoặc của người khác). */
  async findMediaNotOwnedBy(ids: readonly string[], userId: string): Promise<string[]> {
    if (ids.length === 0) return [];
    const rows = await this.db
      .select({ id: media.id })
      .from(media)
      .where(and(inArray(media.id, [...ids]), eq(media.uploadedBy, userId)));
    const owned = new Set(rows.map((row) => row.id));
    return ids.filter((id) => !owned.has(id));
  }

  async getMediaForServing(id: string) {
    const [row] = await this.db
      .select({ ...MEDIA_FIELDS, uploadBytes: media.uploadBytes, contentType: media.contentType })
      .from(media)
      .where(eq(media.id, id));
    if (!row) return null;
    const { uploadBytes, contentType, ...item } = row;
    return { media: item, upload: uploadBytes && contentType ? { bytes: uploadBytes, contentType } : null };
  }

  /** Chèn bài + tăng feed generation. Nhận executor để chạy chung transaction với idempotency key. */
  async insertPost(executor: QueryExecutor, post: Post) {
    await executor.insert(posts).values(postToRow(post));
    const [row] = await executor
      .update(feedState)
      .set({ generation: sql`${feedState.generation} + 1` })
      .where(eq(feedState.id, 1))
      .returning({ generation: feedState.generation });
    return row?.generation ?? 1;
  }

  async findIdempotentResponse(viewerId: string, key: string): Promise<StoredIdempotentResponse | null> {
    const [row] = await this.db
      .select({ status: idempotencyKeys.status, requestHash: idempotencyKeys.requestHash, response: idempotencyKeys.response })
      .from(idempotencyKeys)
      .where(and(eq(idempotencyKeys.viewerId, viewerId), eq(idempotencyKeys.key, key)));
    return row ?? null;
  }

  /** Khoá chính (viewer_id, key) → nếu một request khác đã lưu trước, câu INSERT này lỗi 23505 và transaction rollback. */
  async saveIdempotentResponse(executor: QueryExecutor, viewerId: string, key: string, stored: StoredIdempotentResponse) {
    await executor.insert(idempotencyKeys).values({ viewerId, key, ...stored });
  }

  /** Giả lập bạn bè vừa đăng bài – cho demo offset vs cursor và banner "Có bài mới". Chèn cả lô trong 1 transaction. */
  async insertRandomNewPosts(total: number): Promise<{ posts: Post[]; generation: number }> {
    const authors = await this.db.select(USER_FIELDS).from(users).orderBy(users.id);
    const created: Post[] = Array.from({ length: total }, () => ({
      id: FeedRepository.newId('post-new'),
      authorId: this.random.pick(authors).id,
      body: generatePostBody(this.random, authors),
      mediaIds: [],
      engagementSummary: createEmptyEngagementSummary(),
      viewerReaction: null,
      createdAt: new Date().toISOString(),
    }));
    const generation = await this.db.transaction(async (tx) => {
      let latest = 1;
      for (const post of created) latest = await this.insertPost(tx, post);
      return latest;
    });
    return { posts: created, generation };
  }

  async countPosts() {
    return this.db.$count(posts);
  }
}
