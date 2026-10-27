/**
 * Sinh dữ liệu giả TẤT ĐỊNH (cùng seed → cùng dữ liệu) để mỗi lần restart server
 * bạn thấy lại đúng feed cũ, dễ lặp lại thí nghiệm.
 */
import type { Media, Post, PostBody, ReactionType, TextEntity, User } from '../../../shared-contracts/feed-api-contracts.js';
import { createEmptyEngagementSummary, REACTION_TYPES } from '../../../shared-contracts/feed-api-contracts.js';

/** PRNG mulberry32: nhỏ, nhanh, đủ dùng cho dữ liệu giả. */
export function createSeededRandom(seed: number) {
  let state = seed >>> 0;
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (min: number, max: number) => Math.floor(next() * (max - min + 1)) + min,
    pick: <T>(items: readonly T[]): T => items[Math.floor(next() * items.length)]!,
  };
}

export type SeededRandom = ReturnType<typeof createSeededRandom>;

const FIRST_NAMES = ['An', 'Bình', 'Chi', 'Dũng', 'Giang', 'Hà', 'Hải', 'Hương', 'Khoa', 'Lan', 'Linh', 'Long', 'Mai', 'Minh', 'Nam', 'Ngọc', 'Phúc', 'Quân', 'Sơn', 'Thảo', 'Trang', 'Tú', 'Tuấn', 'Vy', 'Yến'];
const LAST_NAMES = ['Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Võ', 'Đặng', 'Bùi', 'Đỗ', 'Huỳnh'];
const AVATAR_COLORS = ['#e76f51', '#2a9d8f', '#264653', '#f4a261', '#8ab17d', '#6d597a', '#b56576', '#457b9d', '#e9c46a', '#3d5a80'];
const HASHTAGS = ['frontend', 'systemdesign', 'react', 'javascript', 'saigon', 'cafe', 'weekend', 'dulich', 'webperf', 'a11y'];
const SENTENCES = [
  'Hôm nay mình vừa đọc xong bài về system design cho news feed',
  'Cà phê sáng nay ngon quá ☕',
  'Ai có kinh nghiệm tối ưu infinite scroll không?',
  'Cuối tuần này đi đâu chơi nhỉ 🌴',
  'Mới deploy xong bản mới, hy vọng không có bug 🙏',
  'Virtualization giúp feed mượt hơn hẳn trên điện thoại yếu',
  'Cursor pagination tốt hơn offset khi dữ liệu thay đổi liên tục',
  'Optimistic update làm UI phản hồi tức thì 🚀',
  'Đừng quên alt text cho ảnh nhé, người dùng screen reader cần nó',
  'Thời tiết Sài Gòn hôm nay đẹp ghê 🌤️',
  'Đang học cách dùng IntersectionObserver',
  'Chia sẻ một vài tấm ảnh từ chuyến đi vừa rồi 📸',
];
const LINKS = ['https://www.greatfrontend.com', 'https://web.dev/articles/vitals', 'https://developer.mozilla.org/docs/Web/API/Intersection_Observer_API'];
const ALT_SUBJECTS = ['Phong cảnh biển', 'Ly cà phê', 'Góc làm việc', 'Đường phố về đêm', 'Bữa sáng', 'Hoàng hôn', 'Núi rừng', 'Con mèo'];
const IMAGE_SHAPES: Array<[number, number]> = [[1200, 800], [800, 1000], [1000, 1000], [1600, 900]];

export function generateUsers(random: SeededRandom, count: number): User[] {
  return Array.from({ length: count }, (_, index) => {
    const first = random.pick(FIRST_NAMES);
    const last = random.pick(LAST_NAMES);
    return {
      id: `user-${index + 1}`,
      name: `${last} ${first}`,
      handle: `${first}${index + 1}`.normalize('NFD').replace(/[̀-ͯ]/g, '').replace('đ', 'd').replace('Đ', 'D').toLowerCase(),
      avatarColor: random.pick(AVATAR_COLORS),
      isVerified: random.next() < 0.15,
    };
  });
}

/**
 * Ghép text và đồng thời ghi lại entity ranges.
 * Offset dùng String.length (UTF-16) – khớp với cách client cắt chuỗi bằng slice().
 */
export class PostBodyBuilder {
  private text = '';
  private readonly entities: TextEntity[] = [];

  appendText(value: string) {
    this.text += value;
    return this;
  }

