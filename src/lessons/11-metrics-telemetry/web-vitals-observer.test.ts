import { describe, expect, it } from 'vitest';
import { accumulateLayoutShift, INITIAL_CLS_STATE } from './web-vitals-observer';

const shift = (value: number, startTime: number, hadRecentInput = false) => ({ value, startTime, hadRecentInput });

describe('accumulateLayoutShift – cửa sổ phiên của CLS', () => {
  it('cộng dồn các dịch chuyển cách nhau ≤ 1s trong cùng cửa sổ', () => {
    let state = accumulateLayoutShift(INITIAL_CLS_STATE, shift(0.05, 100));
    state = accumulateLayoutShift(state, shift(0.04, 900));
    expect(state.worst).toBeCloseTo(0.09);
  });

  it('nghỉ > 1s thì mở cửa sổ mới, CLS = cửa sổ tệ nhất', () => {
    let state = accumulateLayoutShift(INITIAL_CLS_STATE, shift(0.2, 100));
    state = accumulateLayoutShift(state, shift(0.05, 2000));
    expect(state.sessionValue).toBeCloseTo(0.05);
    expect(state.worst).toBeCloseTo(0.2);
  });

  it('cửa sổ dài quá 5s thì tách dù không nghỉ', () => {
    let state = INITIAL_CLS_STATE;
    for (let time = 0; time <= 6000; time += 900) state = accumulateLayoutShift(state, shift(0.01, time));
    expect(state.worst).toBeLessThan(0.07);
  });

  it('bỏ qua dịch chuyển ngay sau input người dùng', () => {
    expect(accumulateLayoutShift(INITIAL_CLS_STATE, shift(0.5, 100, true))).toBe(INITIAL_CLS_STATE);
  });
});
