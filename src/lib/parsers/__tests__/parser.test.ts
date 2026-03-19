import { describe, it, expect } from 'vitest';
import { parseCSV } from '../index';

function makeCSVBuffer(content: string): Buffer {
  return Buffer.from(content, 'utf-8');
}

describe('parseCSV', () => {
  describe('Source detection', () => {
    it('detects Alipay CSV format', () => {
      const csv = `交易号,交易创建时间,交易金额,收/支,商品说明,交易对方,交易状态,收/付款方式,备注
ALI001,2024-01-15 12:00:00,50.00,支出,午餐,饿了么,交易成功,花呗,`;
      const result = parseCSV(makeCSVBuffer(csv), 'alipay.csv');
      expect(result.source).toBe('alipay');
      expect(result.transactions).toHaveLength(1);
    });

    it('detects WeChat CSV format', () => {
      const csv = `交易时间,交易类型,交易对方,商品,收/支,金额(元),支付方式,当前状态,交易单号
2024-01-15 12:00:00,商户消费,麦当劳,午餐,支出,35.00,零钱,支付成功,WX001`;
      const result = parseCSV(makeCSVBuffer(csv), 'wechat.csv');
      expect(result.source).toBe('wechat');
      expect(result.transactions).toHaveLength(1);
    });

    it('falls back to generic bank format', () => {
      const csv = `日期,金额,描述,类型
2024-01-15,50.00,午餐,支出`;
      const result = parseCSV(makeCSVBuffer(csv), 'bank.csv');
      expect(result.source).toBe('bank');
    });
  });

  describe('Meta line skipping', () => {
    it('skips meta lines before actual CSV headers', () => {
      const csv = `支付宝交易记录明细
账户: test@example.com
起始日期: 2024-01-01

交易号,交易创建时间,交易金额,收/支,商品说明,交易对方,交易状态,收/付款方式,备注
ALI001,2024-01-15 12:00:00,50.00,支出,午餐,饿了么,交易成功,花呗,`;
      const result = parseCSV(makeCSVBuffer(csv), 'alipay.csv');
      expect(result.source).toBe('alipay');
      expect(result.transactions).toHaveLength(1);
    });
  });

  describe('Generic CSV parsing', () => {
    it('parses generic CSV with standard column names', () => {
      const csv = `日期,金额,描述,收/支,交易对方
2024-01-15,-50.00,午餐消费,支出,饿了么
2024-01-16,200.00,工资,收入,公司`;
      const result = parseCSV(makeCSVBuffer(csv), 'bank.csv');
      expect(result.transactions).toHaveLength(2);
      expect(result.transactions[0].amount).toBe(-50);
      expect(result.transactions[0].type).toBe('expense');
      expect(result.transactions[1].amount).toBe(200);
      expect(result.transactions[1].type).toBe('income');
    });

    it('handles various date formats', () => {
      const csv = `交易日期,交易金额,摘要
2024/01/15,50.00,消费A
2024-02-20,30.00,消费B`;
      const result = parseCSV(makeCSVBuffer(csv), 'test.csv');
      expect(result.transactions.length).toBeGreaterThanOrEqual(1);
      // Slash dates should be converted to dashes
      expect(result.transactions[0].date).toBe('2024-01-15');
    });

    it('handles amounts with currency symbols', () => {
      const csv = `日期,金额,描述
2024-01-15,¥50.00,消费`;
      const result = parseCSV(makeCSVBuffer(csv), 'test.csv');
      expect(result.transactions).toHaveLength(1);
      // Amount should have ¥ stripped
      expect(Math.abs(result.transactions[0].amount)).toBe(50);
    });

    it('skips rows with zero amount', () => {
      const csv = `日期,金额,描述
2024-01-15,0.00,零元`;
      const result = parseCSV(makeCSVBuffer(csv), 'test.csv');
      expect(result.transactions).toHaveLength(0);
    });

    it('skips rows with invalid date', () => {
      const csv = `日期,金额,描述
无效日期,50.00,消费`;
      const result = parseCSV(makeCSVBuffer(csv), 'test.csv');
      expect(result.transactions).toHaveLength(0);
    });

    it('pads single-digit month and day', () => {
      const csv = `日期,金额,描述
2024-1-5,50.00,消费`;
      const result = parseCSV(makeCSVBuffer(csv), 'test.csv');
      expect(result.transactions).toHaveLength(1);
      expect(result.transactions[0].date).toBe('2024-01-05');
    });

    it('extracts time from datetime fields', () => {
      const csv = `交易日期,金额,描述
2024-01-15 14:30:00,50.00,消费`;
      const result = parseCSV(makeCSVBuffer(csv), 'test.csv');
      expect(result.transactions).toHaveLength(1);
      expect(result.transactions[0].time).toBe('14:30:00');
    });

    it('guesses columns from data when headers dont match', () => {
      const csv = `Col1,Col2,Col3
2024-01-15,50.00,一些描述`;
      const result = parseCSV(makeCSVBuffer(csv), 'test.csv');
      expect(result.transactions).toHaveLength(1);
    });

    it('returns empty when no date/amount columns found', () => {
      const csv = `名称,备注
项目A,无
项目B,无`;
      const result = parseCSV(makeCSVBuffer(csv), 'test.csv');
      expect(result.transactions).toHaveLength(0);
    });
  });

  describe('Edge cases', () => {
    it('handles empty CSV', () => {
      const csv = '';
      const result = parseCSV(makeCSVBuffer(csv), 'empty.csv');
      expect(result.transactions).toHaveLength(0);
    });

    it('handles CSV with only headers', () => {
      const csv = '日期,金额,描述';
      const result = parseCSV(makeCSVBuffer(csv), 'empty.csv');
      expect(result.transactions).toHaveLength(0);
    });

    it('handles commas in amount (1,000.00)', () => {
      const csv = `日期,金额,描述
2024-01-15,"1,000.50",大额消费`;
      const result = parseCSV(makeCSVBuffer(csv), 'test.csv');
      expect(result.transactions).toHaveLength(1);
      expect(Math.abs(result.transactions[0].amount)).toBe(1000.5);
    });
  });
});