  appendMention(user: User) {
    const start = this.text.length;
    this.text += `@${user.name}`;
    this.entities.push({ type: 'mention', start, end: this.text.length, userId: user.id });
    return this;
  }

  appendHashtag(tag: string) {
    const start = this.text.length;
    this.text += `#${tag}`;
    this.entities.push({ type: 'hashtag', start, end: this.text.length, tag });
    return this;
  }

  appendLink(url: string) {
    const start = this.text.length;
    this.text += url;
    this.entities.push({ type: 'link', start, end: this.text.length, url });
    return this;
  }

  build(): PostBody {
    return { text: this.text, entities: [...this.entities] };
  }
}

export function generatePostBody(random: SeededRandom, users: User[]): PostBody {
  const builder = new PostBodyBuilder();
  const sentenceCount = random.int(1, 3);
  for (let i = 0; i < sentenceCount; i += 1) {
    builder.appendText(`${i > 0 ? ' ' : ''}${random.pick(SENTENCES)}.`);
  }
  // Một số bài dài để minh hoạ "Xem thêm" (truncation).
  if (random.next() < 0.2) {
    for (let i = 0; i < 6; i += 1) builder.appendText(` ${random.pick(SENTENCES)}.`);
  }
  if (random.next() < 0.4) builder.appendText(' Cảm ơn ').appendMention(random.pick(users)).appendText('!');
  if (random.next() < 0.3) builder.appendText(' Tham khảo: ').appendLink(random.pick(LINKS));
  if (random.next() < 0.6) {
    builder.appendText(' ').appendHashtag(random.pick(HASHTAGS));
    if (random.next() < 0.5) builder.appendText(' ').appendHashtag(random.pick(HASHTAGS));
  }
  return builder.build();
}

export function createMediaRecord(id: string, width: number, height: number, alt: string, color: string): Media {
  return { id, src: `/media/${id}`, alt, width, height, placeholderColor: color };
}

export interface SeedData {
  users: User[];
  posts: Post[];
  media: Media[];
  /** reactions[postId][userId] = reaction */
  reactions: Map<string, Map<string, ReactionType>>;
}

export const SEED_USER_COUNT = 30;
export const SEED_POST_COUNT = 300;

export function generateSeedData(seed = 42, now = Date.now()): SeedData {
  const random = createSeededRandom(seed);
  const users = generateUsers(random, SEED_USER_COUNT);
  const media: Media[] = [];
  const posts: Post[] = [];
  const reactions = new Map<string, Map<string, ReactionType>>();

  for (let index = 0; index < SEED_POST_COUNT; index += 1) {
    const postId = `post-${String(SEED_POST_COUNT - index).padStart(4, '0')}`;
    const mediaIds: string[] = [];
    const imageCount = random.next() < 0.5 ? 0 : random.int(1, 4);
    for (let m = 0; m < imageCount; m += 1) {
      const [width, height] = random.pick(IMAGE_SHAPES);
      const mediaId = `${postId}-m${m + 1}`;
      media.push(createMediaRecord(mediaId, width, height, `${random.pick(ALT_SUBJECTS)} (ảnh ${m + 1})`, random.pick(AVATAR_COLORS)));
      mediaIds.push(mediaId);
    }

    const postReactions = new Map<string, ReactionType>();
    const reactorCount = random.int(0, users.length);
    for (let r = 0; r < reactorCount; r += 1) {
      const reactor = random.pick(users);
      postReactions.set(reactor.id, random.next() < 0.6 ? 'like' : random.pick(REACTION_TYPES));
    }
    reactions.set(postId, postReactions);

    posts.push({
      id: postId,
      authorId: random.pick(users).id,
      body: generatePostBody(random, users),
      mediaIds,
      // engagementSummary/viewerReaction được tính lại theo viewer khi trả response.
      engagementSummary: createEmptyEngagementSummary({ commentCount: random.int(0, 200), shareCount: random.int(0, 50) }),
      viewerReaction: null,
      // Bài đầu tiên mới nhất; mỗi bài cách nhau 7–90 phút.
      createdAt: new Date(now - (index * 37 + random.int(7, 90)) * 60_000).toISOString(),
    });
  }

  // Một bài có lượt reaction "khủng" để minh hoạ format số gọn (103K).
  const viralPost = posts[3];
  if (viralPost) viralPost.engagementSummary.shareCount = 12_345;

  return { users, posts, media, reactions };
}
