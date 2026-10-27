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
import { and, asc, count, desc, eq, inArray, or, sql } from 'drizzle-orm';
import type { Media, Post, ReactionType, TelemetryEvent, TelemetrySummaryResponse, User, WebVitalName } from '../../../shared-contracts/feed-api-contracts.js';
import { createEmptyEngagementSummary, createEmptyReactionCounts } from '../../../shared-contracts/feed-api-contracts.js';
import type { Database, QueryExecutor } from './database-pool.js';
import { feedState, follows, idempotencyKeys, media, posts, reactions, telemetryEvents, users } from './database-schema.js';
import { createSeededRandom, generatePostBody } from './seed-data-generator.js';

/** Vị trí trong thứ tự feed – giải mã từ cursor. */
export interface FeedAnchor {
  createdAt: string;
  id: string;
}

/** Chọn đúng các cột của hợp đồng API → kết quả query có sẵn kiểu User / Media, không cần map lại. */
const USER_FIELDS = { id: users.id, name: users.name, handle: users.handle, avatarColor: users.avatarColor, isVerified: users.isVerified };
const MEDIA_FIELDS = { id: media.id, src: media.src, alt: media.alt, width: media.width, height: media.height, placeholderColor: media.placeholderColor };

// 📖 Bài học lesson-02 – thứ tự ổn định (created_at DESC, id DESC) làm nền cho cursor (docs/lessons/lesson-02.md)
// #region learn:feed-order
/** Thứ tự feed ổn định: mới nhất trước, hoà thì so id. */
const FEED_ORDER = [desc(posts.createdAt), desc(posts.id)];
// #endregion learn:feed-order

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

// 📖 Bài học lesson-02 – lấy dư 1 dòng để biết còn trang sau, không cần COUNT(*) (docs/lessons/lesson-02.md)
// #region learn:limit-plus-one-page
/** Lấy dư 1 dòng (limit + 1) để biết còn trang sau không mà không cần COUNT(*). */
function toPage(rows: (typeof posts.$inferSelect)[], limit: number) {
  return { posts: rows.slice(0, limit).map(rowToPost), hasMore: rows.length > limit };
}
// #endregion learn:limit-plus-one-page

export interface ReactionStats {
  counts: Record<ReactionType, number>;
  total: number;
  viewerReaction: ReactionType | null;
  /** Tối đa 2 người đã react, bạn bè của viewer xếp trước. */
  sampleReactorIds: string[];
}

