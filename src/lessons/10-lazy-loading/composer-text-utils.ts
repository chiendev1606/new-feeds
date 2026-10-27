/**
 * Hàm thuần cho composer: làm sạch text dán vào và chèn text tại vị trí con trỏ.
 *
 * Paste là cửa ngõ nhập liệu rủi ro nhất của composer: clipboard có thể chứa HTML (style/script rác, theo
 * dõi), ký tự điều khiển, ký tự vô hình dùng để giả mạo (spoofing) hoặc làm hỏng offset của entity.
 * Chiến lược: KHÔNG tin định dạng từ ngoài, chỉ lấy text/plain rồi lọc.
 */

// 📖 Bài học lesson-10 §5 – lọc ký tự điều khiển, zero-width và bidi khỏi text dán vào (docs/lessons/lesson-10.md)
// #region learn:sanitize-pasted-text
/**
 * Ký tự bị loại:
 *  - C0/C1 control (trừ \t và \n)
 *  - zero-width space U+200B, word joiner U+2060, BOM U+FEFF
 *  - bidi override/embedding/isolate (U+202A–202E, U+2066–2069): dùng để đảo thứ tự hiển thị, giả link
 * Cố ý GIỮ ZWJ (U+200D) và ZWNJ (U+200C): ZWJ ghép emoji gia đình/nghề nghiệp (👨‍👩‍👧), ZWNJ cần cho chữ Ba Tư.
 * U+200E/200F (dấu hướng LRM/RLM) cũng giữ vì chữ RTL hợp lệ dùng chúng.
 */
// Dựng từ mã số thay vì gõ ký tự vô hình/escape vào regex literal: đọc được, và editor không làm mất ký tự.
const cp = (code: number) => String.fromCodePoint(code);
const range = (from: number, to: number) => `${cp(from)}-${cp(to)}`;
const UNWANTED_CHARS = new RegExp(
  `[${[range(0x00, 0x08), cp(0x0b), cp(0x0c), range(0x0e, 0x1f), range(0x7f, 0x9f), cp(0x200b), cp(0x2060), cp(0xfeff), range(0x202a, 0x202e), range(0x2066, 0x2069)].join('')}]`,
  'g',
);
const LINE_SEPARATORS = new RegExp(`[${cp(0x2028)}${cp(0x2029)}]`, 'g');

export function sanitizePastedText(raw: string): string {
  return raw
    .replace(/\r\n?/g, '\n')
    .replace(LINE_SEPARATORS, '\n')
    .replace(UNWANTED_CHARS, '');
}
// #endregion learn:sanitize-pasted-text

export interface SpliceResult {
  value: string;
  /** Vị trí con trỏ sau khi chèn. */
  caret: number;
}

// 📖 Bài học lesson-10 §5 – chèn text không cắt đôi cặp surrogate (docs/lessons/lesson-10.md)
// #region learn:splice-without-cutting-surrogate
/**
 * Thay đoạn [start, end) của `value` bằng `insert`, không vượt `maxLength`.
 * Không cắt đôi một cặp surrogate (emoji): nếu điểm cắt rơi giữa cặp thì lùi lại 1 đơn vị.
 */
export function spliceAtSelection(value: string, start: number, end: number, insert: string, maxLength: number): SpliceResult {
  const from = Math.max(0, Math.min(start, end, value.length));
  const to = Math.min(value.length, Math.max(start, end));
  const room = Math.max(0, maxLength - (value.length - (to - from)));
  let accepted = insert.slice(0, room);
  const lastCode = accepted.charCodeAt(accepted.length - 1);
  if (accepted.length < insert.length && lastCode >= 0xd800 && lastCode <= 0xdbff) accepted = accepted.slice(0, -1);
  return { value: value.slice(0, from) + accepted + value.slice(to), caret: from + accepted.length };
}
// #endregion learn:splice-without-cutting-surrogate
