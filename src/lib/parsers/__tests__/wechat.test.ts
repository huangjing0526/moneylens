import { describe, it, expect } from 'vitest';
import { isWechatCSV, parseWechatCSV } from '../wechat';

describe('isWechatCSV', () => {
  it('detects WeChat by 商品 + 交易对方 + 收/支', () => {
    expect(isWechatCSV(['商品', '交易对方', '收/支', '金额(元)'])).toBe(true);
  });

  it('detects WeChat by 金额(元) + 交易对方', () => {
    expect(isWechatCSV(['金额(元)', '交易对方', '交易时间'])).toBe(true);
  });

  it('detects WeChat by 交易类型 + 商品 + 收/支', () => {
    expect(isWechatCSV(['交易类型', '商品', '收/支'])).toBe(true);
  });

  it('rejects non-WeChat headers', () => {
    expect(isWechatCSV(['交易号', '交易状态', '金额'])).toBe(false);
  });

  it('rejects empty headers', () => {
    expect(isWechatCSV([])).toBe(false);
  });

  it('handles whitespace in headers', () => {
    expect(isWechatCSV([' 商品\t', '\t交易对方 ', ' 收/支'])).toBe(true);
  });
});

describe('parseWechatCSV', () => {
  it('parses standard WeChat expense rows', () => {
    const rows = [{
      '交易时间': '2024-01-15 12:30:00',
      '金额(元)': '¥35.00',
      '收/支': '支出',
      '商品': '午餐',
      '交易对方': '麦当劳',
      '交易单号': 'WX2024011500001',
      '当前状态': '支付成功',
      '支付方式': '零钱',
    }];

    const result = parseWechatCSV(rows);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      source: 'wechat',
      source_id: 'WX2024011500001',
      date: '2024-01-15',
      time: '12:30:00',
      amount: -35,
      type: 'expense',
      description: '午餐',
      counterparty: '麦当劳',
      payment_method: '零钱',
    });
  });

  it('parses income rows', () => {
    const rows = [{
      '交易时间': '2024-01-15 09:00:00',
      '金额(元)': '500.00',
      '收/支': '收入',
      '商品': '转账',
      '交易对方': '张三',
      '交易单号': 'WX002',
      '当前状态': '已收入',
      '支付方式': '零钱',
    }];

    const result = parseWechatCSV(rows);
    expect(result).toHaveLength(1);
    expect(result[0].amount).toBe(500);
    expect(result[0].type).toBe('income');
  });

  it('handles refunds (已退款) as income', () => {
    const rows = [{
      '交易时间': '2024-01-15 10:00:00',
      '金额(元)': '20.00',
      '收/支': '支出',
      '商品': '退款',
      '交易对方': '商家',
      '交易单号': 'WX003',
      '当前状态': '已退款',
      '支付方式': '零钱',
    }];

    const result = parseWechatCSV(rows);
    expect(result).toHaveLength(1);
    expect(result[0].amount).toBe(20);
    expect(result[0].type).toBe('income');
  });

  it('skips rows with "/" as 收/支 (non income/expense)', () => {
    const rows = [{
      '交易时间': '2024-01-15 10:00:00',
      '金额(元)': '100.00',
      '收/支': '/',
      '商品': '红包',
      '交易对方': '某人',
      '交易单号': 'WX004',
      '当前状态': '已转账',
      '支付方式': '',
    }];

    const result = parseWechatCSV(rows);
    expect(result).toHaveLength(0);
  });

  it('skips rows with empty 收/支', () => {
    const rows = [{
      '交易时间': '2024-01-15 10:00:00',
      '金额(元)': '100.00',
      '收/支': '',
      '商品': '红包',
      '交易对方': '某人',
      '交易单号': 'WX005',
      '当前状态': '已转账',
      '支付方式': '',
    }];

    const result = parseWechatCSV(rows);
    expect(result).toHaveLength(0);
  });

  it('skips zero amount rows', () => {
    const rows = [{
      '交易时间': '2024-01-15 10:00:00',
      '金额(元)': '0.00',
      '收/支': '支出',
      '商品': '零元活动',
      '交易对方': '商家',
      '交易单号': 'WX006',
      '当前状态': '支付成功',
      '支付方式': '',
    }];

    const result = parseWechatCSV(rows);
    expect(result).toHaveLength(0);
  });

  it('skips rows without date', () => {
    const rows = [{
      '交易时间': '',
      '金额(元)': '50.00',
      '收/支': '支出',
      '商品': '无日期',
      '交易对方': '商家',
      '交易单号': 'WX007',
      '当前状态': '支付成功',
      '支付方式': '',
    }];

    const result = parseWechatCSV(rows);
    expect(result).toHaveLength(0);
  });

  it('handles date with slash format', () => {
    const rows = [{
      '交易时间': '2024/01/15 12:00:00',
      '金额(元)': '50.00',
      '收/支': '支出',
      '商品': '消费',
      '交易对方': '商家',
      '交易单号': 'WX008',
      '当前状态': '支付成功',
      '支付方式': '微信支付',
    }];

    const result = parseWechatCSV(rows);
    expect(result).toHaveLength(1);
    expect(result[0].date).toBe('2024-01-15');
  });

  it('strips ¥ and whitespace from amount', () => {
    const rows = [{
      '交易时间': '2024-01-15 12:00:00',
      '金额(元)': '¥ 1,280.50',
      '收/支': '支出',
      '商品': '大额消费',
      '交易对方': '商家',
      '交易单号': 'WX009',
      '当前状态': '支付成功',
      '支付方式': '',
    }];

    const result = parseWechatCSV(rows);
    expect(result).toHaveLength(1);
    expect(result[0].amount).toBe(-1280.5);
  });

  it('defaults payment method to 微信支付', () => {
    const rows = [{
      '交易时间': '2024-01-15 12:00:00',
      '金额(元)': '50.00',
      '收/支': '支出',
      '商品': '消费',
      '交易对方': '商家',
      '交易单号': 'WX010',
      '当前状态': '支付成功',
    }];

    const result = parseWechatCSV(rows);
    expect(result).toHaveLength(1);
    expect(result[0].payment_method).toBe('微信支付');
  });

  it('uses 交易类型 as fallback description', () => {
    const rows = [{
      '交易时间': '2024-01-15 12:00:00',
      '金额(元)': '50.00',
      '收/支': '支出',
      '交易类型': '商户消费',
      '交易对方': '商家',
      '交易单号': 'WX011',
      '当前状态': '支付成功',
      '支付方式': '',
    }];

    const result = parseWechatCSV(rows);
    expect(result).toHaveLength(1);
    expect(result[0].description).toBe('商户消费');
  });
});
