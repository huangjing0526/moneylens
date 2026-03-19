import { describe, it, expect } from 'vitest';
import { parseNaturalLanguage } from '../parser';
import { format, subDays, startOfWeek, addDays, getDay } from 'date-fns';

// Fixed "now" for deterministic tests: 2026-03-20, a Friday
const NOW = new Date(2026, 2, 20); // March 20, 2026
const TODAY = '2026-03-20';
const YESTERDAY = format(subDays(NOW, 1), 'yyyy-MM-dd');
const DAY_BEFORE_YESTERDAY = format(subDays(NOW, 2), 'yyyy-MM-dd');
const THREE_DAYS_AGO = format(subDays(NOW, 3), 'yyyy-MM-dd');

function lastWeekDay(dayIndex: number): string {
  const thisMonday = startOfWeek(NOW, { weekStartsOn: 1 });
  const lastMonday = subDays(thisMonday, 7);
  return format(addDays(lastMonday, dayIndex), 'yyyy-MM-dd');
}

function mostRecentDay(dayIndex: number): string {
  // dayIndex: Mon=0 .. Sun=6
  const currentDay = (getDay(NOW) + 6) % 7;
  let diff = currentDay - dayIndex;
  if (diff < 0) diff += 7;
  return format(subDays(NOW, diff), 'yyyy-MM-dd');
}

