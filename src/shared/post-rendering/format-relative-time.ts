/**
 * Thời gian tương đối ("5 phút trước") bằng Intl – không cần thư viện, tự đúng theo ngôn ngữ.
 *
 * Server trả ISO timestamp thô; client format theo locale + múi giờ của người xem.
 * Cập nhật: một "đồng hồ" chung tick mỗi 60s (useNow) thay vì mỗi bài một setInterval.
 */
import { useEffect, useState } from 'react';

// 📖 Bài học lesson-07 – cache Intl formatter theo locale vì tạo rất tốn kém (docs/lessons/lesson-07.md)
// #region learn:intl-formatter-cache
/** Cache formatter theo locale (+ tuỳ chọn): tạo Intl.* tốn kém, mỗi bài gọi mỗi lần render. */
const formatterCache = new Map<string, Intl.RelativeTimeFormat | Intl.DateTimeFormat>();
function cached<T extends Intl.RelativeTimeFormat | Intl.DateTimeFormat>(key: string, create: () => T): T {
  let formatter = formatterCache.get(key) as T | undefined;
  if (!formatter) {
    formatter = create();
    formatterCache.set(key, formatter);
  }
  return formatter;
}
const relativeFormatter = (locale: string) => cached(`rel|${locale}`, () => new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }));
// #endregion learn:intl-formatter-cache

// 📖 Bài học lesson-07 – thời gian tương đối bằng Intl.RelativeTimeFormat (docs/lessons/lesson-07.md)
// #region learn:format-relative-time
const UNITS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ['day', 86_400],
  ['hour', 3_600],
  ['minute', 60],
];

export function formatRelativeTime(isoDate: string, now: number, locale: string): string {
  const date = new Date(isoDate);
  const diffSeconds = Math.round((date.getTime() - now) / 1000);
  const absSeconds = Math.abs(diffSeconds);

  if (absSeconds < 45) {
    return relativeFormatter(locale).format(0, 'second');
  }
  // Quá 7 ngày → hiện ngày tháng cụ thể.
  if (absSeconds >= 7 * 86_400) {
    const sameYear = date.getFullYear() === new Date(now).getFullYear();
    return cached(`date|${locale}|${sameYear}`, () => new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: sameYear ? undefined : 'numeric' })).format(date);
  }
  const formatter = relativeFormatter(locale);
  for (const [unit, seconds] of UNITS) {
    if (absSeconds >= seconds) return formatter.format(Math.round(diffSeconds / seconds), unit);
  }
  return formatter.format(diffSeconds, 'second');
}
// #endregion learn:format-relative-time

/** Dạng đầy đủ để đặt trong title/tooltip và cho screen reader. */
export function formatFullDateTime(isoDate: string, locale: string) {
  return cached(`full|${locale}`, () => new Intl.DateTimeFormat(locale, { dateStyle: 'full', timeStyle: 'short' })).format(new Date(isoDate));
}

// 📖 Bài học lesson-07 – một đồng hồ chung tick mỗi phút cho mọi timestamp (docs/lessons/lesson-07.md)
// #region learn:use-now-clock
/** "Bây giờ" dùng chung, tick mỗi intervalMs. Mọi timestamp re-render cùng lúc, 1 timer duy nhất. */
export function useNow(intervalMs = 60_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}
// #endregion learn:use-now-clock
