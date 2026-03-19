import { describe, it, expect } from 'vitest';
import { isAlipayCSV, parseAlipayCSV } from '../alipay';

describe('isAlipayCSV', () => {
  it('detects Alipay by 交易号 + 交易状态', () => {
    expect(isAlipayCSV(['交易号', '交易状态', '其他'])).toBe(true);
  });

  it('detects Alipay by 交易订单号 + 交易金额', () => {
    expect(isAlipayCSV(['交易订单号', '交易金额', '其他'])).toBe(true);
  });

  it('detects Alipay by 商家订单号 + 收/支', () => {
    expect(isAlipayCSV(['商家订单号', '收/支', '描述'])).toBe(true);
  });

  it('detects Alipay by 交易对方 + 交易状态 + 金额', () => {
    expect(isAlipayCSV(['交易对方', '交易状态', '金额', '日期'])).toBe(true);
  });

  it('handles headers with whitespace/tabs', () => {
    expect(isAlipayCSV([' 交易号\t', '\t交易状态 ', '其他'])).toBe(true);
  });

  it('rejects non-Alipay headers', () => {
    expect(isAlipayCSV(['日期', '金额', '描述'])).toBe(false);
  });

  it('rejects empty headers', () => {
    expect(isAlipayCSV([])).toBe(false);
  });
});

describe('parseAlipayCSV', () => {
  it('parses standard Alipay expense rows', () => {
    const rows = [{
      '交易创建时间': '2024-01-15 12:30:00',
      '交易金额': '50.00',
      '收/支': '支出',
      '商品说明': '午餐',
      '交易对方': '饿了么',
      '交易号': 'ALI2024011500001',
      '交易状态': '交易成功',
      '收/付款方式': '花呗',
      '备注': '',
    }];

    const result = parseAlipayCSV(rows);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      source: 'alipay',
      source_id: 'ALI2024011500001',
      date: '2024-01-15',
      time: '12:30:00',
      amount: -50,
      type: 'expense',
      description: '午餐',
      counterparty: '饿了么',
      payment_method: '花呗',
    });
  });

  it('parses income rows', () => {
    const rows = [{
      '交易创建时间': '2024-01-15 09:00:00',
      '交易金额': '200.00',
      '收/支': '收入',
      '商品说明': '转账',
      '交易对方': '张三',
      '交易号': 'ALI2024011500002',
      '交易状态': '交易成功',
      '收/付款方式': '余额',
      '备注': '',
    }];

    const result = parseAlipayCSV(rows);
    expect(result).toHaveLength(1);
    expect(result[0].amount).toBe(200);
    expect(result[0].type).toBe('income');
  });

  it('handles refunds as income', () => {
    const rows = [{
      '交易创建时间': '2024-01-15 10:00:00',
      '交易金额': '30.00',
      '收/支': '支出',
      '商品说明': '退款-午餐',
      '交易对方': '饿了么',
      '交易号': 'ALI2024011500003',
      '交易状态': '退款成功',
      '收/付款方式': '余额',
      '备注': '',
      '交易分类': '',
    }];

    const result = parseAlipayCSV(rows);
    expect(result).toHaveLength(1);
    expect(result[0].amount).toBe(30);
    expect(result[0].type).toBe('income');
  });

  it('skips closed transactions', () => {
    const rows = [{
      '交易创建时间': '2024-01-15 10:00:00',
      '交易金额': '100.00',
      '收/支': '支出',
      '商品说明': '取消的订单',
      '交易对方': '商家',
      '交易号': 'ALI2024011500004',
      '交易状态': '交易关闭',
      '收/付款方式': '',
      '备注': '',
    }];

    const result = parseAlipayCSV(rows);
    expect(result).toHaveLength(0);
  });

  it('skips zero amount rows', () => {
    const rows = [{
      '交易创建时间': '2024-01-15 10:00:00',
      '交易金额': '0.00',
      '收/支': '支出',
      '商品说明': '零元订单',
      '交易对方': '商家',
      '交易号': 'ALI2024011500005',
      '交易状态': '交易成功',
      '收/付款方式': '',
      '备注': '',
    }];

    const result = parseAlipayCSV(rows);
    expect(result).toHaveLength(0);
  });

  it('skips rows without date', () => {
    const rows = [{
      '交易创建时间': '',
      '交易金额': '50.00',
      '收/支': '支出',
      '商品说明': '无日期',
      '交易对方': '商家',
      '交易号': 'ALI2024011500006',
      '交易状态': '交易成功',
      '收/付款方式': '',
      '备注': '',
    }];

    const result = parseAlipayCSV(rows);
    expect(result).toHaveLength(0);
  });

  it('strips currency symbols from amounts', () => {
    const rows = [{
      '交易创建时间': '2024-01-15 12:00:00',
      '交易金额': '¥128.50',
      '收/支': '支出',
      '商品说明': '购物',
      '交易对方': '商家',
      '交易号': 'ALI001',
      '交易状态': '交易成功',
      '收/付款方式': '',
      '备注': '',
    }];

    const result = parseAlipayCSV(rows);
    expect(result).toHaveLength(1);
    expect(result[0].amount).toBe(-128.5);
  });

  it('handles date with slash format', () => {
    const rows = [{
      '交易创建时间': '2024/01/15 12:00:00',
      '交易金额': '50.00',
      '收/支': '支出',
      '商品说明': '购物',
      '交易对方': '商家',
      '交易号': 'ALI001',
      '交易状态': '交易成功',
      '收/付款方式': '',
      '备注': '',
    }];

    const result = parseAlipayCSV(rows);
    expect(result).toHaveLength(1);
    expect(result[0].date).toBe('2024-01-15');
  });

  it('uses alternative column names (金额（元）)', () => {
    const rows = [{
      '付款时间': '2024-01-15 12:00:00',
      '金额（元）': '50.00',
      '收/支': '支出',
      '商品名称': '午餐',
      '交易对方': '饿了么',
      '交易订单号': 'ALI001',
      '交易状态': '交易成功',
      '收/付款方式': '花呗',
      '备注': '无',
    }];

    const result = parseAlipayCSV(rows);
    expect(result).toHaveLength(1);
    expect(result[0].amount).toBe(-50);
    expect(result[0].description).toBe('午餐');
    expect(result[0].note).toBe('无');
  });

  it('parses multiple rows', () => {
    const rows = [
      {
        '交易创建时间': '2024-01-15 12:00:00',
        '交易金额': '50.00',
        '收/支': '支出',
        '商品说明': '午餐',
        '交易对方': '饿了么',
        '交易号': 'ALI001',
        '交易状态': '交易成功',
        '收/付款方式': '花呗',
        '备注': '',
      },
      {
        '交易创建时间': '2024-01-16 18:00:00',
        '交易金额': '100.00',
        '收/支': '收入',
        '商品说明': '转账',
        '交易对方': '朋友',
        '交易号': 'ALI002',
        '交易状态': '交易成功',
        '收/付款方式': '余额',
        '备注': '',
      },
    ];

    const result = parseAlipayCSV(rows);
    expect(result).toHaveLength(2);
    expect(result[0].amount).toBe(-50);
    expect(result[1].amount).toBe(100);
  });
});