describe('parseNaturalLanguage', () => {
  // ── 1. Basic amount extraction (5 cases) ──

  describe('amount extraction', () => {
    it('parses plain number', () => {
      const r = parseNaturalLanguage('午饭 35', NOW)!;
      expect(r.amount).toBe(35);
    });

    it('parses number with 元', () => {
      const r = parseNaturalLanguage('午饭 35元', NOW)!;
      expect(r.amount).toBe(35);
    });

    it('parses number with 块', () => {
      const r = parseNaturalLanguage('午饭 35块', NOW)!;
      expect(r.amount).toBe(35);
    });

    it('parses ¥ prefix', () => {
      const r = parseNaturalLanguage('午饭 ¥35', NOW)!;
      expect(r.amount).toBe(35);
    });

    it('parses decimal amount', () => {
      const r = parseNaturalLanguage('咖啡 28.5', NOW)!;
      expect(r.amount).toBe(28.5);
    });

    it('parses large number', () => {
      const r = parseNaturalLanguage('发工资 15000', NOW)!;
      expect(r.amount).toBe(15000);
    });
  });

  // ── 2. Date extraction (8 cases) ──

  describe('date extraction', () => {
    it('parses 今天', () => {
      const r = parseNaturalLanguage('今天午饭 35', NOW)!;
      expect(r.date).toBe(TODAY);
    });

    it('parses 昨天', () => {
      const r = parseNaturalLanguage('昨天打车 28', NOW)!;
      expect(r.date).toBe(YESTERDAY);
    });

    it('parses 前天', () => {
      const r = parseNaturalLanguage('前天买菜 50', NOW)!;
      expect(r.date).toBe(DAY_BEFORE_YESTERDAY);
    });

    it('parses 大前天', () => {
      const r = parseNaturalLanguage('大前天聚餐 200', NOW)!;
      expect(r.date).toBe(THREE_DAYS_AGO);
    });

    it('parses 周X (most recent past)', () => {
      // 周三 — most recent Wednesday
      const r = parseNaturalLanguage('周三星巴克 38', NOW)!;
      expect(r.date).toBe(mostRecentDay(2)); // Wed=2
    });

    it('parses 星期X', () => {
      const r = parseNaturalLanguage('星期一开会 0', NOW);
      // 0 amount should return null, let's use a valid one
      const r2 = parseNaturalLanguage('星期一请客 100', NOW)!;
      expect(r2.date).toBe(mostRecentDay(0)); // Mon=0
    });

    it('parses 上周X', () => {
      const r = parseNaturalLanguage('上周三星巴克 38', NOW)!;
      expect(r.date).toBe(lastWeekDay(2)); // Wed=2
    });

    it('parses explicit date 3月15日', () => {
      const r = parseNaturalLanguage('3月15日 买书 99', NOW)!;
      expect(r.date).toBe('2026-03-15');
    });

    it('parses explicit date 3.15', () => {
      const r = parseNaturalLanguage('3.15 买书 99', NOW)!;
      expect(r.date).toBe('2026-03-15');
    });

    it('defaults to today when no date', () => {
      const r = parseNaturalLanguage('午饭 35', NOW)!;
      expect(r.date).toBe(TODAY);
    });
  });

  // ── 3. Income detection (4 cases) ──

  describe('income detection', () => {
    it('detects 工资 as income', () => {
      const r = parseNaturalLanguage('发工资 15000', NOW)!;
      expect(r.type).toBe('income');
    });

    it('detects 退款 as income', () => {
      const r = parseNaturalLanguage('退款 50', NOW)!;
      expect(r.type).toBe('income');
    });

    it('detects 红包 as income', () => {
      const r = parseNaturalLanguage('收到红包 200', NOW)!;
      expect(r.type).toBe('income');
    });

    it('detects 报销 as income', () => {
      const r = parseNaturalLanguage('报销差旅费 3000', NOW)!;
      expect(r.type).toBe('income');
    });
  });

  // ── 4. Description extraction (4 cases) ──

  describe('description extraction', () => {
    it('extracts description before amount', () => {
      const r = parseNaturalLanguage('午饭 35', NOW)!;
      expect(r.description).toBe('午饭');
    });

    it('extracts description after amount', () => {
      const r = parseNaturalLanguage('35 午饭', NOW)!;
      expect(r.description).toBe('午饭');
    });

    it('extracts description mixed with date', () => {
      const r = parseNaturalLanguage('昨天打车到公司 28', NOW)!;
      expect(r.description).toBe('打车到公司');
      expect(r.date).toBe(YESTERDAY);
    });

    it('handles only amount (no description)', () => {
      const r = parseNaturalLanguage('35', NOW)!;
      expect(r.description).toBe('');
      expect(r.confidence).toBe(0.8);
    });
  });

  // ── 5. Edge cases (6 cases) ──

  describe('edge cases', () => {
    it('returns null for empty string', () => {
      expect(parseNaturalLanguage('', NOW)).toBeNull();
    });

    it('returns null for only spaces', () => {
      expect(parseNaturalLanguage('   ', NOW)).toBeNull();
    });

    it('returns null for no amount', () => {
      expect(parseNaturalLanguage('午饭', NOW)).toBeNull();
    });

    it('picks last number as amount when multiple numbers present', () => {
      // "3月15 买书 99" — 15 is part of date, 99 is the amount
      const r = parseNaturalLanguage('3月15 买书 99', NOW)!;
      expect(r.amount).toBe(99);
      expect(r.description).toBe('买书');
    });

    it('handles ￥ (fullwidth) prefix', () => {
      const r = parseNaturalLanguage('午饭 ￥35', NOW)!;
      expect(r.amount).toBe(35);
    });

    it('handles whitespace around amount', () => {
      const r = parseNaturalLanguage('  午饭   35  ', NOW)!;
      expect(r.amount).toBe(35);
      expect(r.description).toBe('午饭');
    });
  });

  // ── 6. Full integration examples from spec ──

  describe('integration examples', () => {
    it('午饭 35', () => {
      const r = parseNaturalLanguage('午饭 35', NOW)!;
      expect(r).toMatchObject({
        amount: 35,
        date: TODAY,
        type: 'expense',
        description: '午饭',
        confidence: 1.0,
      });
    });

    it('昨天打车到公司 28', () => {
      const r = parseNaturalLanguage('昨天打车到公司 28', NOW)!;
      expect(r).toMatchObject({
        amount: 28,
        date: YESTERDAY,
        type: 'expense',
        description: '打车到公司',
        confidence: 1.0,
      });
    });

    it('发工资 15000', () => {
      const r = parseNaturalLanguage('发工资 15000', NOW)!;
      expect(r).toMatchObject({
        amount: 15000,
        date: TODAY,
        type: 'income',
        description: '发工资',
        confidence: 1.0,
      });
    });

    it('35 (amount only)', () => {
      const r = parseNaturalLanguage('35', NOW)!;
      expect(r).toMatchObject({
        amount: 35,
        date: TODAY,
        type: 'expense',
        description: '',
        confidence: 0.8,
      });
    });

    it('退款 50', () => {
      const r = parseNaturalLanguage('退款 50', NOW)!;
      expect(r).toMatchObject({
        amount: 50,
        date: TODAY,
        type: 'income',
        description: '退款',
        confidence: 1.0,
      });
    });
  });
});
