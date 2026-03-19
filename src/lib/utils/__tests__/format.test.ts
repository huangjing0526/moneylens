import { describe, it, expect } from 'vitest';
import {
  formatCurrency,
  formatAmount,
  getMonthRange,
  getCurrentYearMonth,
  getPreviousYearMonth,
} from '@/lib/utils/format';

describe('formatCurrency', () => {
  it('正数 100 → ¥100.00', () => {
    expect(formatCurrency(100)).toBe('¥100.00');
  });

  it('负数 -50.5 → -¥50.50', () => {
    expect(formatCurrency(-50.5)).toBe('-¥50.50');
  });

  it('零 0 → ¥0.00', () => {
    expect(formatCurrency(0)).toBe('¥0.00');
  });

  it('负零 -0 → ¥0.00', () => {
    expect(formatCurrency(-0)).toBe('¥0.00');
  });

  it('大数含千分位 1234567.89', () => {
    const result = formatCurrency(1234567.89);
    expect(result).toMatch(/¥/);
    expect(result).toContain('1,234,567.89');
  });

  it('小数精度不足 9.9 → ¥9.90', () => {
    expect(formatCurrency(9.9)).toBe('¥9.90');
  });

  it('极小值 0.01 → ¥0.01', () => {
    expect(formatCurrency(0.01)).toBe('¥0.01');
  });

  it('极小负值 -0.01 → -¥0.01', () => {
    expect(formatCurrency(-0.01)).toBe('-¥0.01');
  });

  it('整数 500 → ¥500.00', () => {
    expect(formatCurrency(500)).toBe('¥500.00');
  });

  it('超多小数位 1.999 → ¥2.00（四舍五入）', () => {
    expect(formatCurrency(1.999)).toBe('¥2.00');
  });
});

describe('formatAmount', () => {
  it('小额 500 → ¥500.00', () => {
    expect(formatAmount(500)).toBe('¥500.00');
  });

  it('零 0 → ¥0.00', () => {
    expect(formatAmount(0)).toBe('¥0.00');
  });

  it('恰好10000 → ¥1.0万', () => {
    expect(formatAmount(10000)).toBe('¥1.0万');
  });

  it('9999.99 不进万', () => {
    expect(formatAmount(9999.99)).toBe('¥9,999.99');
  });

  it('25000 → ¥2.5万', () => {
    expect(formatAmount(25000)).toBe('¥2.5万');
  });

  it('100万 → ¥100.0万', () => {
    expect(formatAmount(1000000)).toBe('¥100.0万');
  });

  it('负数取绝对值 -500 → ¥500.00', () => {
    expect(formatAmount(-500)).toBe('¥500.00');
  });

  it('负大额 -20000 → ¥2.0万', () => {
    expect(formatAmount(-20000)).toBe('¥2.0万');
  });

  it('15555 → ¥1.6万（toFixed(1) 四舍五入）', () => {
    expect(formatAmount(15555)).toBe('¥1.6万');
  });
});

describe('getMonthRange', () => {
  it('1月31天', () => {
    const { start, end } = getMonthRange('2024-01');
    expect(start).toBe('2024-01-01');
    expect(end).toBe('2024-01-31');
  });

  it('闰年2月29天', () => {
    const { start, end } = getMonthRange('2024-02');
    expect(start).toBe('2024-02-01');
    expect(end).toBe('2024-02-29');
  });

  it('非闰年2月28天', () => {
    const { start, end } = getMonthRange('2023-02');
    expect(start).toBe('2023-02-01');
    expect(end).toBe('2023-02-28');
  });

  it('4月30天', () => {
    const { start, end } = getMonthRange('2024-04');
    expect(start).toBe('2024-04-01');
    expect(end).toBe('2024-04-30');
  });

  it('12月31天', () => {
    const { start, end } = getMonthRange('2024-12');
    expect(start).toBe('2024-12-01');
    expect(end).toBe('2024-12-31');
  });

  it('世纪闰年 2000-02 → 29天', () => {
    const { end } = getMonthRange('2000-02');
    expect(end).toBe('2000-02-29');
  });

  it('非闰百年 1900-02 → 28天', () => {
    const { end } = getMonthRange('1900-02');
    expect(end).toBe('1900-02-28');
  });
});

describe('getCurrentYearMonth', () => {
  it('格式匹配 YYYY-MM', () => {
    expect(getCurrentYearMonth()).toMatch(/^\d{4}-\d{2}$/);
  });

  it('值与当前 Date 一致', () => {
    const now = new Date();
    const expected = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    expect(getCurrentYearMonth()).toBe(expected);
  });
});

describe('getPreviousYearMonth', () => {
  it('普通月 2024-06 → 2024-05', () => {
    expect(getPreviousYearMonth('2024-06')).toBe('2024-05');
  });

  it('1月跨年 2024-01 → 2023-12', () => {
    expect(getPreviousYearMonth('2024-01')).toBe('2023-12');
  });

  it('补零 2024-10 → 2024-09', () => {
    expect(getPreviousYearMonth('2024-10')).toBe('2024-09');
  });

  it('3月→2月 2024-03 → 2024-02', () => {
    expect(getPreviousYearMonth('2024-03')).toBe('2024-02');
  });

  it('12月 2024-12 → 2024-11', () => {
    expect(getPreviousYearMonth('2024-12')).toBe('2024-11');
  });
});