const SAMPLE_REACTORS_PER_POST = 2;

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

  // 📖 Bài học lesson-09 – đọc feed generation từ bảng feed_state (docs/lessons/lesson-09.md)
  // #region learn:feed-generation-read
  async getFeedGeneration(): Promise<number> {
    const [row] = await this.db.select({ generation: feedState.generation }).from(feedState).where(eq(feedState.id, 1));
    return row?.generation ?? 1;
  }
  // #endregion learn:feed-generation-read

  // 📖 Bài học shared-foundations §6 – cursor SQL: so sánh bộ giá trị (created_at, id) để lấy bài cũ hơn (docs/lessons/shared-foundations.md)
  // #region learn:cursor-older
  /**
   * CURSOR PAGINATION bằng "row value comparison": (created_at, id) < (anchor.createdAt, anchor.id).
   * Drizzle không có toán tử riêng cho so sánh bộ giá trị → viết bằng sql``, vẫn an toàn vì giá trị là tham số.
   */
  async getPostsOlderThan(anchor: FeedAnchor | null, limit: number) {
    // Từng bước: (1) không có anchor = trang đầu, không cần điều kiện WHERE;
    // (2) có anchor thì chỉ lấy dòng đứng SAU anchor trong thứ tự (created_at, id) bằng một phép so sánh bộ giá trị;
    // (3) ORDER BY khớp đúng index posts_feed_order_idx nên Postgres đi thẳng tới vị trí anchor (range scan);
    // (4) LIMIT limit + 1 để toPage() biết còn trang sau hay không.
    const rows = await this.db
      .select()
      .from(posts)
      .where(anchor ? sql`(${posts.createdAt}, ${posts.id}) < (${anchor.createdAt}::timestamptz, ${anchor.id})` : undefined)
      .orderBy(...FEED_ORDER)
      .limit(limit + 1);
    return toPage(rows, limit);
  }
  // #endregion learn:cursor-older

  // 📖 Bài học lesson-04 – lấy bài mới hơn anchor: ASC rồi đảo lại thành thứ tự feed (docs/lessons/lesson-04.md)
  // #region learn:cursor-newer
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
  // #endregion learn:cursor-newer

  // 📖 Bài học lesson-02 – phân trang offset – chỉ để so sánh với cursor (docs/lessons/lesson-02.md)
  // #region learn:offset-page
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
  // #endregion learn:offset-page

  async getPostById(id: string): Promise<Post | null> {
    const [row] = await this.db.select().from(posts).where(eq(posts.id, id));
    return row ? rowToPost(row) : null;
  }

  // 📖 Bài học lesson-03 – đọc user theo lô và tính quan hệ với viewer, không N+1 (docs/lessons/lesson-03.md)
  // #region learn:batch-users-with-relationship
  /** Có viewerId → điền relationshipToViewer (1 query thêm trên bảng follows, vẫn theo lô). */
  async getUsersByIds(ids: readonly string[], executor: QueryExecutor = this.db, viewerId?: string): Promise<User[]> {
    if (ids.length === 0) return [];
    const found: User[] = await executor.select(USER_FIELDS).from(users).where(inArray(users.id, [...ids]));
    if (!viewerId) return found;

    const edges = await executor
      .select({ followerId: follows.followerId, followeeId: follows.followeeId })
      .from(follows)
      .where(or(and(eq(follows.followerId, viewerId), inArray(follows.followeeId, [...ids])), and(eq(follows.followeeId, viewerId), inArray(follows.followerId, [...ids]))));
    const viewerFollows = new Set(edges.filter((edge) => edge.followerId === viewerId).map((edge) => edge.followeeId));
    const followsViewer = new Set(edges.filter((edge) => edge.followeeId === viewerId).map((edge) => edge.followerId));
    return found.map((user) => ({
      ...user,
      relationshipToViewer: {
        isSelf: user.id === viewerId,
        isFollowing: viewerFollows.has(user.id),
        // "Bạn bè" = theo dõi lẫn nhau.
        isFriend: viewerFollows.has(user.id) && followsViewer.has(user.id),
      },
    }));
  }
  // #endregion learn:batch-users-with-relationship

  async getMediaByIds(ids: readonly string[], executor: QueryExecutor = this.db): Promise<Media[]> {
    if (ids.length === 0) return [];
    return executor.select(MEDIA_FIELDS).from(media).where(inArray(media.id, [...ids]));
  }

  // 📖 Bài học lesson-05 – số reaction theo loại + reaction của viewer cho nhiều bài (docs/lessons/lesson-05.md)
  // #region learn:reaction-stats
  /**
   * Số reaction theo loại + reaction của người xem + vài người react mẫu, cho nhiều bài (không N+1).
   * Hai query độc lập → chạy SONG SONG khi dùng pool; trong transaction chỉ có 1 kết nối nên chạy lần lượt.
   */
  async getReactionStats(postIds: readonly string[], viewerId: string, executor?: QueryExecutor): Promise<Map<string, ReactionStats>> {
    const stats = new Map<string, ReactionStats>(postIds.map((postId) => [postId, { counts: createEmptyReactionCounts(), total: 0, viewerReaction: null, sampleReactorIds: [] }]));
    if (postIds.length === 0) return stats;
    const [rows, samples] = executor
      ? [await this.queryReactionCounts(executor, postIds, viewerId), await this.querySampleReactors(executor, postIds, viewerId)]
      : await Promise.all([this.queryReactionCounts(this.db, postIds, viewerId), this.querySampleReactors(this.db, postIds, viewerId)]);
    for (const row of rows) {
      const entry = stats.get(row.postId)!;
      entry.counts[row.reaction] = row.count;
      entry.total += row.count;
      if (row.viewerHas) entry.viewerReaction = row.reaction;
    }
    for (const row of samples.rows) stats.get(row.post_id)?.sampleReactorIds.push(row.user_id);
    return stats;
  }
  // #endregion learn:reaction-stats

  // 📖 Bài học lesson-05 – GROUP BY đếm reaction và bool_or xác định reaction của viewer (docs/lessons/lesson-05.md)
  // #region learn:reaction-counts-query
  private queryReactionCounts(executor: QueryExecutor, postIds: readonly string[], viewerId: string) {
    return executor
      .select({
        postId: reactions.postId,
        reaction: reactions.reaction,
        count: count(),
        viewerHas: sql<boolean>`bool_or(${reactions.userId} = ${viewerId})`,
      })
      .from(reactions)
      .where(inArray(reactions.postId, [...postIds]))
      .groupBy(reactions.postId, reactions.reaction);
  }
  // #endregion learn:reaction-counts-query

  // 📖 Bài học lesson-07 – window function row_number lấy vài người react mẫu, ưu tiên bạn bè (docs/lessons/lesson-07.md)
  // #region learn:sample-reactors-query
  /**
   * Vài người đã react mỗi bài (không gồm chính viewer). Thứ tự ưu tiên: BẠN BÈ (theo dõi lẫn nhau) → người viewer
   * theo dõi → còn lại. Window function row_number() lấy top-N theo từng bài trong 1 query; Drizzle không có builder
   * riêng → dùng sql``.
   */
  private querySampleReactors(executor: QueryExecutor, postIds: readonly string[], viewerId: string) {
    return executor.execute<{ post_id: string; user_id: string }>(sql`
      SELECT post_id, user_id FROM (
        SELECT r.post_id, r.user_id,
               row_number() OVER (
                 PARTITION BY r.post_id
                 ORDER BY (f.follower_id IS NOT NULL AND back.follower_id IS NOT NULL) DESC, (f.follower_id IS NOT NULL) DESC, r.user_id
               ) AS rank
        FROM ${reactions} r
        LEFT JOIN ${follows} f ON f.follower_id = ${viewerId} AND f.followee_id = r.user_id
        LEFT JOIN ${follows} back ON back.follower_id = r.user_id AND back.followee_id = ${viewerId}
        WHERE r.post_id IN ${postIds} AND r.user_id <> ${viewerId}
      ) ranked
      WHERE rank <= ${SAMPLE_REACTORS_PER_POST}`);
  }
  // #endregion learn:sample-reactors-query

  // 📖 Bài học lesson-05 – UPSERT reaction: chạy hai lần cùng giá trị cho cùng kết quả (docs/lessons/lesson-05.md)
  // #region learn:set-reaction-upsert
  /** UPSERT: đặt mới hoặc đổi reaction – chạy 2 lần cùng giá trị cho cùng kết quả (idempotent). */
  async setReaction(postId: string, userId: string, reaction: ReactionType) {
    await this.db
      .insert(reactions)
      .values({ postId, userId, reaction })
      .onConflictDoUpdate({ target: [reactions.postId, reactions.userId], set: { reaction } });
  }
  // #endregion learn:set-reaction-upsert

  async removeReaction(postId: string, userId: string) {
    await this.db.delete(reactions).where(and(eq(reactions.postId, postId), eq(reactions.userId, userId)));
  }

  async insertUploadedMedia(item: Media, bytes: Buffer, contentType: string, uploadedBy: string) {
    await this.db.insert(media).values({ ...item, uploadBytes: bytes, contentType, uploadedBy });
  }

  async updateMediaAlt(executor: QueryExecutor, mediaId: string, alt: string) {
    await executor.update(media).set({ alt }).where(eq(media.id, mediaId));
  }

  // 📖 Bài học lesson-06 – chỉ chủ ảnh mới được gắn ảnh vào bài (docs/lessons/lesson-06.md)
  // #region learn:media-ownership-check
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
  // #endregion learn:media-ownership-check

  async getMediaForServing(id: string) {
    const [row] = await this.db
      .select({ ...MEDIA_FIELDS, uploadBytes: media.uploadBytes, contentType: media.contentType })
      .from(media)
      .where(eq(media.id, id));
    if (!row) return null;
    const { uploadBytes, contentType, ...item } = row;
    return { media: item, upload: uploadBytes && contentType ? { bytes: uploadBytes, contentType } : null };
  }

  // 📖 Bài học lesson-06 – chèn bài và tăng feed generation trong cùng executor (docs/lessons/lesson-06.md)
  // #region learn:insert-post-generation
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
  // #endregion learn:insert-post-generation

  // 📖 Bài học shared-foundations §8 – đọc/lưu response idempotent, khoá chính (viewer_id, key) (docs/lessons/shared-foundations.md)
  // #region learn:idempotency-find-and-save
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
  // #endregion learn:idempotency-find-and-save

  // 📖 Bài học lesson-02 – giả lập bạn bè đăng bài, chèn cả lô trong một transaction (docs/lessons/lesson-02.md)
  // #region learn:insert-new-posts-batch
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
  // #endregion learn:insert-new-posts-batch

  /** Chỉ dùng cho mock (lesson 12): giả lập bài bị tác giả xoá. Reactions xoá theo (ON DELETE CASCADE). */
  async deletePost(id: string) {
    const deleted = await this.db.delete(posts).where(eq(posts.id, id)).returning({ id: posts.id });
    return deleted.length > 0;
  }

  // 📖 Bài học lesson-11 – lưu cả lô sự kiện telemetry bằng một câu INSERT (docs/lessons/lesson-11.md)
  // #region learn:telemetry-insert-batch
  /** Lưu cả lô sự kiện telemetry trong 1 câu INSERT. */
  async insertTelemetryEvents(viewerId: string, events: readonly TelemetryEvent[]) {
    if (events.length === 0) return;
    await this.db.insert(telemetryEvents).values(
      events.map((event) => ({
        viewerId,
        type: event.type,
        postId: event.type === 'web-vital' ? null : event.postId,
        name: event.type === 'web-vital' ? event.name : null,
        valueMs: event.type === 'dwell' ? event.durationMs : event.type === 'web-vital' ? event.value : null,
        createdAt: new Date(event.at),
      })),
    );
  }
  // #endregion learn:telemetry-insert-batch

  // 📖 Bài học lesson-11 – tổng hợp impression, dwell và p75 web vitals bằng SQL (docs/lessons/lesson-11.md)
  // #region learn:telemetry-summary
  async getTelemetrySummary(): Promise<TelemetrySummaryResponse> {
    const totalEvents = await this.db.$count(telemetryEvents);
    const topImpressions = await this.db
      .select({
        postId: sql<string>`${telemetryEvents.postId}`,
        impressions: sql<number>`count(*) FILTER (WHERE ${telemetryEvents.type} = 'impression')`.mapWith(Number),
        totalDwellMs: sql<number>`coalesce(sum(${telemetryEvents.valueMs}) FILTER (WHERE ${telemetryEvents.type} = 'dwell'), 0)`.mapWith(Number),
      })
      .from(telemetryEvents)
      .where(sql`${telemetryEvents.postId} IS NOT NULL`)
      .groupBy(telemetryEvents.postId)
      .orderBy(desc(sql`2`))
      .limit(5);
    // p75 – percentile mà Core Web Vitals dùng để đánh giá ("75% lượt xem tốt hơn giá trị này").
    const vitals = await this.db
      .select({ name: telemetryEvents.name, p75: sql<number>`percentile_cont(0.75) WITHIN GROUP (ORDER BY ${telemetryEvents.valueMs})`.mapWith(Number) })
      .from(telemetryEvents)
      .where(eq(telemetryEvents.type, 'web-vital'))
      .groupBy(telemetryEvents.name);
    const webVitalsP75: TelemetrySummaryResponse['webVitalsP75'] = {};
    for (const vital of vitals) if (vital.name) webVitalsP75[vital.name as WebVitalName] = Math.round(vital.p75 * 1000) / 1000;
    return { totalEvents, topImpressions, webVitalsP75 };
  }
  // #endregion learn:telemetry-summary

  async countPosts() {
    return this.db.$count(posts);
  }
}
