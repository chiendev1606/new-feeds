/**
 * Phân loại Core Web Vitals theo "budget" (ngân sách hiệu năng) – hàm THUẦN, test được không cần trình duyệt.
 *
 * Ý tưởng system design: "nhanh" phải là một con số có ngưỡng, không phải cảm giác. Mỗi chỉ số có
 * hai ngưỡng: ≤ good là tốt, ≤ poor là cần cải thiện, vượt quá là kém. Ngưỡng lấy theo web.dev
 * (đo ở p75 của người dùng thật). Cùng một bảng ngưỡng dùng cho cả UI (tô màu) lẫn cảnh báo.
 */
import type { WebVitalName } from '../../../shared-contracts/feed-api-contracts';

export type VitalRating = 'good' | 'needs-improvement' | 'poor';

export interface VitalBudget {
  /** Giá trị tối đa còn được coi là "tốt". */
  good: number;
  /** Giá trị tối đa còn được coi là "cần cải thiện"; vượt quá = "kém". */
  needsImprovement: number;
  unit: 'ms' | '';
  label: string;
}

// 📖 Bài học lesson-11 §3 – ngân sách hiệu năng có ngưỡng rõ ràng (docs/lessons/lesson-11.md)
// #region learn:vital-budgets-and-rating
export const VITAL_BUDGETS: Record<WebVitalName, VitalBudget> = {
  LCP: { good: 2500, needsImprovement: 4000, unit: 'ms', label: 'Largest Contentful Paint' },
  INP: { good: 200, needsImprovement: 500, unit: 'ms', label: 'Interaction to Next Paint (gần đúng)' },
  CLS: { good: 0.1, needsImprovement: 0.25, unit: '', label: 'Cumulative Layout Shift' },
  // Long task: theo định nghĩa là tác vụ > 50ms chặn main thread; > 200ms là chắc chắn người dùng thấy đơ.
  'long-task': { good: 50, needsImprovement: 200, unit: 'ms', label: 'Long task (tác vụ chặn main thread)' },
};

/** Biên là "bao gồm": đúng bằng ngưỡng vẫn thuộc nhóm tốt hơn (LCP = 2500 → good). */
export function rateVital(name: WebVitalName, value: number): VitalRating {
  const budget = VITAL_BUDGETS[name];
  if (value <= budget.good) return 'good';
  if (value <= budget.needsImprovement) return 'needs-improvement';
  return 'poor';
}
// #endregion learn:vital-budgets-and-rating

export function formatVitalValue(name: WebVitalName, value: number): string {
  return name === 'CLS' ? value.toFixed(3) : `${Math.round(value)}ms`;
}
