import { describe, expect, it } from 'vitest';
import { pickChangedFinalVitals } from './changed-final-vitals';

describe('pickChangedFinalVitals', () => {
  it('lần đầu: gửi mọi chỉ số đã đo, bỏ chỉ số chưa có', () => {
    expect(pickChangedFinalVitals({ LCP: 1200, CLS: 0.02 }, {})).toEqual([
      { name: 'LCP', value: 1200 },
      { name: 'CLS', value: 0.02 },
    ]);
  });

  it('giá trị không đổi so với lần gửi trước → không gửi lại (ẩn tab nhiều lần)', () => {
    expect(pickChangedFinalVitals({ LCP: 1200, CLS: 0.02 }, { LCP: 1200, CLS: 0.02 })).toEqual([]);
  });

  it('chỉ gửi chỉ số đã đổi', () => {
    expect(pickChangedFinalVitals({ LCP: 1200, CLS: 0.05, INP: 80 }, { LCP: 1200, CLS: 0.02 })).toEqual([
      { name: 'CLS', value: 0.05 },
      { name: 'INP', value: 80 },
    ]);
  });
});
