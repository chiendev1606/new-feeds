import { describe, expect, it } from 'vitest';
import { formatVitalValue, rateVital } from './web-vitals-rating';

describe('rateVital – phân loại theo budget', () => {
  it('LCP: ≤2500 good, ≤4000 needs-improvement, còn lại poor (biên bao gồm)', () => {
    expect(rateVital('LCP', 1800)).toBe('good');
    expect(rateVital('LCP', 2500)).toBe('good');
    expect(rateVital('LCP', 2501)).toBe('needs-improvement');
    expect(rateVital('LCP', 4000)).toBe('needs-improvement');
    expect(rateVital('LCP', 4001)).toBe('poor');
  });

  it('INP: ≤200 good, ≤500 needs-improvement, còn lại poor', () => {
    expect(rateVital('INP', 200)).toBe('good');
    expect(rateVital('INP', 201)).toBe('needs-improvement');
    expect(rateVital('INP', 500)).toBe('needs-improvement');
    expect(rateVital('INP', 501)).toBe('poor');
  });

  it('CLS: ≤0.1 good, ≤0.25 needs-improvement, còn lại poor', () => {
    expect(rateVital('CLS', 0)).toBe('good');
    expect(rateVital('CLS', 0.1)).toBe('good');
    expect(rateVital('CLS', 0.11)).toBe('needs-improvement');
    expect(rateVital('CLS', 0.25)).toBe('needs-improvement');
    expect(rateVital('CLS', 0.26)).toBe('poor');
  });

  it('long-task: 300ms là poor', () => {
    expect(rateVital('long-task', 300)).toBe('poor');
  });
});

describe('formatVitalValue', () => {
  it('CLS không có đơn vị, còn lại là ms làm tròn', () => {
    expect(formatVitalValue('CLS', 0.0456)).toBe('0.046');
    expect(formatVitalValue('LCP', 1234.6)).toBe('1235ms');
  });
});
