/**
 * "An, Bình và 3 người khác" bằng Intl.ListFormat – dấu phẩy, chữ "và"/"and"/"و" do trình duyệt lo theo locale.
 * Server chỉ gửi vài tên mẫu (không gồm chính viewer) + tổng số (không gửi cả danh sách người react).
 *
 * `totalOthers` = số người react KHÔNG tính chính viewer (nơi gọi trừ 1 nếu viewer đã react). Nếu không trừ, viewer đã
 * react sẽ thấy "An, Bình và 1 người khác" trong khi "người khác" đó chính là mình.
 * Tên không có trong store thì nơi gọi bỏ khỏi `names`: những người đó tự động rơi vào "N người khác" thay vì hiện raw id.
 */
import { formatCompactCount } from './format-compact-count';

// 📖 Bài học lesson-07 – Intl.ListFormat và cách đếm "N người khác" không tính viewer (docs/lessons/lesson-07.md)
// #region learn:reactor-list-format
const listFormatters = new Map<string, Intl.ListFormat>();

/** `plural` là kết quả Intl.PluralRules('one' | 'other' | …) – tiếng Anh cần "1 other" / "2 others"; tiếng Việt không chia số ít/nhiều. */
const OTHERS_LABEL: Record<string, (count: string, plural: Intl.LDMLPluralRule) => string> = {
  vi: (count) => `${count} người khác`,
  en: (count, plural) => (plural === 'one' ? `${count} other` : `${count} others`),
  ar: (count) => `${count} آخرين`,
};

export function formatReactorList(names: readonly string[], totalOthers: number, locale: string): string {
  if (names.length === 0) return '';
  let formatter = listFormatters.get(locale);
  if (!formatter) {
    formatter = new Intl.ListFormat(locale, { style: 'long', type: 'conjunction' });
    listFormatters.set(locale, formatter);
  }
  const others = totalOthers - names.length;
  const language = locale.split('-')[0] ?? 'vi';
  const othersLabel = (OTHERS_LABEL[language] ?? OTHERS_LABEL.vi!)(formatCompactCount(others, locale), new Intl.PluralRules(locale).select(others));
  return formatter.format(others > 0 ? [...names, othersLabel] : names);
}
// #endregion learn:reactor-list-format
