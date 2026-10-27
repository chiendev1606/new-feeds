/**
 * Số đếm gọn (103K, 1,2 Tr) bằng Intl.NumberFormat notation "compact",
 * và chuỗi có số nhiều bằng Intl.PluralRules (tiếng Anh: 1 comment / 2 comments).
 * Formatter được cache theo locale: tạo Intl.* tốn kém, mà mỗi bài viết gọi vài lần mỗi lần render.
 */
const compactFormatters = new Map<string, Intl.NumberFormat>();
const pluralRules = new Map<string, Intl.PluralRules>();

export function formatCompactCount(value: number, locale: string) {
  let formatter = compactFormatters.get(locale);
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 });
    compactFormatters.set(locale, formatter);
  }
  return formatter.format(value);
}

const COMMENT_MESSAGES: Record<string, Partial<Record<Intl.LDMLPluralRule, string>> & { other: string }> = {
  vi: { other: '{n} bình luận' },
  en: { one: '{n} comment', other: '{n} comments' },
  ar: { zero: 'لا تعليقات', one: 'تعليق واحد', two: 'تعليقان', few: '{n} تعليقات', many: '{n} تعليقًا', other: '{n} تعليق' },
};

/** Phiên bản rút gọn của ICU MessageFormat: chọn chuỗi theo plural category của locale. */
export function formatCommentCount(value: number, locale: string) {
  const language = locale.split('-')[0] ?? 'vi';
  const messages = COMMENT_MESSAGES[language] ?? COMMENT_MESSAGES.vi!;
  let rules = pluralRules.get(locale);
  if (!rules) {
    rules = new Intl.PluralRules(locale);
    pluralRules.set(locale, rules);
  }
  return (messages[rules.select(value)] ?? messages.other).replace('{n}', formatCompactCount(value, locale));
}
