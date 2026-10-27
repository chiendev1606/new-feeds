/**
 * Parser biến text người dùng gõ thành { text, entities } đúng "wire format" của server.
 *
 * Quy tắc phải khớp validate phía server (server/src/routes/post-routes.ts):
 *   1. text phải là NFC: "ệ" có thể là 1 ký tự (NFC) hoặc "e" + 2 dấu kết hợp (NFD, macOS/IME hay sinh ra).
 *      Offset tính trên NFD sẽ lệch so với NFC → mention bị cắt sai chỗ. Vì vậy NFC-normalize TRƯỚC, rồi mới
 *      tính offset trên chuỗi đã chuẩn hoá. Trả về text đã chuẩn hoá để gửi đi.
 *   2. Offset là UTF-16 code unit (giống String.slice). Regex chạy trên string JS nên match.index đã đúng
 *      đơn vị này; emoji (2 code unit) đứng trước entity vẫn cho offset đúng.
 *   3. Entity không chồng lấn: dùng MỘT regex duy nhất quét trái→phải, mỗi lần match tiêu thụ đoạn của nó,
 *      nên không thể có hai entity giao nhau (vd '#tag' nằm trong URL chỉ thuộc về link).
 *   4. Mention chỉ thành entity khi @handle khớp user ĐÃ BIẾT (server từ chối userId không tồn tại).
 *   5. Link chỉ http/https; hashtag là chữ Unicode (\p{L}\p{N}_) và phải có ít nhất một chữ cái.
 */
import type { TextEntity, User } from '../../shared/types/feed-entities';

export interface ParsedComposerText {
  /** Text đã chuẩn hoá NFC – CHÍNH chuỗi này phải gửi lên server. */
  text: string;
  entities: TextEntity[];
}

// 📖 Bài học lesson-10 §4 – một regex quét trái sang phải nên entity không chồng lấn (docs/lessons/lesson-10.md)
// #region learn:entity-pattern-single-regex
/** Ký tự "thuộc về từ": dùng cho lookbehind để không bắt "mail@host" hay "abc#def". */
const WORD = String.raw`\p{L}\p{N}_`;

const ENTITY_PATTERN = new RegExp(
  [
    String.raw`(https?:\/\/[^\s<>"]+)`, // 1: link
    String.raw`(?<![${WORD}])#([${WORD}]+)`, // 2: hashtag
    String.raw`(?<![${WORD}\/])@([${WORD}]+)`, // 3: mention
  ].join('|'),
  'gu',
);
// #endregion learn:entity-pattern-single-regex

/** Dấu câu cuối câu không thuộc về URL: "xem https://a.com/x." */
const TRAILING_URL_PUNCTUATION = /[.,;:!?)\]}'"…]+$/u;

export type UsersByHandle = Readonly<Record<string, Pick<User, 'id'>>>;

/** Tạo bảng tra handle (viết thường) → user từ usersById của store. */
export function buildUsersByHandle(usersById: Readonly<Record<string, User>>): Record<string, User> {
  const byHandle: Record<string, User> = {};
  for (const user of Object.values(usersById)) byHandle[user.handle.toLowerCase()] = user;
  return byHandle;
}

// 📖 Bài học lesson-10 §4 – chuẩn hoá NFC trước rồi mới tính offset UTF-16 (docs/lessons/lesson-10.md)
// #region learn:parse-composer-text
export function parseComposerText(rawText: string, usersByHandle: UsersByHandle): ParsedComposerText {
  const text = rawText.normalize('NFC');
  const entities: TextEntity[] = [];

  for (const match of text.matchAll(ENTITY_PATTERN)) {
    const start = match.index ?? 0;
    const full = match[0];
    const [, rawUrl, tag, handle] = match;

    if (rawUrl !== undefined) {
      const url = rawUrl.replace(TRAILING_URL_PUNCTUATION, '');
      if (!isHttpUrl(url)) continue;
      entities.push({ type: 'link', start, end: start + url.length, url });
    } else if (tag !== undefined) {
      if (!/\p{L}/u.test(tag)) continue; // "#123" không phải hashtag
      // Hashtag không phân biệt hoa thường: lưu dạng thường để "#Frontend" và "#frontend" là một.
      // toLowerCase (không phải toLocaleLowerCase): kết quả không được phụ thuộc locale máy – locale Thổ Nhĩ Kỳ biến "I" thành "ı".
      entities.push({ type: 'hashtag', start, end: start + full.length, tag: tag.toLowerCase() });
    } else if (handle !== undefined) {
      const user = usersByHandle[handle.toLowerCase()];
      if (!user) continue; // @handle không tồn tại → chỉ là chữ thường, không tạo entity
      entities.push({ type: 'mention', start, end: start + full.length, userId: user.id });
    }
  }
  return { text, entities };
}
// #endregion learn:parse-composer-text

function isHttpUrl(value: string) {
  try {
    const { protocol } = new URL(value);
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
}
