/**
 * Chọn các web vital "chốt" (LCP/CLS/INP) CẦN gửi lần này: chỉ những chỉ số có giá trị khác lần gửi trước.
 *
 * Vì sao: trang bị ẩn nhiều lần (đổi tab qua lại) – nếu mỗi lần ẩn đều gửi lại cùng một giá trị thì một page view
 * thành nhiều dòng LCP giống hệt, và p75 phía server bị lệch theo số lần đổi tab. web-vitals chính thức cũng chỉ báo
 * khi giá trị đổi (delta). Giá trị chưa đo được (undefined) thì bỏ qua.
 */
// 📖 Bài học lesson-11 §5 – chỉ gửi vital chốt khi giá trị khác lần trước (docs/lessons/lesson-11.md)
// #region learn:pick-changed-final-vitals
export const FINAL_VITAL_NAMES = ['LCP', 'CLS', 'INP'] as const;
export type FinalVitalName = (typeof FINAL_VITAL_NAMES)[number];
export type FinalVitalValues = Partial<Record<FinalVitalName, number>>;

export function pickChangedFinalVitals(current: FinalVitalValues, lastSent: FinalVitalValues): Array<{ name: FinalVitalName; value: number }> {
  return FINAL_VITAL_NAMES.flatMap((name) => {
    const value = current[name];
    return value !== undefined && value !== lastSent[name] ? [{ name, value }] : [];
  });
}
// #endregion learn:pick-changed-final-vitals
